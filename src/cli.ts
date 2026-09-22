#!/usr/bin/env node

import {
  parseArgs
} from 'node:util';

import {
  appendFile,
  mkdir,
  writeFile
} from 'node:fs/promises';

import {
  dirname,
  resolve
} from 'node:path';

import {
  initProject
} from './commands/init.js';

import {
  desetupProject
} from './commands/desetup.js';

import {
  doctorProject
} from './commands/doctor.js';

import {
  compareWithBaseline,
  readBaseline,
  updateBaseline,
  writeBaseline
} from './core/baseline.js';

import {
  loadConfig
} from './core/config.js';

import {
  buildCoverageReport
} from './core/coverage.js';

import {
  installGitHook
} from './core/git.js';

import {
  runSuite
} from './core/runner.js';

import {
  countRunTargets,
  filterBaselineForRun,
  hasRunSelection,
  selectRunConfig
} from './core/selection.js';

import {
  formatCoverageGitHub,
  formatCoverageGitLab,
  formatCoverageHtml,
  formatCoverageMarkdown,
  formatRunGitHub,
  formatRunGitLab,
  formatRunHtml,
  formatRunJson,
  formatRunMarkdown
} from './core/report.js';

import type {
  BaselineFile,
  CoverageReport,
  RunReport,
  RunSelection
} from './core/types.js';

function printHelp(): void {
  console.log(`yellow-jacket

Usage:
  yellow-jacket init
  yellow-jacket install
  yellow-jacket desetup [--purge]
  yellow-jacket uninstall [--purge]
  yellow-jacket doctor
  yellow-jacket doctor --json
  yellow-jacket run [--allow-actions]
  yellow-jacket run --json
  yellow-jacket run --markdown
  yellow-jacket run --html
  yellow-jacket run --html --output yellow-jacket-run.html
  yellow-jacket run --github
  yellow-jacket run --gitlab --output yellow-jacket-run.xml
  yellow-jacket baseline [--allow-actions]
  yellow-jacket baseline --update --route <name-or-path>
  yellow-jacket baseline --update --scenario <name>
  yellow-jacket baseline --update --tag <tag>
  yellow-jacket coverage
  yellow-jacket coverage --json
  yellow-jacket coverage --markdown
  yellow-jacket coverage --html
  yellow-jacket coverage --github
  yellow-jacket coverage --gitlab
  yellow-jacket coverage --gitlab --output yellow-jacket-junit.xml
  yellow-jacket coverage --html --output coverage.html

Commands:
  init      Create a local yellow-jacket configuration.
  install   Install the Git pre-push hook.
  desetup   Remove Yellow Jacket from the current project.
  uninstall Alias for desetup.
  doctor    Diagnose the local Yellow Jacket project without making HTTP requests.
  run       Execute routes and compare them with the baseline when available.
  baseline  Execute routes and save their current responses as the baseline.
  coverage  Compare configured requests with coverage route inventories.
`);
}

function printResults(
  results:
    Awaited<
      ReturnType<
        typeof runSuite
      >
    >
): void {
  for (const result of results) {
    const marker =
      result.passed
        ? '✓'
        : '✗';

    console.log(
      `${marker} ${result.method.padEnd(7)} ${result.route.padEnd(24)} ${String(result.status).padEnd(3)} ${result.durationMs}ms`
    );

    if (result.error) {
      console.log(
        `  ${result.error}`
      );
    }
  }
}

function printCoverage(
  report: CoverageReport
): void {
  console.log(
    'yellow-jacket coverage\n'
  );

  for (
    const operation
    of report.operations
  ) {
    const marker =
      operation.covered
        ? '✓'
        : '✗';

    console.log(
      `${marker} ${operation.method.padEnd(7)} ${operation.path}`
    );
  }

  console.log('');

  console.log(
    `${report.covered} / ${report.total} operations covered`
  );

  console.log(
    `Coverage: ${report.percentage}%`
  );

  if (
    report.minimum !== undefined
  ) {
    console.log(
      `Minimum: ${report.minimum}%`
    );

    console.log(
      report.passed
        ? '✓ Coverage requirement satisfied'
        : '✗ Coverage requirement not satisfied'
    );
  }
}

function printDoctor(
  report: Awaited<
    ReturnType<
      typeof doctorProject
    >
  >
): void {
  const markers = {
    pass:
      '✓',
    warning:
      '!',
    error:
      '✗'
  } as const;

  console.log(
    'yellow-jacket doctor\n'
  );

  for (
    const check
    of report.checks
  ) {
    console.log(
      `${markers[check.status]} ${check.id.padEnd(
        18
      )} ${check.message}`
    );
  }

  console.log('');

  console.log(
    `${report.summary.pass} passed, ${report.summary.warning} warning(s), ${report.summary.error} error(s)`
  );
}

async function main():
  Promise<void> {
  const {
    positionals,
    values
  } = parseArgs({
    allowPositionals: true,

    options: {
      help: {
        type: 'boolean',
        short: 'h'
      },
      json: {
        type: 'boolean'
      },
      markdown: {
        type: 'boolean'
      },
      html: {
        type: 'boolean'
      },
      github: {
        type: 'boolean'
      },
      gitlab: {
        type: 'boolean'
      },
      output: {
        type: 'string'
      },
      route: {
        type: 'string',
        multiple: true
      },
      scenario: {
        type: 'string',
        multiple: true
      },
      tag: {
        type: 'string',
        multiple: true
      },
      'allow-actions': {
        type: 'boolean'
      },
      update: {
        type: 'boolean'
      },
      purge: {
        type: 'boolean'
      }
    }
  });

  const command =
    positionals[0] ??
    'run';

  if (
    values.help ||
    command === 'help'
  ) {
    printHelp();
    return;
  }

  if (command === 'init') {
    const created =
      await initProject();

    console.log(
      'yellow-jacket initialized.'
    );

    if (
      created.length > 0
    ) {
      console.log(
        `Created: ${created.join(', ')}`
      );
    }

    return;
  }

  if (
    command === 'install'
  ) {
    const installed =
      await installGitHook();

    console.log(
      'yellow-jacket Git hook installed.'
    );

    console.log(
      `Hook: ${installed.hookPath}`
    );

    console.log(
      `core.hooksPath: ${installed.hooksPath}`
    );

    return;
  }

  if (
    command === 'desetup' ||
    command === 'uninstall'
  ) {
    const result =
      await desetupProject(
        process.cwd(),
        {
          purge:
            values.purge ??
            false
        }
      );

    console.log(
      'yellow-jacket removed from this project.'
    );

    for (
      const item
      of result.removed
    ) {
      console.log(
        `Removed: ${item}`
      );
    }

    if (
      result.preserved.length >
      0
    ) {
      console.log('');
      console.log('Preserved:');

      for (
        const item
        of result.preserved
      ) {
        console.log(
          `  ${item}`
        );
      }

      console.log('');

      console.log(
        'Use "yellow-jacket desetup --purge" to remove preserved configuration and snapshots.'
      );
    }

    return;
  }

  const supported =
    new Set([
      'run',
      'baseline',
      'coverage',
      'doctor'
    ]);

  if (
    !supported.has(command)
  ) {
    console.error(
      `Unknown command: ${command}`
    );

    printHelp();
    process.exitCode = 2;
    return;
  }

  const outputFormats =
    [
      values.json,
      values.markdown,
      values.html,
      values.github,
      values.gitlab
    ].filter(
      Boolean
    ).length;

  if (
    outputFormats > 1
  ) {
    console.error(
      '--json, --markdown, --html, --github and --gitlab cannot be used together.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values.json &&
    command !== 'coverage' &&
    command !== 'run' &&
    command !== 'doctor'
  ) {
    console.error(
      '--json is only supported by coverage, run and doctor.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values.markdown &&
    command !== 'coverage' &&
    command !== 'run'
  ) {
    console.error(
      '--markdown is only supported by coverage and run.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values.html &&
    command !== 'coverage' &&
    command !== 'run'
  ) {
    console.error(
      '--html is only supported by coverage and run.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values.github &&
    command !== 'coverage' &&
    command !== 'run'
  ) {
    console.error(
      '--github is only supported by coverage and run.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values.gitlab &&
    command !== 'coverage' &&
    command !== 'run'
  ) {
    console.error(
      '--gitlab is only supported by coverage and run.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values.output &&
    command !== 'coverage' &&
    command !== 'run'
  ) {
    console.error(
      '--output is only supported by coverage and run.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values.output &&
    outputFormats === 0
  ) {
    console.error(
      '--output requires --json, --markdown, --html, --github or --gitlab.'
    );

    process.exitCode = 2;
    return;
  }

  const selection:
    RunSelection = {
      ...(values.route
        ? {
            routes:
              values.route
          }
        : {}),

      ...(values.scenario
        ? {
            scenarios:
              values.scenario
          }
        : {}),

      ...(values.tag
        ? {
            tags:
              values.tag
          }
        : {})
    };

  if (
    values.update &&
    command !==
      'baseline'
  ) {
    console.error(
      '--update is only supported by the baseline command.'
    );

    process.exitCode =
      2;
    return;
  }

  if (
    values.update &&
    !hasRunSelection(
      selection
    )
  ) {
    console.error(
      '--update requires --route, --scenario or --tag.'
    );

    process.exitCode =
      2;
    return;
  }

  if (
    command ===
      'baseline' &&
    hasRunSelection(
      selection
    ) &&
    !values.update
  ) {
    console.error(
      'Baseline selectors require --update to avoid replacing the complete baseline with a partial snapshot.'
    );

    process.exitCode =
      2;
    return;
  }

  if (
    hasRunSelection(
      selection
    ) &&
    command !==
      'run' &&
    command !==
      'baseline'
  ) {
    console.error(
      '--route, --scenario and --tag are supported by run, or by baseline with --update.'
    );

    process.exitCode =
      2;
    return;
  }

  if (
    values.purge
  ) {
    console.error(
      '--purge is only supported by desetup and uninstall.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    values['allow-actions'] &&
    command !== 'run' &&
    command !== 'baseline'
  ) {
    console.error(
      '--allow-actions is only supported by run and baseline.'
    );

    process.exitCode = 2;
    return;
  }

  if (
    command === 'doctor'
  ) {
    const report =
      await doctorProject(
        process.cwd()
      );

    if (
      values.json
    ) {
      process.stdout.write(
        `${JSON.stringify(
          report,
          null,
          2
        )}\n`
      );
    } else {
      printDoctor(
        report
      );
    }

    if (
      !report.passed
    ) {
      process.exitCode =
        1;
    }

    return;
  }

  const config =
    await loadConfig();

  if (
    command === 'coverage'
  ) {
    const report =
      await buildCoverageReport(
        config
      );

    const rendered =
      values.json
        ? `${JSON.stringify(
            report,
            null,
            2
          )}\n`
        : values.markdown
          ? formatCoverageMarkdown(
              report
            )
          : values.html
            ? formatCoverageHtml(
                report
              )
            : values.github
              ? formatCoverageGitHub(
                  report
                )
              : values.gitlab
                ? formatCoverageGitLab(
                    report
                  )
                : undefined;

    if (
      values.github &&
      process.env.GITHUB_STEP_SUMMARY
    ) {
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        formatCoverageMarkdown(
          report
        ),
        'utf8'
      );
    }

    if (
      rendered !== undefined
    ) {
      if (values.output) {
        const outputPath =
          resolve(
            process.cwd(),
            values.output
          );

        await mkdir(
          dirname(
            outputPath
          ),
          {
            recursive: true
          }
        );

        await writeFile(
          outputPath,
          rendered,
          'utf8'
        );

        console.log(
          `Coverage report written to ${outputPath}`
        );
      } else {
        process.stdout.write(
          rendered
        );
      }
    } else {
      printCoverage(
        report
      );
    }

    if (!report.passed) {
      process.exitCode = 1;
    }

    return;
  }

  const usesSelection =
    command ===
      'run' ||
    (
      command ===
        'baseline' &&
      values.update
    );

  const selectedConfig =
    usesSelection
      ? selectRunConfig(
          config,
          selection
        )
      : config;

  if (
    usesSelection &&
    hasRunSelection(
      selection
    ) &&
    countRunTargets(
      selectedConfig
    ) ===
      0
  ) {
    console.error(
      'No configured routes or scenarios matched the requested selection.'
    );

    process.exitCode =
      2;
    return;
  }

  let baselineForUpdate:
    BaselineFile | undefined;

  if (
    command ===
      'baseline' &&
    values.update
  ) {
    const existing =
      await readBaseline(
        config
      );

    if (
      existing ===
        null
    ) {
      console.error(
        'Cannot update baseline because no baseline exists. Run "yellow-jacket baseline" first.'
      );

      process.exitCode =
        2;
      return;
    }

    baselineForUpdate =
      existing;
  }

  const results =
    await runSuite(
      selectedConfig,
      {
        allowActions:
          values['allow-actions'] ??
          false
      }
    );

  const structuredRunOutput =
    command === 'run' &&
    (
      values.json ||
      values.markdown ||
      values.html ||
      values.github ||
      values.gitlab
    );

  if (
    !structuredRunOutput
  ) {
    printResults(
      results
    );
  }

  const failedAssertions =
    results.filter(
      (result) =>
        !result.passed
    );

  if (
    command === 'baseline'
  ) {
    if (
      failedAssertions.length >
      0
    ) {
      console.error(
        'Baseline not written because route expectations failed.'
      );

      process.exitCode = 1;
      return;
    }

    if (
      values.update
    ) {
      if (
        baselineForUpdate ===
          undefined
      ) {
        throw new Error(
          'Baseline update preflight was not completed.'
        );
      }

      const path =
        await updateBaseline(
          config,
          baselineForUpdate,
          results
        );

      console.log(
        `Baseline updated at ${path}`
      );

      return;
    }

    const path =
      await writeBaseline(
        config,
        results
      );

    console.log(
      `Baseline written to ${path}`
    );

    return;
  }

  const baseline =
    await readBaseline(
      config
    );

  const regressions =
    baseline
      ? compareWithBaseline(
          hasRunSelection(
            selection
          )
            ? filterBaselineForRun(
                baseline,
                selectedConfig
              )
            : baseline,
          results,
          config.compare
        )
      : [];

  const runReport:
    RunReport = {
      baselineFound:
        baseline !==
        null,

      passed:
        failedAssertions.length ===
          0 &&
        regressions.length ===
          0,

      results,
      regressions
    };

  if (
    structuredRunOutput
  ) {
    const rendered =
      values.json
        ? formatRunJson(
            runReport,
            config.compare
          )
        : values.markdown
          ? formatRunMarkdown(
              runReport
            )
          : values.html
            ? formatRunHtml(
                runReport
              )
            : values.github
              ? formatRunGitHub(
                  runReport
                )
              : formatRunGitLab(
                  runReport
                );

    if (
      values.github &&
      process.env.GITHUB_STEP_SUMMARY
    ) {
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        formatRunMarkdown(
          runReport
        ),
        'utf8'
      );
    }

    if (
      values.output
    ) {
      const outputPath =
        resolve(
          process.cwd(),
          values.output
        );

      await mkdir(
        dirname(
          outputPath
        ),
        {
          recursive:
            true
        }
      );

      await writeFile(
        outputPath,
        rendered,
        'utf8'
      );

      console.log(
        `Run report written to ${outputPath}`
      );
    } else {
      process.stdout.write(
        rendered
      );
    }

    if (
      !runReport.passed
    ) {
      process.exitCode =
        1;
    }

    return;
  }

  for (
    const regression
    of regressions
  ) {
    console.error(
      `△ ${regression.method} ${regression.route}`
    );

    for (
      const change
      of regression.changes
    ) {
      if (
        change !==
        'response body changed'
      ) {
        console.error(
          `  ${change}`
        );
      }
    }

    for (
      const change
      of regression.bodyChanges ??
        []
    ) {
      if (
        change.kind ===
        'changed'
      ) {
        console.error(
          `  ${change.path}`
        );

        console.error(
          `  - ${JSON.stringify(change.before)}`
        );

        console.error(
          `  + ${JSON.stringify(change.after)}`
        );
      } else if (
        change.kind ===
        'added'
      ) {
        console.error(
          `  + ${change.path}: ${JSON.stringify(change.after)}`
        );
      } else {
        console.error(
          `  - ${change.path}: ${JSON.stringify(change.before)}`
        );
      }
    }
  }

  if (!baseline) {
    console.log(
      'No baseline found. Run "yellow-jacket baseline" to create one.'
    );
  }

  if (
    failedAssertions.length >
      0 ||
    regressions.length >
      0
  ) {
    process.exitCode = 1;
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : String(error)
    );

    process.exitCode = 1;
  }
);
