import assert from 'node:assert/strict';

import {
  mkdtemp,
  rm,
  writeFile
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
  doctorProject
} from '../src/commands/doctor.js';

function run(
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
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
            stdio:
              'ignore'
          }
        );

      child.once(
        'error',
        reject
      );

      child.once(
        'close',
        (code) => {
          if (
            code === 0
          ) {
            resolvePromise();
            return;
          }

          reject(
            new Error(
              `${command} exited with ${String(
                code
              )}`
            )
          );
        }
      );
    }
  );
}

async function createProject():
  Promise<string> {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'yellow-jacket-doctor-'
      )
    );

  await writeFile(
    join(
      directory,
      'package.json'
    ),
    JSON.stringify(
      {
        name:
          'consumer',

        version:
          '1.0.0',

        packageManager:
          'npm@11.0.0',

        devDependencies: {
          'yellow-jacket':
            '0.1.0'
        }
      },
      null,
      2
    ),
    'utf8'
  );

  await writeFile(
    join(
      directory,
      'yellow-jacket.config.mjs'
    ),
    `export default {
  baseUrl: 'http://localhost',
  routes: []
};
`,
    'utf8'
  );

  return directory;
}

test(
  'doctor treats optional missing integrations as warnings',
  async (t) => {
    const directory =
      await createProject();

    t.after(
      async () => {
        await rm(
          directory,
          {
            recursive:
              true,
            force:
              true
          }
        );
      }
    );

    const report =
      await doctorProject(
        directory
      );

    assert.equal(
      report.passed,
      true
    );

    assert.equal(
      report.summary.error,
      0
    );

    assert.ok(
      report.summary.warning >
      0
    );

    assert.equal(
      report.checks.find(
        (check) =>
          check.id ===
          'config'
      )?.status,
      'pass'
    );
  }
);

test(
  'doctor fails when a configured coverage source is missing',
  async (t) => {
    const directory =
      await createProject();

    t.after(
      async () => {
        await rm(
          directory,
          {
            recursive:
              true,
            force:
              true
          }
        );
      }
    );

    await writeFile(
      join(
        directory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  coverage: {
    openapi: './missing-openapi.yaml'
  },
  routes: []
};
`,
      'utf8'
    );

    const report =
      await doctorProject(
        directory
      );

    assert.equal(
      report.passed,
      false
    );

    assert.equal(
      report.checks.find(
        (check) =>
          check.id ===
          'coverage'
      )?.status,
      'error'
    );
  }
);

test(
  'doctor detects a missing Yellow Jacket pre-push hook',
  async (t) => {
    const directory =
      await createProject();

    t.after(
      async () => {
        await rm(
          directory,
          {
            recursive:
              true,
            force:
              true
          }
        );
      }
    );

    await run(
      'git',
      [
        'init'
      ],
      directory
    );

    await run(
      'git',
      [
        'config',
        '--local',
        'core.hooksPath',
        '.yellow-jacket/hooks'
      ],
      directory
    );

    const report =
      await doctorProject(
        directory
      );

    assert.equal(
      report.passed,
      false
    );

    assert.equal(
      report.checks.find(
        (check) =>
          check.id ===
          'git-hook'
      )?.status,
      'error'
    );
  }
);
