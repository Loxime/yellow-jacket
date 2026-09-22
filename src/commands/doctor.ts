import {
  access,
  readFile
} from 'node:fs/promises';

import {
  resolve
} from 'node:path';

import {
  baselinePath,
  readBaseline
} from '../core/baseline.js';

import {
  findConfig,
  loadConfig
} from '../core/config.js';

import {
  buildCoverageReport
} from '../core/coverage.js';

import {
  YELLOW_JACKET_HOOKS_PATH,
  findGitRoot,
  getGitHooksPath
} from '../core/git.js';

import type {
  DoctorCheck,
  DoctorCheckStatus,
  DoctorReport,
  YellowJacketConfig
} from '../core/types.js';

type PackageManager =
  | 'npm'
  | 'pnpm'
  | 'yarn';

interface PackageJson {
  packageManager?: string;

  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  [key: string]: unknown;
}

const PACKAGE_NAME =
  '@falche/yellow-jacket';

const MINIMUM_NODE = [
  24,
  12,
  0
] as const;

async function exists(
  path: string
): Promise<boolean> {
  try {
    await access(
      path
    );

    return true;
  } catch {
    return false;
  }
}

function messageOf(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function addCheck(
  checks: DoctorCheck[],
  id: string,
  status: DoctorCheckStatus,
  message: string
): void {
  checks.push({
    id,
    status,
    message
  });
}

function nodeVersionSupported(
  version: string
): boolean {
  const parts =
    version
      .split('.')
      .slice(
        0,
        3
      )
      .map(
        Number
      );

  if (
    parts.length !== 3 ||
    parts.some(
      (value) =>
        !Number.isInteger(
          value
        )
    )
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
      MINIMUM_NODE.length;
    index += 1
  ) {
    const current =
      parts[index] ?? 0;

    const minimum =
      MINIMUM_NODE[index] ?? 0;

    if (
      current >
      minimum
    ) {
      return true;
    }

    if (
      current <
      minimum
    ) {
      return false;
    }
  }

  return true;
}

function dependencySection(
  json: PackageJson
): string | null {
  const sections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies'
  ] as const;

  for (
    const section
    of sections
  ) {
    const dependencies =
      json[section];

    if (
      dependencies &&
      Object.prototype
        .hasOwnProperty
        .call(
          dependencies,
          PACKAGE_NAME
        )
    ) {
      return section;
    }
  }

  return null;
}

async function readPackageJson(
  cwd: string
): Promise<{
  path: string;
  json: PackageJson;
} | null> {
  const path =
    resolve(
      cwd,
      'package.json'
    );

  if (
    !(await exists(path))
  ) {
    return null;
  }

  return {
    path,

    json:
      JSON.parse(
        await readFile(
          path,
          'utf8'
        )
      ) as PackageJson
  };
}

async function detectPackageManager(
  cwd: string,
  json: PackageJson
): Promise<{
  manager: PackageManager;
  source: string;
} | {
  manager: null;
  source: string;
}> {
  const declared =
    json.packageManager;

  if (
    declared
      ?.startsWith(
        'npm@'
      )
  ) {
    return {
      manager:
        'npm',
      source:
        `packageManager=${declared}`
    };
  }

  if (
    declared
      ?.startsWith(
        'pnpm@'
      )
  ) {
    return {
      manager:
        'pnpm',
      source:
        `packageManager=${declared}`
    };
  }

  if (
    declared
      ?.startsWith(
        'yarn@'
      )
  ) {
    return {
      manager:
        'yarn',
      source:
        `packageManager=${declared}`
    };
  }

  if (
    declared !== undefined
  ) {
    return {
      manager:
        null,
      source:
        `unsupported packageManager=${declared}`
    };
  }

  if (
    await exists(
      resolve(
        cwd,
        'pnpm-lock.yaml'
      )
    )
  ) {
    return {
      manager:
        'pnpm',
      source:
        'pnpm-lock.yaml'
    };
  }

  if (
    await exists(
      resolve(
        cwd,
        'yarn.lock'
      )
    )
  ) {
    return {
      manager:
        'yarn',
      source:
        'yarn.lock'
    };
  }

  if (
    await exists(
      resolve(
        cwd,
        'package-lock.json'
      )
    )
  ) {
    return {
      manager:
        'npm',
      source:
        'package-lock.json'
    };
  }

  return {
    manager:
      'npm',
    source:
      'default'
  };
}

async function checkPackage(
  cwd: string,
  checks: DoctorCheck[]
): Promise<void> {
  let packageFile:
    Awaited<
      ReturnType<
        typeof readPackageJson
      >
    >;

  try {
    packageFile =
      await readPackageJson(
        cwd
      );
  } catch (error) {
    addCheck(
      checks,
      'package-json',
      'error',
      `package.json is invalid: ${messageOf(
        error
      )}`
    );

    addCheck(
      checks,
      'package-manager',
      'warning',
      'Package manager check skipped because package.json is invalid.'
    );

    addCheck(
      checks,
      'dependency',
      'warning',
      'Yellow Jacket dependency check skipped because package.json is invalid.'
    );

    return;
  }

  if (!packageFile) {
    addCheck(
      checks,
      'package-json',
      'warning',
      'No package.json found.'
    );

    addCheck(
      checks,
      'package-manager',
      'warning',
      'Package manager could not be determined from a project manifest.'
    );

    addCheck(
      checks,
      'dependency',
      'warning',
      'Yellow Jacket is not declared in a package.json.'
    );

    return;
  }

  addCheck(
    checks,
    'package-json',
    'pass',
    `package.json found at ${packageFile.path}.`
  );

  const detected =
    await detectPackageManager(
      cwd,
      packageFile.json
    );

  if (
    detected.manager ===
    null
  ) {
    addCheck(
      checks,
      'package-manager',
      'warning',
      `Package manager is not supported by Yellow Jacket desetup (${detected.source}).`
    );
  } else {
    addCheck(
      checks,
      'package-manager',
      'pass',
      `${detected.manager} detected via ${detected.source}.`
    );
  }

  const section =
    dependencySection(
      packageFile.json
    );

  if (section) {
    addCheck(
      checks,
      'dependency',
      'pass',
      `${PACKAGE_NAME} is declared in ${section}.`
    );
  } else {
    addCheck(
      checks,
      'dependency',
      'warning',
      `${PACKAGE_NAME} is not declared as a project dependency.`
    );
  }
}

async function checkBaseline(
  cwd: string,
  config: YellowJacketConfig,
  checks: DoctorCheck[]
): Promise<void> {
  const path =
    baselinePath(
      config,
      cwd
    );

  try {
    const baseline =
      await readBaseline(
        config,
        cwd
      );

    if (!baseline) {
      addCheck(
        checks,
        'baseline',
        'warning',
        `No baseline found at ${path}. Run "yellow-jacket baseline" to create one.`
      );

      return;
    }

    if (
      baseline.formatVersion !==
        1 ||
      !Array.isArray(
        baseline.responses
      )
    ) {
      addCheck(
        checks,
        'baseline',
        'error',
        `Baseline has an unsupported structure: ${path}.`
      );

      return;
    }

    addCheck(
      checks,
      'baseline',
      'pass',
      `Baseline is readable (${baseline.responses.length} response(s)).`
    );
  } catch (error) {
    addCheck(
      checks,
      'baseline',
      'error',
      `Baseline is not readable: ${messageOf(
        error
      )}`
    );
  }
}

async function checkCoverage(
  cwd: string,
  config: YellowJacketConfig,
  checks: DoctorCheck[]
): Promise<void> {
  if (
    !config.coverage?.openapi &&
    !config.coverage?.sitemap
  ) {
    addCheck(
      checks,
      'coverage',
      'warning',
      'No OpenAPI or sitemap coverage source is configured.'
    );

    return;
  }

  try {
    const report =
      await buildCoverageReport(
        config,
        cwd
      );

    if (
      report.minimum !==
        undefined &&
      !report.passed
    ) {
      addCheck(
        checks,
        'coverage',
        'warning',
        `Coverage sources are valid, but ${report.percentage}% is below the configured minimum of ${report.minimum}%.`
      );

      return;
    }

    addCheck(
      checks,
      'coverage',
      'pass',
      `Coverage sources are readable (${report.total} operation(s), ${report.percentage}% covered).`
    );
  } catch (error) {
    addCheck(
      checks,
      'coverage',
      'error',
      messageOf(
        error
      )
    );
  }
}

async function checkGit(
  cwd: string,
  checks: DoctorCheck[]
): Promise<void> {
  let root:
    string;

  try {
    root =
      await findGitRoot(
        cwd
      );
  } catch (error) {
    addCheck(
      checks,
      'git-repository',
      'warning',
      `Git repository not detected: ${messageOf(
        error
      )}`
    );

    addCheck(
      checks,
      'git-hook',
      'warning',
      'Git hook check skipped because no Git repository was detected.'
    );

    return;
  }

  addCheck(
    checks,
    'git-repository',
    'pass',
    `Git repository detected at ${root}.`
  );

  let hooksPath:
    string | null;

  try {
    hooksPath =
      await getGitHooksPath(
        root
      );
  } catch (error) {
    addCheck(
      checks,
      'git-hook',
      'error',
      `Unable to inspect Git hooks: ${messageOf(
        error
      )}`
    );

    return;
  }

  if (
    hooksPath === null
  ) {
    addCheck(
      checks,
      'git-hook',
      'warning',
      'core.hooksPath is not configured. Run "yellow-jacket install" to enable the pre-push hook.'
    );

    return;
  }

  if (
    hooksPath !==
    YELLOW_JACKET_HOOKS_PATH
  ) {
    addCheck(
      checks,
      'git-hook',
      'warning',
      `Git uses another hook manager (${hooksPath}). Yellow Jacket will not overwrite it.`
    );

    return;
  }

  const hookPath =
    resolve(
      root,
      YELLOW_JACKET_HOOKS_PATH,
      'pre-push'
    );

  try {
    const hook =
      await readFile(
        hookPath,
        'utf8'
      );

    if (
      !hook.includes(
        'yellow-jacket run'
      )
    ) {
      addCheck(
        checks,
        'git-hook',
        'error',
        `Yellow Jacket owns core.hooksPath but ${hookPath} does not contain the expected pre-push command.`
      );

      return;
    }

    addCheck(
      checks,
      'git-hook',
      'pass',
      `Yellow Jacket pre-push hook is installed at ${hookPath}.`
    );
  } catch (error) {
    addCheck(
      checks,
      'git-hook',
      'error',
      `Yellow Jacket owns core.hooksPath but the pre-push hook is missing or unreadable: ${messageOf(
        error
      )}`
    );
  }
}

export async function doctorProject(
  cwd = process.cwd()
): Promise<DoctorReport> {
  const checks:
    DoctorCheck[] = [];

  const nodeVersion =
    process.versions.node;

  addCheck(
    checks,
    'node',
    nodeVersionSupported(
      nodeVersion
    )
      ? 'pass'
      : 'error',
    nodeVersionSupported(
      nodeVersion
    )
      ? `Node.js ${nodeVersion} satisfies the minimum requirement (24.12.0).`
      : `Node.js ${nodeVersion} is below the minimum requirement (24.12.0).`
  );

  await checkPackage(
    cwd,
    checks
  );

  let config:
    YellowJacketConfig | null =
      null;

  try {
    const path =
      await findConfig(
        cwd
      );

    config =
      await loadConfig(
        cwd
      );

    addCheck(
      checks,
      'config',
      'pass',
      `Configuration is valid: ${path}.`
    );
  } catch (error) {
    addCheck(
      checks,
      'config',
      'error',
      messageOf(
        error
      )
    );
  }

  if (config) {
    await checkBaseline(
      cwd,
      config,
      checks
    );

    await checkCoverage(
      cwd,
      config,
      checks
    );
  } else {
    addCheck(
      checks,
      'baseline',
      'warning',
      'Baseline check skipped because the configuration is invalid.'
    );

    addCheck(
      checks,
      'coverage',
      'warning',
      'Coverage source check skipped because the configuration is invalid.'
    );
  }

  await checkGit(
    cwd,
    checks
  );

  const summary = {
    pass:
      checks.filter(
        (check) =>
          check.status ===
          'pass'
      ).length,

    warning:
      checks.filter(
        (check) =>
          check.status ===
          'warning'
      ).length,

    error:
      checks.filter(
        (check) =>
          check.status ===
          'error'
      ).length
  };

  return {
    passed:
      summary.error ===
      0,

    summary,
    checks
  };
}
