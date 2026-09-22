import assert from 'node:assert/strict';

import {
  createServer
} from 'node:http';

import {
  once
} from 'node:events';

import {
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';

import {
  join
} from 'node:path';

import {
  tmpdir
} from 'node:os';

import test from 'node:test';

import {
  loadConfig
} from '../src/core/config.js';

import {
  runRoute,
  runSuite
} from '../src/core/runner.js';

test(
  'supports exact response header expectations',
  async (t) => {
    const server =
      createServer(
        (
          _request,
          response
        ) => {
          response.setHeader(
            'x-api-version',
            '2'
          );

          response.end(
            'ok'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const passing =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`
        },
        {
          path:
            '/',
          expect: {
            headers: {
              'x-api-version':
                '2'
            }
          }
        }
      );

    assert.equal(
      passing.passed,
      true
    );

    const failing =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`
        },
        {
          path:
            '/',
          expect: {
            headers: {
              'x-api-version':
                '3'
            }
          }
        }
      );

    assert.equal(
      failing.passed,
      false
    );

    assert.match(
      failing.error ??
        '',
      /Expected header x-api-version "3", received "2"/
    );
  }
);

test(
  'accepts one of multiple expected response header values',
  async (t) => {
    const server =
      createServer(
        (
          _request,
          response
        ) => {
          response.setHeader(
            'cache-control',
            'no-store'
          );

          response.end(
            'ok'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`
        },
        {
          path:
            '/',
          expect: {
            headers: {
              'cache-control': [
                'no-cache',
                'no-store'
              ]
            }
          }
        }
      );

    assert.equal(
      result.passed,
      true
    );
  }
);

test(
  'retries safe requests on configured transient statuses',
  async (t) => {
    let requests =
      0;

    const server =
      createServer(
        (
          _request,
          response
        ) => {
          requests +=
            1;

          if (
            requests ===
              1
          ) {
            response.statusCode =
              503;

            response.end(
              'retry'
            );

            return;
          }

          response.statusCode =
            200;

          response.end(
            'ok'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`,

          retries: {
            maxAttempts:
              2
          }
        },
        {
          path:
            '/',
          expect: {
            status:
              200
          }
        }
      );

    assert.equal(
      requests,
      2
    );

    assert.equal(
      result.attempts,
      2
    );

    assert.equal(
      result.passed,
      true
    );
  }
);

test(
  'does not retry mutating requests by default',
  async (t) => {
    let requests =
      0;

    const server =
      createServer(
        (
          _request,
          response
        ) => {
          requests +=
            1;

          response.statusCode =
            503;

          response.end(
            'retry'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`,

          retries: {
            maxAttempts:
              3
          }
        },
        {
          method:
            'POST',

          path:
            '/',

          expect: {
            status:
              201
          }
        }
      );

    assert.equal(
      requests,
      1
    );

    assert.equal(
      result.passed,
      false
    );
  }
);

test(
  'retries mutating requests only when explicitly enabled',
  async (t) => {
    let requests =
      0;

    const server =
      createServer(
        (
          _request,
          response
        ) => {
          requests +=
            1;

          if (
            requests ===
              1
          ) {
            response.statusCode =
              503;

            response.end(
              'retry'
            );

            return;
          }

          response.statusCode =
            201;

          response.end(
            'created'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`
        },
        {
          method:
            'POST',

          path:
            '/',

          retry: {
            maxAttempts:
              2,

            retryActions:
              true
          },

          expect: {
            status:
              201
          }
        }
      );

    assert.equal(
      requests,
      2
    );

    assert.equal(
      result.passed,
      true
    );
  }
);

test(
  'limits concurrency while preserving configured result order',
  async (t) => {
    let active =
      0;

    let maxActive =
      0;

    const server =
      createServer(
        async (
          _request,
          response
        ) => {
          active +=
            1;

          maxActive =
            Math.max(
              maxActive,
              active
            );

          await new Promise<void>(
            (
              resolvePromise
            ) => {
              setTimeout(
                resolvePromise,
                40
              );
            }
          );

          active -=
            1;

          response.end(
            'ok'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const results =
      await runSuite({
        baseUrl:
          `http://127.0.0.1:${address.port}`,

        concurrency:
          2,

        routes: [
          {
            name:
              'first',
            path:
              '/first'
          },
          {
            name:
              'second',
            path:
              '/second'
          },
          {
            name:
              'third',
            path:
              '/third'
          }
        ]
      });

    assert.equal(
      maxActive,
      2
    );

    assert.deepEqual(
      results.map(
        (result) =>
          result.route
      ),
      [
        'first',
        'second',
        'third'
      ]
    );
  }
);

test(
  'rejects invalid resilience configuration',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-resilience-config-'
        )
      );

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
  concurrency: 0,
  routes: []
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          directory
        ),
      /concurrency must be a positive integer/
    );
  }
);

test(
  'rejects invalid retry configuration',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-retry-config-'
        )
      );

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
  retries: {
    maxAttempts: 0
  },
  routes: []
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          directory
        ),
      /retry\.maxAttempts must be a positive integer/
    );
  }
);

test(
  'retries transient statuses when no status expectation is configured',
  async (t) => {
    let requests =
      0;

    const server =
      createServer(
        (
          _request,
          response
        ) => {
          requests +=
            1;

          if (
            requests ===
              1
          ) {
            response.statusCode =
              503;

            response.end(
              'retry'
            );

            return;
          }

          response.statusCode =
            200;

          response.end(
            'ok'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`,

          retries: {
            maxAttempts:
              2
          }
        },
        {
          path:
            '/'
        }
      );

    assert.equal(
      requests,
      2
    );

    assert.equal(
      result.status,
      200
    );

    assert.equal(
      result.passed,
      true
    );
  }
);

test(
  'does not retry a transient status explicitly accepted by expectations',
  async (t) => {
    let requests =
      0;

    const server =
      createServer(
        (
          _request,
          response
        ) => {
          requests +=
            1;

          response.statusCode =
            503;

          response.end(
            'accepted'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`,

          retries: {
            maxAttempts:
              3
          }
        },
        {
          path:
            '/',

          expect: {
            status: [
              200,
              503
            ]
          }
        }
      );

    assert.equal(
      requests,
      1
    );

    assert.equal(
      result.status,
      503
    );

    assert.equal(
      result.passed,
      true
    );
  }
);

test(
  'does not treat a missing header as an empty expected header value',
  async (t) => {
    const server =
      createServer(
        (
          _request,
          response
        ) => {
          response.end(
            'ok'
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

    t.after(
      () => {
        server.close();
      }
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address ===
        'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`
        },
        {
          path:
            '/',

          expect: {
            headers: {
              'x-empty':
                ''
            }
          }
        }
      );

    assert.equal(
      result.passed,
      false
    );

    assert.match(
      result.error ??
        '',
      /Expected header x-empty "", received null/
    );
  }
);
