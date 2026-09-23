#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  spawn
} from 'node:child_process';

import {
  once
} from 'node:events';

import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises';

import {
  createServer
} from 'node:http';

import {
  tmpdir
} from 'node:os';

import {
  dirname,
  join,
  resolve
} from 'node:path';

import {
  fileURLToPath
} from 'node:url';

const ROOT =
  resolve(
    dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    '..'
  );

const NPM =
  process.platform ===
    'win32'
    ? 'npm.cmd'
    : 'npm';

function run(
  command,
  args,
  cwd
) {
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

            env: {
              ...process.env,

              npm_config_audit:
                'false',

              npm_config_fund:
                'false',

              npm_config_update_notifier:
                'false'
            },

            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        );

      let stdout =
        '';

      let stderr =
        '';

      child.stdout.setEncoding(
        'utf8'
      );

      child.stderr.setEncoding(
        'utf8'
      );

      child.stdout.on(
        'data',
        (chunk) => {
          stdout +=
            chunk;
        }
      );

      child.stderr.on(
        'data',
        (chunk) => {
          stderr +=
            chunk;
        }
      );

      child.once(
        'error',
        reject
      );

      child.once(
        'close',
        (code) => {
          const result = {
            code:
              code ?? 1,
            stdout,
            stderr
          };

          if (
            result.code !==
              0
          ) {
            reject(
              new Error(
                [
                  `${command} ${args.join(' ')} exited with code ${result.code}.`,
                  '',
                  result.stdout,
                  result.stderr
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    '\n'
                  )
              )
            );

            return;
          }

          resolvePromise(
            result
          );
        }
      );
    }
  );
}

async function closeServer(
  server
) {
  if (
    !server.listening
  ) {
    return;
  }

  await new Promise(
    (
      resolvePromise,
      reject
    ) => {
      server.close(
        (error) => {
          if (
            error
          ) {
            reject(
              error
            );

            return;
          }

          resolvePromise();
        }
      );
    }
  );
}

const temporaryRoot =
  await mkdtemp(
    join(
      tmpdir(),
      'yellow-jacket-package-smoke-'
    )
  );

const packDirectory =
  join(
    temporaryRoot,
    'pack'
  );

const consumerDirectory =
  join(
    temporaryRoot,
    'consumer'
  );

let server =
  null;

try {
  await mkdir(
    packDirectory,
    {
      recursive:
        true
    }
  );

  await mkdir(
    consumerDirectory,
    {
      recursive:
        true
    }
  );

  const sourcePackage =
    JSON.parse(
      await readFile(
        join(
          ROOT,
          'package.json'
        ),
        'utf8'
      )
    );

  console.log(
    `Packing ${sourcePackage.name}@${sourcePackage.version}...`
  );

  await run(
    NPM,
    [
      'pack',
      '--pack-destination',
      packDirectory
    ],
    ROOT
  );

  const tarballs =
    (
      await readdir(
        packDirectory
      )
    ).filter(
      (name) =>
        name.endsWith(
          '.tgz'
        )
    );

  assert.equal(
    tarballs.length,
    1,
    'npm pack should produce exactly one tarball'
  );

  const tarballPath =
    join(
      packDirectory,
      tarballs[0]
    );

  await writeFile(
    join(
      consumerDirectory,
      'package.json'
    ),
    `${JSON.stringify(
      {
        name:
          'yellow-jacket-package-smoke',
        private:
          true,
        type:
          'module'
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(
    'Installing packed tarball in a clean consumer project...'
  );

  await run(
    NPM,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefer-offline',
      tarballPath
    ],
    consumerDirectory
  );

  const installedRoot =
    join(
      consumerDirectory,
      'node_modules',
      '@falche',
      'yellow-jacket'
    );

  const installedPackage =
    JSON.parse(
      await readFile(
        join(
          installedRoot,
          'package.json'
        ),
        'utf8'
      )
    );

  assert.equal(
    installedPackage.name,
    '@falche/yellow-jacket'
  );

  assert.equal(
    installedPackage.version,
    sourcePackage.version
  );

  await access(
    join(
      installedRoot,
      'dist',
      'src',
      'index.js'
    )
  );

  await access(
    join(
      installedRoot,
      'dist',
      'src',
      'index.d.ts'
    )
  );

  await access(
    join(
      installedRoot,
      'dist',
      'src',
      'cli.js'
    )
  );

  const binName =
    process.platform ===
      'win32'
      ? 'yellow-jacket.cmd'
      : 'yellow-jacket';

  await access(
    join(
      consumerDirectory,
      'node_modules',
      '.bin',
      binName
    )
  );

  const publicApiSmoke =
    join(
      consumerDirectory,
      'public-api-smoke.mjs'
    );

  await writeFile(
    publicApiSmoke,
    `import {
  calculateEffectiveRetryDelay,
  calculateRetryDelay,
  defineConfig,
  parseRetryAfter,
  runSuite
} from '@falche/yellow-jacket';

const api = {
  calculateEffectiveRetryDelay,
  calculateRetryDelay,
  defineConfig,
  parseRetryAfter,
  runSuite
};

for (const [name, value] of Object.entries(api)) {
  if (typeof value !== 'function') {
    throw new Error(
      \`Expected \${name} to be a function, received \${typeof value}.\`
    );
  }
}

console.log(
  Object.keys(api).join(',')
);
`,
    'utf8'
  );

  console.log(
    'Checking public package exports...'
  );

  const apiResult =
    await run(
      process.execPath,
      [
        publicApiSmoke
      ],
      consumerDirectory
    );

  for (
    const name
    of [
      'calculateEffectiveRetryDelay',
      'calculateRetryDelay',
      'defineConfig',
      'parseRetryAfter',
      'runSuite'
    ]
  ) {
    assert.match(
      apiResult.stdout,
      new RegExp(
        name
      )
    );
  }

  console.log(
    'Checking installed CLI binary...'
  );

  const helpResult =
    await run(
      NPM,
      [
        'exec',
        '--offline',
        '--',
        'yellow-jacket',
        '--help'
      ],
      consumerDirectory
    );

  assert.match(
    helpResult.stdout,
    /yellow-jacket/
  );

  assert.match(
    helpResult.stdout,
    /Usage:/
  );

  server =
    createServer(
      (
        request,
        response
      ) => {
        if (
          request.url !==
            '/health'
        ) {
          response.statusCode =
            404;

          response.end(
            'not found'
          );

          return;
        }

        response.setHeader(
          'content-type',
          'application/json'
        );

        response.end(
          JSON.stringify({
            ok:
              true
          })
        );
      }
    );

  server.listen(
    0,
    '127.0.0.1'
  );

  await once(
    server,
    'listening'
  );

  const address =
    server.address();

  assert.ok(
    address &&
    typeof address ===
      'object'
  );

  await writeFile(
    join(
      consumerDirectory,
      'yellow-jacket.config.mjs'
    ),
    `import {
  defineConfig
} from '@falche/yellow-jacket';

export default defineConfig({
  baseUrl:
    'http://127.0.0.1:${address.port}',

  routes: [
    {
      name:
        'health',

      path:
        '/health',

      expect: {
        status:
          200,

        contentType:
          'application/json'
      }
    }
  ]
});
`,
    'utf8'
  );

  console.log(
    'Creating a baseline through the packed CLI...'
  );

  const baselineResult =
    await run(
      NPM,
      [
        'exec',
        '--offline',
        '--',
        'yellow-jacket',
        'baseline'
      ],
      consumerDirectory
    );

  assert.match(
    baselineResult.stdout,
    /Baseline written/
  );

  const baseline =
    JSON.parse(
      await readFile(
        join(
          consumerDirectory,
          '.yellow-jacket',
          'snapshots',
          'baseline.json'
        ),
        'utf8'
      )
    );

  assert.equal(
    baseline.formatVersion,
    1
  );

  assert.equal(
    baseline.responses.length,
    1
  );

  assert.equal(
    baseline.responses[0]?.route,
    'health'
  );

  console.log(
    'Running regression comparison through the packed CLI...'
  );

  const runResult =
    await run(
      NPM,
      [
        'exec',
        '--offline',
        '--',
        'yellow-jacket',
        'run'
      ],
      consumerDirectory
    );

  assert.match(
    runResult.stdout,
    /✓ GET\s+health/
  );

  console.log(
    `Package smoke passed for ${sourcePackage.name}@${sourcePackage.version}.`
  );
} finally {
  if (
    server
  ) {
    await closeServer(
      server
    );
  }

  await rm(
    temporaryRoot,
    {
      recursive:
        true,
      force:
        true
    }
  );
}
