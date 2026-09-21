#!/usr/bin/env node

import {
  parseArgs
} from 'node:util';

import {
  initProject
} from './commands/init.js';

import {
  compareWithBaseline,
  readBaseline,
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

import type {
  CoverageReport
} from './core/types.js';

function printHelp(): void {
  console.log(`yellow-jacket

Usage:
  yellow-jacket init
  yellow-jacket install
  yellow-jacket run
  yellow-jacket baseline
  yellow-jacket coverage

Commands:
  init      Create a local yellow-jacket configuration.
  install   Install the Git pre-push hook.
  run       Execute routes and compare them with the baseline when available.
  baseline  Execute routes and save their current responses as the baseline.
  coverage  Compare configured requests with an OpenAPI route inventory.
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

  const supported =
    new Set([
      'run',
      'baseline',
      'coverage'
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

  const config =
    await loadConfig();

  if (
    command === 'coverage'
  ) {
    const report =
      await buildCoverageReport(
        config
      );

    printCoverage(
      report
    );

    return;
  }

  const results =
    await runSuite(
      config
    );

  printResults(
    results
  );

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
          baseline,
          results,
          config.compare
        )
      : [];

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
