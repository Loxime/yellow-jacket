import assert from 'node:assert/strict';

import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';

import {
  tmpdir
} from 'node:os';

import {
  join
} from 'node:path';

import test from 'node:test';

import {
  desetupProject
} from '../src/commands/desetup.js';

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

test(
  'desetup removes integration but preserves configuration and snapshots',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-desetup-'
        )
      );

    t.after(
      async () => {
        await rm(
          directory,
          {
            recursive: true,
            force: true
          }
        );
      }
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

          scripts: {
            'yellow-jacket':
              'yellow-jacket run',

            'yellow-jacket:baseline':
              'yellow-jacket baseline',

            custom:
              'echo keep'
          },

          devDependencies: {
            'yellow-jacket':
              '0.0.0'
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
      'export default {};\n',
      'utf8'
    );

    await mkdir(
      join(
        directory,
        '.yellow-jacket',
        'snapshots'
      ),
      {
        recursive: true
      }
    );

    await writeFile(
      join(
        directory,
        '.yellow-jacket',
        'snapshots',
        'baseline.json'
      ),
      '{}\n',
      'utf8'
    );

    const result =
      await desetupProject(
        directory
      );

    const packageJson =
      JSON.parse(
        await readFile(
          join(
            directory,
            'package.json'
          ),
          'utf8'
        )
      ) as {
        scripts?:
          Record<
            string,
            string
          >;

        devDependencies?:
          Record<
            string,
            string
          >;
      };

    assert.equal(
      packageJson.scripts
        ?.['yellow-jacket'],
      undefined
    );

    assert.equal(
      packageJson.scripts
        ?.['yellow-jacket:baseline'],
      undefined
    );

    assert.equal(
      packageJson.scripts
        ?.custom,
      'echo keep'
    );

    assert.equal(
      packageJson
        .devDependencies
        ?.['yellow-jacket'],
      undefined
    );

    assert.equal(
      await exists(
        join(
          directory,
          'yellow-jacket.config.mjs'
        )
      ),
      true
    );

    assert.equal(
      await exists(
        join(
          directory,
          '.yellow-jacket',
          'snapshots',
          'baseline.json'
        )
      ),
      true
    );

    assert.equal(
      result.packageManager,
      'npm'
    );
  }
);

test(
  'desetup purge removes configuration and Yellow Jacket state',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-purge-'
        )
      );

    t.after(
      async () => {
        await rm(
          directory,
          {
            recursive: true,
            force: true
          }
        );
      }
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
            '1.0.0'
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
      'export default {};\n',
      'utf8'
    );

    await mkdir(
      join(
        directory,
        '.yellow-jacket',
        'snapshots'
      ),
      {
        recursive: true
      }
    );

    await writeFile(
      join(
        directory,
        '.yellow-jacket',
        'snapshots',
        'baseline.json'
      ),
      '{}\n',
      'utf8'
    );

    await desetupProject(
      directory,
      {
        purge: true
      }
    );

    assert.equal(
      await exists(
        join(
          directory,
          'yellow-jacket.config.mjs'
        )
      ),
      false
    );

    assert.equal(
      await exists(
        join(
          directory,
          '.yellow-jacket'
        )
      ),
      false
    );
  }
);
