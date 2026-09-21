import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { compareWithBaseline } from '../src/core/baseline.js';
import { runSuite } from '../src/core/runner.js';
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
