import {
  chmod,
  mkdir,
  writeFile
} from 'node:fs/promises';

import {
  resolve
} from 'node:path';

import {
  spawn
} from 'node:child_process';

export const YELLOW_JACKET_HOOKS_PATH =
  '.yellow-jacket/hooks';

const PRE_PUSH_HOOK = `#!/bin/sh

if [ "\${YELLOW_JACKET:-1}" = "0" ]; then
  echo "yellow-jacket: skipped (YELLOW_JACKET=0)"
  exit 0
fi

if [ -x "./node_modules/.bin/yellow-jacket" ]; then
  exec ./node_modules/.bin/yellow-jacket run
fi

if command -v yellow-jacket >/dev/null 2>&1; then
  exec yellow-jacket run
fi

echo "yellow-jacket: executable not found." >&2
echo "Run npm install before pushing." >&2
exit 1
`;

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<CommandResult> {
  return new Promise(
    (resolvePromise, reject) => {
      const child = spawn(
        command,
        args,
        {
          cwd,
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
        (chunk: string) => {
          stdout += chunk;
        }
      );

      child.stderr.on(
        'data',
        (chunk: string) => {
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
            code: code ?? 1,
            stdout,
            stderr
          });
        }
      );
    }
  );
}

async function git(
  args: string[],
  cwd: string
): Promise<CommandResult> {
  try {
    return await runCommand(
      'git',
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
        'Git is required to install yellow-jacket hooks.'
      );
    }

    throw error;
  }
}

export async function findGitRoot(
  cwd = process.cwd()
): Promise<string> {
  const result =
    await git(
      [
        'rev-parse',
        '--show-toplevel'
      ],
      cwd
    );

  if (result.code !== 0) {
    throw new Error(
      'yellow-jacket install must be run inside a Git repository.'
    );
  }

  return result.stdout.trim();
}

export async function getGitHooksPath(
  cwd = process.cwd()
): Promise<string | null> {
  const root =
    await findGitRoot(cwd);

  const result =
    await git(
      [
        'config',
        '--local',
        '--get',
        'core.hooksPath'
      ],
      root
    );

  if (result.code !== 0) {
    return null;
  }

  const value =
    result.stdout.trim();

  return value || null;
}

export interface InstallGitHookResult {
  root: string;
  hookPath: string;
  hooksPath: string;
}

export async function installGitHook(
  cwd = process.cwd()
): Promise<InstallGitHookResult> {
  const root =
    await findGitRoot(cwd);

  const currentHooksPath =
    await getGitHooksPath(root);

  if (
    currentHooksPath !== null &&
    currentHooksPath !==
      YELLOW_JACKET_HOOKS_PATH
  ) {
    throw new Error(
      [
        `Git already uses core.hooksPath="${currentHooksPath}".`,
        'yellow-jacket will not overwrite another hook manager.',
        '',
        'Add this command to your existing pre-push hook instead:',
        '',
        '  [ "${YELLOW_JACKET:-1}" = "0" ] || ./node_modules/.bin/yellow-jacket run'
      ].join('\n')
    );
  }

  const hooksDirectory =
    resolve(
      root,
      YELLOW_JACKET_HOOKS_PATH
    );

  const hookPath =
    resolve(
      hooksDirectory,
      'pre-push'
    );

  await mkdir(
    hooksDirectory,
    {
      recursive: true
    }
  );

  await writeFile(
    hookPath,
    PRE_PUSH_HOOK,
    {
      encoding: 'utf8',
      mode: 0o755
    }
  );

  await chmod(
    hookPath,
    0o755
  );

  const configResult =
    await git(
      [
        'config',
        '--local',
        'core.hooksPath',
        YELLOW_JACKET_HOOKS_PATH
      ],
      root
    );

  if (
    configResult.code !== 0
  ) {
    throw new Error(
      `Unable to configure Git hooks: ${configResult.stderr.trim()}`
    );
  }

  return {
    root,
    hookPath,
    hooksPath:
      YELLOW_JACKET_HOOKS_PATH
  };
}
