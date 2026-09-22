import {
  access,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';

import {
  resolve
} from 'node:path';

import {
  spawn
} from 'node:child_process';

import {
  uninstallGitHook
} from '../core/git.js';

const PACKAGE_NAME =
  '@falche/yellow-jacket';

const CONFIG_FILES = [
  'yellow-jacket.config.ts',
  'yellow-jacket.config.mjs',
  'yellow-jacket.config.js'
] as const;

type PackageManager =
  | 'npm'
  | 'pnpm'
  | 'yarn';

interface PackageJson {
  packageManager?: string;

  scripts?:
    Record<
      string,
      string
    >;

  dependencies?:
    Record<
      string,
      string
    >;

  devDependencies?:
    Record<
      string,
      string
    >;

  optionalDependencies?:
    Record<
      string,
      string
    >;

  peerDependencies?:
    Record<
      string,
      string
    >;

  [key: string]:
    unknown;
}

export interface DesetupOptions {
  purge?: boolean;
}

export interface DesetupResult {
  removed: string[];
  preserved: string[];
  packageManager?: PackageManager;
}

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

async function cleanupPackageScripts(
  cwd: string
): Promise<string[]> {
  const packageFile =
    await readPackageJson(
      cwd
    );

  if (!packageFile) {
    return [];
  }

  const removed:
    string[] = [];

  const scripts =
    packageFile.json.scripts;

  if (!scripts) {
    return removed;
  }

  if (
    scripts[
      'yellow-jacket'
    ] ===
    'yellow-jacket run'
  ) {
    delete scripts[
      'yellow-jacket'
    ];

    removed.push(
      'package script yellow-jacket'
    );
  }

  if (
    scripts[
      'yellow-jacket:baseline'
    ] ===
    'yellow-jacket baseline'
  ) {
    delete scripts[
      'yellow-jacket:baseline'
    ];

    removed.push(
      'package script yellow-jacket:baseline'
    );
  }

  if (
    removed.length === 0
  ) {
    return removed;
  }

  if (
    Object.keys(
      scripts
    ).length === 0
  ) {
    delete packageFile
      .json.scripts;
  }

  await writeFile(
    packageFile.path,
    `${JSON.stringify(
      packageFile.json,
      null,
      2
    )}\n`,
    'utf8'
  );

  return removed;
}

function declaresYellowJacket(
  json: PackageJson
): boolean {
  return [
    json.dependencies,
    json.devDependencies,
    json.optionalDependencies,
    json.peerDependencies
  ].some(
    (section) =>
      section !== undefined &&
      Object.prototype
        .hasOwnProperty
        .call(
          section,
          PACKAGE_NAME
        )
  );
}

async function detectPackageManager(
  cwd: string,
  json: PackageJson
): Promise<PackageManager> {
  if (
    json.packageManager
      ?.startsWith(
        'pnpm@'
      )
  ) {
    return 'pnpm';
  }

  if (
    json.packageManager
      ?.startsWith(
        'yarn@'
      )
  ) {
    return 'yarn';
  }

  if (
    json.packageManager
      ?.startsWith(
        'npm@'
      )
  ) {
    return 'npm';
  }

  if (
    await exists(
      resolve(
        cwd,
        'pnpm-lock.yaml'
      )
    )
  ) {
    return 'pnpm';
  }

  if (
    await exists(
      resolve(
        cwd,
        'yarn.lock'
      )
    )
  ) {
    return 'yarn';
  }

  return 'npm';
}

function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const env = {
    ...process.env
  };

  delete env.npm_config_dry_run;
  delete env.NPM_CONFIG_DRY_RUN;

  return new Promise(
    (
      resolvePromise,
      reject
    ) => {
      const child =
        spawn(
          command,
          args,
          {
            cwd,
            env,
            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        );

      let stdout = '';
      let stderr = '';

      child.stdout.setEncoding(
        'utf8'
      );

      child.stderr.setEncoding(
        'utf8'
      );

      child.stdout.on(
        'data',
        (
          chunk: string
        ) => {
          stdout += chunk;
        }
      );

      child.stderr.on(
        'data',
        (
          chunk: string
        ) => {
          stderr += chunk;
        }
      );

      child.once(
        'error',
        reject
      );

      child.once(
        'close',
        (code) => {
          resolvePromise({
            code:
              code ?? 1,
            stdout,
            stderr
          });
        }
      );
    }
  );
}

async function removePackageDependency(
  cwd: string
): Promise<PackageManager | null> {
  const packageFile =
    await readPackageJson(
      cwd
    );

  if (
    !packageFile ||
    !declaresYellowJacket(
      packageFile.json
    )
  ) {
    return null;
  }

  const manager =
    await detectPackageManager(
      cwd,
      packageFile.json
    );

  const args =
    manager === 'npm'
      ? [
          'uninstall',
          PACKAGE_NAME,
          '--ignore-scripts'
        ]
      : manager === 'pnpm'
        ? [
            'remove',
            PACKAGE_NAME,
            '--ignore-scripts'
          ]
        : [
            'remove',
            PACKAGE_NAME
          ];

  let result:
    Awaited<
      ReturnType<
        typeof runCommand
      >
    >;

  try {
    result =
      await runCommand(
        manager,
        args,
        cwd
      );
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error as NodeJS.ErrnoException
      ).code === 'ENOENT'
    ) {
      throw new Error(
        `${PACKAGE_NAME} could not be removed because ${manager} is not installed.`
      );
    }

    throw error;
  }

  if (
    result.code !== 0
  ) {
    throw new Error(
      [
        `Unable to remove ${PACKAGE_NAME} with ${manager}.`,
        result.stderr.trim()
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return manager;
}

async function purgeProjectFiles(
  cwd: string
): Promise<string[]> {
  const removed:
    string[] = [];

  for (
    const filename
    of CONFIG_FILES
  ) {
    const path =
      resolve(
        cwd,
        filename
      );

    if (
      await exists(
        path
      )
    ) {
      await rm(
        path,
        {
          force: true
        }
      );

      removed.push(
        filename
      );
    }
  }

  const stateDirectory =
    resolve(
      cwd,
      '.yellow-jacket'
    );

  if (
    await exists(
      stateDirectory
    )
  ) {
    await rm(
      stateDirectory,
      {
        recursive: true,
        force: true
      }
    );

    removed.push(
      '.yellow-jacket/'
    );
  }

  return removed;
}

export async function desetupProject(
  cwd = process.cwd(),
  options:
    DesetupOptions = {}
): Promise<DesetupResult> {
  const removed:
    string[] = [];

  const preserved:
    string[] = [];

  const gitResult =
    await uninstallGitHook(
      cwd
    );

  if (
    gitResult.hookRemoved
  ) {
    removed.push(
      '.yellow-jacket/hooks/pre-push'
    );
  }

  if (
    gitResult.hooksPathRemoved
  ) {
    removed.push(
      'Git core.hooksPath'
    );
  }

  removed.push(
    ...await cleanupPackageScripts(
      cwd
    )
  );

  if (
    options.purge
  ) {
    removed.push(
      ...await purgeProjectFiles(
        cwd
      )
    );
  } else {
    for (
      const filename
      of CONFIG_FILES
    ) {
      if (
        await exists(
          resolve(
            cwd,
            filename
          )
        )
      ) {
        preserved.push(
          filename
        );
      }
    }

    if (
      await exists(
        resolve(
          cwd,
          '.yellow-jacket'
        )
      )
    ) {
      preserved.push(
        '.yellow-jacket/'
      );
    }
  }

  const packageManager =
    await removePackageDependency(
      cwd
    );

  if (packageManager) {
    removed.push(
      `package dependency ${PACKAGE_NAME}`
    );
  }

  return {
    removed,
    preserved,

    ...(packageManager
      ? {
          packageManager
        }
      : {})
  };
}
