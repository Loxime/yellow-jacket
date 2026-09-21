import assert from 'node:assert/strict';

import {
  once
} from 'node:events';

import {
  createServer
} from 'node:http';

import test from 'node:test';

import {
  runSuite
} from '../src/core/runner.js';

import type {
  YellowJacketConfig
} from '../src/core/types.js';

test(
  'chains create read update and delete requests with captured variables',
  async (t) => {
    const requests:
      Array<{
        method: string;
        url: string;
        body: unknown;
      }> = [];

    const server =
      createServer(
        (
          request,
          response
        ) => {
          let rawBody = '';

          request.setEncoding(
            'utf8'
          );

          request.on(
            'data',
            (chunk: string) => {
              rawBody += chunk;
            }
          );

          request.on(
            'end',
            () => {
              const body =
                rawBody
                  ? JSON.parse(
                      rawBody
                    ) as unknown
                  : null;

              requests.push({
                method:
                  request.method ??
                  'GET',
                url:
                  request.url ??
                  '/',
                body
              });

              response.setHeader(
                'content-type',
                'application/json'
              );

              if (
                request.method ===
                  'POST' &&
                request.url ===
                  '/users'
              ) {
                response.statusCode =
                  201;

                response.end(
                  JSON.stringify({
                    id: 42,
                    name: 'Maxime'
                  })
                );

                return;
              }

              if (
                request.method ===
                  'GET' &&
                request.url ===
                  '/users/42'
              ) {
                response.statusCode =
                  200;

                response.end(
                  JSON.stringify({
                    id: 42,
                    name: 'Maxime'
                  })
                );

                return;
              }

              if (
                request.method ===
                  'PATCH' &&
                request.url ===
                  '/users/42'
              ) {
                response.statusCode =
                  200;

                response.end(
                  JSON.stringify({
                    id: 42,
                    name: 'Updated'
                  })
                );

                return;
              }

              if (
                request.method ===
                  'DELETE' &&
                request.url ===
                  '/users/42'
              ) {
                response.statusCode =
                  204;

                response.end();

                return;
              }

              response.statusCode =
                404;

              response.end(
                JSON.stringify({
                  error:
                    'not found'
                })
              );
            }
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

    const config:
      YellowJacketConfig = {
        baseUrl:
          `http://127.0.0.1:${address.port}`,

        scenarios: [
          {
            name:
              'user lifecycle',

            steps: [
              {
                name:
                  'create user',
                method:
                  'POST',
                path:
                  '/users',
                body: {
                  name:
                    'Maxime'
                },
                expect: {
                  status: 201
                },
                capture: {
                  userId:
                    '$.id'
                }
              },

              {
                name:
                  'read user',
                method:
                  'GET',
                path:
                  '/users/{{userId}}',
                expect: {
                  status: 200
                }
              },

              {
                name:
                  'update user',
                method:
                  'PATCH',
                path:
                  '/users/{{userId}}',
                body: {
                  id:
                    '{{userId}}',
                  reference:
                    'user-{{userId}}',
                  name:
                    'Updated'
                },
                expect: {
                  status: 200
                }
              },

              {
                name:
                  'delete user',
                method:
                  'DELETE',
                path:
                  '/users/{{userId}}',
                expect: {
                  status: 204
                }
              }
            ]
          }
        ]
      };

    const results =
      await runSuite(
        config
      );

    assert.equal(
      results.length,
      4
    );

    assert.equal(
      results.every(
        (result) =>
          result.passed
      ),
      true
    );

    assert.deepEqual(
      results.map(
        (result) =>
          result.route
      ),
      [
        'user lifecycle > create user',
        'user lifecycle > read user',
        'user lifecycle > update user',
        'user lifecycle > delete user'
      ]
    );

    assert.deepEqual(
      requests.map(
        (request) =>
          `${request.method} ${request.url}`
      ),
      [
        'POST /users',
        'GET /users/42',
        'PATCH /users/42',
        'DELETE /users/42'
      ]
    );

    assert.deepEqual(
      requests[2]?.body,
      {
        id: 42,
        reference:
          'user-42',
        name:
          'Updated'
      }
    );
  }
);

test(
  'stops a scenario when a capture cannot be resolved',
  async (t) => {
    let requestCount = 0;

    const server =
      createServer(
        (
          _request,
          response
        ) => {
          requestCount += 1;

          response.setHeader(
            'content-type',
            'application/json'
          );

          response.statusCode =
            200;

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

    const config:
      YellowJacketConfig = {
        baseUrl:
          `http://127.0.0.1:${address.port}`,

        scenarios: [
          {
            name:
              'broken capture',

            steps: [
              {
                name:
                  'create',
                path:
                  '/create',
                expect: {
                  status: 200
                },
                capture: {
                  userId:
                    '$.id'
                }
              },

              {
                name:
                  'must not run',
                path:
                  '/users/{{userId}}'
              }
            ]
          }
        ]
      };

    const results =
      await runSuite(
        config
      );

    assert.equal(
      requestCount,
      1
    );

    assert.equal(
      results.length,
      1
    );

    assert.equal(
      results[0]?.passed,
      false
    );

    assert.match(
      results[0]?.error ?? '',
      /Capture "userId" could not resolve "\$\.id"/
    );
  }
);
