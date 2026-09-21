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

test(
  'applies the configured minimum coverage requirement',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-coverage-minimum-'
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
      JSON.stringify({
        openapi: '3.1.0',

        info: {
          title: 'Threshold API',
          version: '1.0.0'
        },

        paths: {
          '/users': {
            get: {
              responses: {}
            },
            post: {
              responses: {}
            }
          }
        }
      }),
      'utf8'
    );

    const failing =
      await buildCoverageReport(
        {
          baseUrl:
            'http://localhost',

          coverage: {
            openapi:
              './openapi.json',
            minimum: 80
          },

          routes: [
            {
              method: 'GET',
              path: '/users'
            }
          ]
        },
        directory
      );

    assert.equal(
      failing.percentage,
      50
    );

    assert.equal(
      failing.minimum,
      80
    );

    assert.equal(
      failing.passed,
      false
    );

    const passing =
      await buildCoverageReport(
        {
          baseUrl:
            'http://localhost',

          coverage: {
            openapi:
              './openapi.json',
            minimum: 50
          },

          routes: [
            {
              method: 'GET',
              path: '/users'
            }
          ]
        },
        directory
      );

    assert.equal(
      passing.passed,
      true
    );
  }
);

test(
  'uses sitemap URLs as GET coverage operations',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-sitemap-'
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
        'sitemap.xml'
      ),
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.test/</loc>
  </url>
  <url>
    <loc>https://example.test/about/</loc>
  </url>
  <url>
    <loc>https://example.test/products?source=sitemap&amp;page=1</loc>
  </url>
</urlset>
`,
      'utf8'
    );

    const report =
      await buildCoverageReport(
        {
          baseUrl:
            'http://localhost',

          coverage: {
            sitemap:
              './sitemap.xml'
          },

          routes: [
            {
              name: 'home',
              path: '/'
            },
            {
              name: 'about',
              path: '/about'
            }
          ]
        },
        directory
      );

    assert.equal(
      report.total,
      3
    );

    assert.equal(
      report.covered,
      2
    );

    assert.equal(
      report.percentage,
      66.67
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
          '/',
          true
        ],
        [
          'GET',
          '/about',
          true
        ],
        [
          'GET',
          '/products',
          false
        ]
      ]
    );
  }
);

test(
  'deduplicates operations declared by both OpenAPI and sitemap',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-combined-coverage-'
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
      JSON.stringify({
        openapi: '3.1.0',

        info: {
          title: 'Combined API',
          version: '1.0.0'
        },

        paths: {
          '/about': {
            get: {
              responses: {}
            }
          },

          '/users': {
            post: {
              responses: {}
            }
          }
        }
      }),
      'utf8'
    );

    await writeFile(
      join(
        directory,
        'sitemap.xml'
      ),
      `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.test/about</loc>
  </url>
  <url>
    <loc>https://example.test/contact</loc>
  </url>
</urlset>
`,
      'utf8'
    );

    const report =
      await buildCoverageReport(
        {
          baseUrl:
            'http://localhost',

          coverage: {
            openapi:
              './openapi.json',
            sitemap:
              './sitemap.xml'
          },

          routes: [
            {
              path:
                '/about'
            },
            {
              path:
                '/contact'
            },
            {
              method:
                'POST',
              path:
                '/users'
            }
          ]
        },
        directory
      );

    assert.equal(
      report.total,
      3
    );

    assert.equal(
      report.covered,
      3
    );

    assert.equal(
      report.percentage,
      100
    );
  }
);

test(
  'rejects sitemap indexes until recursive sitemap discovery is supported',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-sitemap-index-'
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
        'sitemap.xml'
      ),
      `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.test/sitemap-pages.xml</loc>
  </sitemap>
</sitemapindex>
`,
      'utf8'
    );

    await assert.rejects(
      buildCoverageReport(
        {
          baseUrl:
            'http://localhost',

          coverage: {
            sitemap:
              './sitemap.xml'
          },

          routes: []
        },
        directory
      ),
      /Sitemap indexes are not supported yet/
    );
  }
);
