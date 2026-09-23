import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { compareWithBaseline } from '../src/core/baseline.js';
import {
  isSafeActionTarget,
  runRoute,
  runSuite
} from '../src/core/runner.js';
import type { BaselineFile, YellowJacketConfig } from '../src/core/types.js';

test('runs GET and POST routes with expectations', async (t) => {
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.method === 'POST') {
      response.statusCode = 201;
      response.end(JSON.stringify({ created: true }));
      return;
    }
    response.statusCode = 200;
    response.end(JSON.stringify({ ok: true }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const config: YellowJacketConfig = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    routes: [
      { name: 'home', path: '/', expect: { status: 200 } },
      { name: 'create', method: 'POST', path: '/items', body: { name: 'A' }, expect: { status: 201 } }
    ]
  };

  const results = await runSuite(config);
  assert.equal(results.length, 2);
  assert.equal(results[0]?.passed, true);
  assert.deepEqual(results[0]?.body, { ok: true });
  assert.equal(results[1]?.status, 201);
});

test('detects status and body regressions', () => {
  const baseline: BaselineFile = {
    formatVersion: 1,
    createdAt: new Date(0).toISOString(),
    baseUrl: 'http://localhost',
    responses: [
      {
        route: 'users',
        method: 'GET',
        url: 'http://localhost/users',
        status: 200,
        contentType: 'application/json',
        body: { count: 1 },
        durationMs: 10
      }
    ]
  };

  const regressions = compareWithBaseline(baseline, [
    {
      route: 'users',
      method: 'GET',
      url: 'http://localhost/users',
      status: 500,
      contentType: 'application/json',
      body: { count: 0 },
      durationMs: 12,
      passed: true
    }
  ]);

  assert.equal(regressions.length, 1);
  assert.deepEqual(regressions[0]?.changes, ['status 200 -> 500', 'response body changed']);
});

test(
  'recognizes local action targets',
  () => {
    assert.equal(
      isSafeActionTarget(
        'http://localhost:3000'
      ),
      true
    );

    assert.equal(
      isSafeActionTarget(
        'http://api.localhost:3000'
      ),
      true
    );

    assert.equal(
      isSafeActionTarget(
        'http://api.local:3000'
      ),
      false
    );

    assert.equal(
      isSafeActionTarget(
        'http://127.42.0.1:3000'
      ),
      true
    );

    assert.equal(
      isSafeActionTarget(
        'http://[::1]:3000'
      ),
      true
    );

    assert.equal(
      isSafeActionTarget(
        'https://staging.example.com'
      ),
      false
    );

    assert.equal(
      isSafeActionTarget(
        'http://0.0.0.0:3000'
      ),
      false
    );
  }
);

test(
  'blocks mutating requests to non-local targets before fetch',
  async (t) => {
    const originalFetch =
      globalThis.fetch;

    let fetchCalled =
      false;

    globalThis.fetch =
      (async () => {
        fetchCalled = true;

        return new Response(
          '{}',
          {
            status: 200,
            headers: {
              'content-type':
                'application/json'
            }
          }
        );
      }) as typeof fetch;

    t.after(
      () => {
        globalThis.fetch =
          originalFetch;
      }
    );

    const result =
      await runRoute(
        {
          baseUrl:
            'https://api.example.test',

          routes: []
        },
        {
          name:
            'create user',
          method:
            'POST',
          path:
            '/users'
        }
      );

    assert.equal(
      fetchCalled,
      false
    );

    assert.equal(
      result.passed,
      false
    );

    assert.equal(
      result.status,
      0
    );

    assert.match(
      result.error ?? '',
      /Blocked POST request/
    );

    assert.match(
      result.error ?? '',
      /--allow-actions/
    );
  }
);

test(
  'blocks mutating redirects before they leave loopback targets',
  async (t) => {
    const originalFetch =
      globalThis.fetch;

    const calls:
      Array<{
        url: string;
        method:
          string | undefined;
        redirect:
          RequestRedirect | undefined;
      }> = [];

    globalThis.fetch =
      (async (
        input:
          string | URL | Request,
        init?:
          RequestInit
      ) => {
        calls.push({
          url:
            String(
              input
            ),
          method:
            init?.method,
          redirect:
            init?.redirect
        });

        return new Response(
          null,
          {
            status:
              307,

            headers: {
              location:
                'https://api.example.test/users'
            }
          }
        );
      }) as typeof fetch;

    t.after(
      () => {
        globalThis.fetch =
          originalFetch;
      }
    );

    const result =
      await runRoute(
        {
          baseUrl:
            'http://localhost:3000',

          retries: {
            maxAttempts:
              3,

            retryActions:
              true
          }
        },
        {
          name:
            'create user',
          method:
            'POST',
          path:
            '/start',
          body: {
            name:
              'Yellow Jacket'
          }
        }
      );

    assert.equal(
      calls.length,
      1
    );

    assert.equal(
      calls[0]?.method,
      'POST'
    );

    assert.equal(
      calls[0]?.redirect,
      'manual'
    );

    assert.equal(
      result.passed,
      false
    );

    assert.equal(
      result.attempts,
      1
    );

    assert.match(
      result.error ?? '',
      /Blocked POST redirect/
    );

    assert.match(
      result.error ?? '',
      /api\.example\.test/
    );

    assert.match(
      result.error ?? '',
      /--allow-actions/
    );
  }
);

test(
  'preserves mutating methods across safe 307 redirects',
  async (t) => {
    const originalFetch =
      globalThis.fetch;

    const calls:
      Array<{
        url: string;
        method:
          string | undefined;
        body:
          BodyInit | null | undefined;
        redirect:
          RequestRedirect | undefined;
      }> = [];

    globalThis.fetch =
      (async (
        input:
          string | URL | Request,
        init?:
          RequestInit
      ) => {
        calls.push({
          url:
            String(
              input
            ),
          method:
            init?.method,
          body:
            init?.body,
          redirect:
            init?.redirect
        });

        if (
          calls.length ===
            1
        ) {
          return new Response(
            null,
            {
              status:
                307,

              headers: {
                location:
                  'http://127.0.0.1:4000/created'
              }
            }
          );
        }

        return new Response(
          JSON.stringify({
            created:
              true
          }),
          {
            status:
              201,

            headers: {
              'content-type':
                'application/json'
            }
          }
        );
      }) as typeof fetch;

    t.after(
      () => {
        globalThis.fetch =
          originalFetch;
      }
    );

    const result =
      await runRoute(
        {
          baseUrl:
            'http://localhost:3000'
        },
        {
          method:
            'POST',
          path:
            '/start',
          body: {
            name:
              'Yellow Jacket'
          },
          expect: {
            status:
              201
          }
        }
      );

    assert.equal(
      calls.length,
      2
    );

    assert.deepEqual(
      calls.map(
        (call) =>
          call.method
      ),
      [
        'POST',
        'POST'
      ]
    );

    assert.deepEqual(
      calls.map(
        (call) =>
          call.redirect
      ),
      [
        'manual',
        'manual'
      ]
    );

    assert.equal(
      calls[1]?.body,
      JSON.stringify({
        name:
          'Yellow Jacket'
      })
    );

    assert.equal(
      result.passed,
      true
    );

    assert.equal(
      result.redirected,
      true
    );

    assert.equal(
      result.finalUrl,
      'http://127.0.0.1:4000/created'
    );
  }
);

test(
  'rewrites POST to GET before following a 302 redirect',
  async (t) => {
    const originalFetch =
      globalThis.fetch;

    const calls:
      Array<{
        method:
          string | undefined;
        body:
          BodyInit | null | undefined;
        contentType:
          string | null;
        redirect:
          RequestRedirect | undefined;
      }> = [];

    globalThis.fetch =
      (async (
        _input:
          string | URL | Request,
        init?:
          RequestInit
      ) => {
        const requestHeaders =
          new Headers(
            init?.headers
          );

        calls.push({
          method:
            init?.method,
          body:
            init?.body,
          contentType:
            requestHeaders.get(
              'content-type'
            ),
          redirect:
            init?.redirect
        });

        if (
          calls.length ===
            1
        ) {
          return new Response(
            null,
            {
              status:
                302,

              headers: {
                location:
                  'https://example.test/result'
              }
            }
          );
        }

        return new Response(
          'ok',
          {
            status:
              200,

            headers: {
              'content-type':
                'text/plain'
            }
          }
        );
      }) as typeof fetch;

    t.after(
      () => {
        globalThis.fetch =
          originalFetch;
      }
    );

    const result =
      await runRoute(
        {
          baseUrl:
            'http://localhost:3000'
        },
        {
          method:
            'POST',
          path:
            '/submit',
          body: {
            value:
              1
          },
          expect: {
            status:
              200
          }
        }
      );

    assert.equal(
      calls.length,
      2
    );

    assert.equal(
      calls[0]?.method,
      'POST'
    );

    assert.equal(
      calls[0]?.redirect,
      'manual'
    );

    assert.equal(
      calls[1]?.method,
      'GET'
    );

    assert.equal(
      calls[1]?.body,
      undefined
    );

    assert.equal(
      calls[1]?.contentType,
      null
    );

    assert.equal(
      calls[1]?.redirect,
      'follow'
    );

    assert.equal(
      result.passed,
      true
    );

    assert.equal(
      result.redirected,
      true
    );

    assert.equal(
      result.finalUrl,
      'https://example.test/result'
    );
  }
);

test(
  'allows explicitly authorized mutating requests',
  async (t) => {
    const originalFetch =
      globalThis.fetch;

    let fetchCalled =
      false;

    globalThis.fetch =
      (async () => {
        fetchCalled = true;

        return new Response(
          JSON.stringify({
            created: true
          }),
          {
            status: 201,
            headers: {
              'content-type':
                'application/json'
            }
          }
        );
      }) as typeof fetch;

    t.after(
      () => {
        globalThis.fetch =
          originalFetch;
      }
    );

    const result =
      await runRoute(
        {
          baseUrl:
            'https://staging.example.test',

          routes: []
        },
        {
          name:
            'create user',
          method:
            'POST',
          path:
            '/users',
          expect: {
            status: 201
          }
        },
        {
          allowActions: true
        }
      );

    assert.equal(
      fetchCalled,
      true
    );

    assert.equal(
      result.passed,
      true
    );

    assert.equal(
      result.status,
      201
    );
  }
);

test(
  'captures configured response headers',
  async (t) => {
    const server =
      createServer(
        (_request, response) => {
          response.setHeader(
            'x-api-version',
            '2'
          );

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
      () => server.close()
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address === 'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`,

          compare: {
            headers: [
              'X-API-Version',
              'cache-control'
            ]
          }
        },
        {
          path:
            '/'
        }
      );

    assert.deepEqual(
      result.responseHeaders,
      {
        'x-api-version':
          '2',
        'cache-control':
          'no-store'
      }
    );

    assert.equal(
      result.redirected,
      false
    );

    assert.match(
      result.finalUrl ?? '',
      /127\.0\.0\.1/
    );
  }
);

test(
  'detects configured response header regressions',
  () => {
    const baseline:
      BaselineFile = {
        formatVersion: 1,
        createdAt:
          new Date(0)
            .toISOString(),
        baseUrl:
          'http://localhost',

        responses: [
          {
            route:
              'users',
            method:
              'GET',
            url:
              'http://localhost/users',
            status:
              200,
            contentType:
              'application/json',
            body: {
              ok: true
            },
            durationMs:
              10,

            responseHeaders: {
              'x-api-version':
                '1'
            }
          }
        ]
      };

    const regressions =
      compareWithBaseline(
        baseline,
        [
          {
            route:
              'users',
            method:
              'GET',
            url:
              'http://localhost/users',
            status:
              200,
            contentType:
              'application/json',
            body: {
              ok: true
            },
            durationMs:
              12,
            passed:
              true,

            responseHeaders: {
              'x-api-version':
                '2'
            }
          }
        ],
        {
          headers: [
            'X-API-Version'
          ]
        }
      );

    assert.deepEqual(
      regressions[0]?.changes,
      [
        'header x-api-version "1" -> "2"'
      ]
    );
  }
);

test(
  'follows redirects and records the final URL',
  async (t) => {
    const server =
      createServer(
        (request, response) => {
          if (
            request.url ===
            '/old'
          ) {
            response.statusCode =
              302;

            response.setHeader(
              'location',
              '/new'
            );

            response.end();
            return;
          }

          response.statusCode =
            200;

          response.end(
            'new'
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
      () => server.close()
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address === 'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`,

          compare: {
            redirects:
              true
          }
        },
        {
          path:
            '/old'
        }
      );

    assert.equal(
      result.status,
      200
    );

    assert.equal(
      result.redirected,
      true
    );

    assert.match(
      result.finalUrl ?? '',
      /\/new$/
    );
  }
);

test(
  'supports manual redirect inspection',
  async (t) => {
    const server =
      createServer(
        (_request, response) => {
          response.statusCode =
            302;

          response.setHeader(
            'location',
            '/login'
          );

          response.end();
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
      () => server.close()
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address === 'object'
    );

    const result =
      await runRoute(
        {
          baseUrl:
            `http://127.0.0.1:${address.port}`,

          compare: {
            redirects:
              true
          }
        },
        {
          name:
            'login redirect',

          path:
            '/private',

          redirect:
            'manual',

          expect: {
            status:
              302
          }
        }
      );

    assert.equal(
      result.passed,
      true
    );

    assert.equal(
      result.status,
      302
    );

    assert.equal(
      result.redirected,
      false
    );

    assert.equal(
      result
        .responseHeaders
        ?.location,
      '/login'
    );
  }
);

test(
  'detects redirect destination regressions',
  () => {
    const baseline:
      BaselineFile = {
        formatVersion:
          1,

        createdAt:
          new Date(0)
            .toISOString(),

        baseUrl:
          'http://localhost',

        responses: [
          {
            route:
              'legacy',
            method:
              'GET',
            url:
              'http://localhost/legacy',
            status:
              200,
            contentType:
              'text/plain',
            body:
              'ok',
            durationMs:
              10,
            redirected:
              true,
            finalUrl:
              'http://localhost/v1'
          }
        ]
      };

    const regressions =
      compareWithBaseline(
        baseline,
        [
          {
            route:
              'legacy',
            method:
              'GET',
            url:
              'http://localhost/legacy',
            status:
              200,
            contentType:
              'text/plain',
            body:
              'ok',
            durationMs:
              12,
            passed:
              true,
            redirected:
              true,
            finalUrl:
              'http://localhost/v2'
          }
        ],
        {
          redirects:
            true
        }
      );

    assert.deepEqual(
      regressions[0]?.changes,
      [
        'final URL http://localhost/v1 -> http://localhost/v2'
      ]
    );
  }
);

test(
  'accepts normalized expected response content types',
  async (t) => {
    const server =
      createServer(
        (_request, response) => {
          response.setHeader(
            'content-type',
            'Application/JSON; charset=utf-8'
          );

          response.end(
            JSON.stringify({
              ok: true
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

    t.after(
      () => server.close()
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
            contentType: [
              'text/html',
              'application/json'
            ]
          }
        }
      );

    assert.equal(
      result.passed,
      true
    );

    assert.deepEqual(
      result.body,
      {
        ok: true
      }
    );
  }
);

test(
  'fails when the response content type does not match',
  async (t) => {
    const server =
      createServer(
        (_request, response) => {
          response.setHeader(
            'content-type',
            'text/plain; charset=utf-8'
          );

          response.end(
            'hello'
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
      () => server.close()
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
            contentType:
              'application/json'
          }
        }
      );

    assert.equal(
      result.passed,
      false
    );

    assert.match(
      result.error ?? '',
      /Expected content-type application\/json, received text\/plain/
    );
  }
);

test(
  'fails when a response exceeds its duration budget',
  async (t) => {
    const server =
      createServer(
        async (
          _request,
          response
        ) => {
          await new Promise<void>(
            (resolvePromise) => {
              setTimeout(
                resolvePromise,
                40
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
      () => server.close()
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
            maxDurationMs:
              5
          }
        }
      );

    assert.equal(
      result.passed,
      false
    );

    assert.match(
      result.error ?? '',
      /Expected response within 5ms/
    );

    assert.ok(
      result.durationMs >
      5
    );
  }
);
