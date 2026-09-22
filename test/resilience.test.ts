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

test(
  'calculates fixed and exponential retry delays with jitter',
  async () => {
    const {
      calculateRetryDelay
    } =
      await import(
        '../src/core/runner.js'
      );

    assert.equal(
      calculateRetryDelay(
        100,
        'fixed',
        0,
        3,
        0.5
      ),
      100
    );

    assert.equal(
      calculateRetryDelay(
        100,
        'exponential',
        0,
        1,
        0.5
      ),
      100
    );

    assert.equal(
      calculateRetryDelay(
        100,
        'exponential',
        0,
        2,
        0.5
      ),
      200
    );

    assert.equal(
      calculateRetryDelay(
        100,
        'exponential',
        0,
        3,
        0.5
      ),
      400
    );

    assert.equal(
      calculateRetryDelay(
        100,
        'exponential',
        50,
        2,
        0.5
      ),
      225
    );
  }
);

test(
  'rejects invalid retry backoff and jitter configuration',
  async (t) => {
    const backoffDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-retry-backoff-config-'
        )
      );

    const jitterDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-retry-jitter-config-'
        )
      );

    t.after(
      async () => {
        await rm(
          backoffDirectory,
          {
            recursive:
              true,
            force:
              true
          }
        );

        await rm(
          jitterDirectory,
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
        backoffDirectory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  retries: {
    backoff: 'linear'
  },
  routes: []
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          backoffDirectory
        ),
      /retry\.backoff must be "fixed" or "exponential"/
    );

    await writeFile(
      join(
        jitterDirectory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  retries: {
    jitterMs: -1
  },
  routes: []
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          jitterDirectory
        ),
      /retry\.jitterMs must be a non-negative finite number/
    );
  }
);

test(
  'parses Retry-After seconds and HTTP dates',
  async () => {
    const {
      parseRetryAfter
    } =
      await import(
        '../src/core/runner.js'
      );

    const now =
      Date.UTC(
        2026,
        8,
        22,
        12,
        0,
        0
      );

    assert.equal(
      parseRetryAfter(
        '3',
        now
      ),
      3_000
    );

    assert.equal(
      parseRetryAfter(
        new Date(
          now +
          5_000
        ).toUTCString(),
        now
      ),
      5_000
    );

    assert.equal(
      parseRetryAfter(
        new Date(
          now -
          5_000
        ).toUTCString(),
        now
      ),
      0
    );

    assert.equal(
      parseRetryAfter(
        '1.5',
        now
      ),
      undefined
    );

    assert.equal(
      parseRetryAfter(
        'not-a-date',
        now
      ),
      undefined
    );

    assert.equal(
      parseRetryAfter(
        null,
        now
      ),
      undefined
    );
  }
);

test(
  'combines local retry delay with Retry-After and a maximum',
  async () => {
    const {
      calculateEffectiveRetryDelay
    } =
      await import(
        '../src/core/runner.js'
      );

    assert.equal(
      calculateEffectiveRetryDelay(
        100,
        'exponential',
        0,
        2,
        500,
        undefined,
        0
      ),
      500
    );

    assert.equal(
      calculateEffectiveRetryDelay(
        100,
        'exponential',
        0,
        2,
        50,
        undefined,
        0
      ),
      200
    );

    assert.equal(
      calculateEffectiveRetryDelay(
        100,
        'exponential',
        0,
        2,
        500,
        300,
        0
      ),
      300
    );

    assert.equal(
      calculateEffectiveRetryDelay(
        100,
        'exponential',
        0,
        3,
        undefined,
        250,
        0
      ),
      250
    );
  }
);

test(
  'rejects invalid Retry-After retry configuration',
  async (t) => {
    const retryAfterDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-retry-after-config-'
        )
      );

    const maximumDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-retry-maximum-config-'
        )
      );

    t.after(
      async () => {
        await rm(
          retryAfterDirectory,
          {
            recursive:
              true,
            force:
              true
          }
        );

        await rm(
          maximumDirectory,
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
        retryAfterDirectory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  retries: {
    respectRetryAfter: 'yes'
  },
  routes: []
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          retryAfterDirectory
        ),
      /retry\.respectRetryAfter must be a boolean/
    );

    await writeFile(
      join(
        maximumDirectory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  retries: {
    maxRetryDelayMs: -1
  },
  routes: []
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          maximumDirectory
        ),
      /retry\.maxRetryDelayMs must be a non-negative finite number/
    );
  }
);

test(
  'supports per-route timeout overrides',
  async (t) => {
    const server =
      createServer(
        async (
          _request,
          response
        ) => {
          await new Promise<void>(
            (
              resolvePromise
            ) => {
              setTimeout(
                resolvePromise,
                60
              );
            }
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

    const baseUrl =
      `http://127.0.0.1:${address.port}`;

    const locallyExtended =
      await runRoute(
        {
          baseUrl,
          timeoutMs:
            10
        },
        {
          path:
            '/',
          timeoutMs:
            500
        }
      );

    assert.equal(
      locallyExtended.passed,
      true
    );

    const locallyReduced =
      await runRoute(
        {
          baseUrl,
          timeoutMs:
            500
        },
        {
          path:
            '/',
          timeoutMs:
            10
        }
      );

    assert.equal(
      locallyReduced.passed,
      false
    );

    assert.equal(
      locallyReduced.status,
      0
    );

    assert.equal(
      locallyReduced.attempts,
      1
    );
  }
);

test(
  'rejects invalid global and scenario timeout configuration',
  async (t) => {
    const globalDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-global-timeout-config-'
        )
      );

    const scenarioDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-scenario-timeout-config-'
        )
      );

    t.after(
      async () => {
        await rm(
          globalDirectory,
          {
            recursive:
              true,
            force:
              true
          }
        );

        await rm(
          scenarioDirectory,
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
        globalDirectory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  timeoutMs: 0,
  routes: []
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          globalDirectory
        ),
      /timeoutMs must be a positive finite number/
    );

    await writeFile(
      join(
        scenarioDirectory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  scenarios: [
    {
      name: 'slow workflow',
      steps: [
        {
          path: '/slow',
          timeoutMs: -1
        }
      ]
    }
  ]
};
`,
      'utf8'
    );

    await assert.rejects(
      () =>
        loadConfig(
          scenarioDirectory
        ),
      /timeoutMs must be a positive finite number/
    );
  }
);
