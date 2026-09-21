import assert from 'node:assert/strict';

import {
  access,
  mkdtemp,
  readFile,
  rm,
  stat
} from 'node:fs/promises';

import {
  tmpdir
} from 'node:os';

import {
  join
} from 'node:path';

import {
  spawn
} from 'node:child_process';

import test from 'node:test';

import {
  YELLOW_JACKET_HOOKS_PATH,
  getGitHooksPath,
  installGitHook,
  uninstallGitHook
} from '../src/core/git.js';

function run(
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const child = spawn(
        command,
        args,
        {
          cwd,
          stdio: 'ignore'
        }
      );

      child.once(
        'error',
        reject
      );

      child.once(
        'close',
        (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              `${command} exited with ${String(code)}`
            )
          );
        }
      );
    }
  );
}

async function createRepository():
  Promise<string> {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'yellow-jacket-git-'
      )
    );

  await run(
    'git',
    [
      'init',
      '-b',
      'main'
    ],
    directory
  );

  return directory;
}

test(
  'installs a tracked pre-push hook and configures core.hooksPath',
  async (t) => {
    const repository =
      await createRepository();

    t.after(
      async () => {
        await rm(
          repository,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const installed =
      await installGitHook(
        repository
      );

    assert.equal(
      installed.hooksPath,
      YELLOW_JACKET_HOOKS_PATH
    );

    assert.equal(
      await getGitHooksPath(
        repository
      ),
      YELLOW_JACKET_HOOKS_PATH
    );

    await access(
      installed.hookPath
    );

    const metadata =
      await stat(
        installed.hookPath
      );

    assert.notEqual(
      metadata.mode & 0o111,
      0
    );

    const hook =
      await readFile(
        installed.hookPath,
        'utf8'
      );

    assert.match(
      hook,
      /YELLOW_JACKET/
    );

    assert.match(
      hook,
      /yellow-jacket run/
    );
  }
);

test(
  'install is idempotent',
  async (t) => {
    const repository =
      await createRepository();

    t.after(
      async () => {
        await rm(
          repository,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const first =
      await installGitHook(
        repository
      );

    const second =
      await installGitHook(
        repository
      );

    assert.equal(
      first.hookPath,
      second.hookPath
    );

    assert.equal(
      await getGitHooksPath(
        repository
      ),
      YELLOW_JACKET_HOOKS_PATH
    );
  }
);

test(
  'does not overwrite another Git hook manager',
  async (t) => {
    const repository =
      await createRepository();

    t.after(
      async () => {
        await rm(
          repository,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    await run(
      'git',
      [
        'config',
        '--local',
        'core.hooksPath',
        '.husky/_'
      ],
      repository
    );

    await assert.rejects(
      installGitHook(
        repository
      ),
      /will not overwrite another hook manager/
    );

    assert.equal(
      await getGitHooksPath(
        repository
      ),
      '.husky/_'
    );
  }
);

test(
  'uninstalls the Yellow Jacket Git hook',
  async (t) => {
    const repository =
      await createRepository();

    t.after(
      async () => {
        await rm(
          repository,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    const installed =
      await installGitHook(
        repository
      );

    const result =
      await uninstallGitHook(
        repository
      );

    assert.equal(
      result.hookRemoved,
      true
    );

    assert.equal(
      result.hooksPathRemoved,
      true
    );

    assert.equal(
      await getGitHooksPath(
        repository
      ),
      null
    );

    await assert.rejects(
      access(
        installed.hookPath
      ),
      {
        code:
          'ENOENT'
      }
    );
  }
);

test(
  'uninstall does not remove another Git hook manager',
  async (t) => {
    const repository =
      await createRepository();

    t.after(
      async () => {
        await rm(
          repository,
          {
            recursive: true,
            force: true
          }
        );
      }
    );

    await installGitHook(
      repository
    );

    await run(
      'git',
      [
        'config',
        '--local',
        'core.hooksPath',
        '.husky/_'
      ],
      repository
    );

    const result =
      await uninstallGitHook(
        repository
      );

    assert.equal(
      result.hooksPathRemoved,
      false
    );

    assert.equal(
      await getGitHooksPath(
        repository
      ),
      '.husky/_'
    );
  }
);
