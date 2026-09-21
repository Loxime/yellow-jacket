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
        'http://api.local:3000'
      ),
      true
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
