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

import test from 'node:test';

import {
  buildCoverageReport,
  normalizeCoveragePath
} from '../src/core/coverage.js';

import type {
  YellowJacketConfig
} from '../src/core/types.js';

test(
  'matches routes and scenario steps against OpenAPI operations',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-coverage-'
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
        'openapi.json'
      ),
      JSON.stringify(
        {
          openapi:
            '3.1.0',

          info: {
            title:
              'Test API',
            version:
              '1.0.0'
          },

          paths: {
            '/users': {
              get: {
                responses: {}
              },
              post: {
                responses: {}
              }
            },

            '/users/{id}': {
              get: {
                responses: {}
              },
              patch: {
                responses: {}
              },
              delete: {
                responses: {}
              },

              parameters: [
                {
                  name: 'id',
                  in: 'path'
                }
              ]
            }
          }
        },
        null,
        2
      ),
      'utf8'
    );

    const config:
      YellowJacketConfig = {
        baseUrl:
          'http://localhost',

        coverage: {
          openapi:
            './openapi.json'
        },

        routes: [
          {
            name:
              'users',
            method:
              'GET',
            path:
              '/users'
          }
        ],

        scenarios: [
          {
            name:
              'user lifecycle',

            steps: [
              {
                name:
                  'create',
                method:
                  'POST',
                path:
                  '/users'
              },

              {
                name:
                  'read',
                method:
                  'GET',
                path:
                  '/users/{{userId}}'
              },

              {
                name:
                  'delete',
                method:
                  'DELETE',
                path:
                  '/users/{{userId}}'
              }
            ]
          }
        ]
      };

    const report =
      await buildCoverageReport(
        config,
        directory
      );

    assert.equal(
      report.total,
      5
    );

    assert.equal(
      report.covered,
      4
    );

    assert.equal(
      report.uncovered,
      1
    );

    assert.equal(
      report.percentage,
      80
    );

    assert.deepEqual(
      report.operations.map(
        (operation) => [
          operation.method,
          operation.path,
          operation.covered
        ]
      ),
      [
        [
          'GET',
          '/users',
          true
        ],
        [
          'POST',
          '/users',
          true
        ],
        [
          'GET',
          '/users/{id}',
          true
        ],
        [
          'PATCH',
          '/users/{id}',
          false
        ],
        [
          'DELETE',
          '/users/{id}',
          true
        ]
      ]
    );
  }
);

test(
  'normalizes common dynamic route syntaxes',
  () => {
    assert.equal(
      normalizeCoveragePath(
        '/users/{id}'
      ),
      '/users/{}'
    );

    assert.equal(
      normalizeCoveragePath(
        '/users/{{userId}}'
      ),
      '/users/{}'
    );

    assert.equal(
      normalizeCoveragePath(
        '/users/:id'
      ),
      '/users/{}'
    );

    assert.equal(
      normalizeCoveragePath(
        '/users/{{userId}}/?include=profile'
      ),
      '/users/{}'
    );

    assert.equal(
      normalizeCoveragePath(
        '/teams/{teamId}/users/{userId}'
      ),
      '/teams/{}/users/{}'
    );
  }
);

test(
  'rejects invalid or unsupported OpenAPI documents',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-coverage-invalid-'
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
        'swagger.json'
      ),
      JSON.stringify({
        swagger:
          '2.0',
        paths: {}
      }),
      'utf8'
    );

    const config:
      YellowJacketConfig = {
        baseUrl:
          'http://localhost',

        coverage: {
          openapi:
            './swagger.json'
        },

        routes: []
      };

    await assert.rejects(
      buildCoverageReport(
        config,
        directory
      ),
      /supports OpenAPI 3\.x/
    );
  }
);
