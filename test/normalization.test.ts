import assert from 'node:assert/strict';

import {
  mkdtemp,
  readFile,
  rm
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  compareWithBaseline,
  writeBaseline
} from '../src/core/baseline.js';

import {
  diffBodies
} from '../src/core/diff.js';

import {
  IGNORED_VALUE,
  REDACTED_VALUE,
  normalizeBody,
  parseJsonPath
} from '../src/core/normalize.js';

import type {
  BaselineFile,
  RouteRunResult,
  YellowJacketConfig
} from '../src/core/types.js';

test(
  'normalizes ignored and redacted JSON paths',
  () => {
    const body = {
      id: 42,
      createdAt:
        '2026-09-21T10:00:00Z',
      token: 'secret',

      users: [
        {
          id: 1,
          requestId: 'a'
        },
        {
          id: 2,
          requestId: 'b'
        }
      ]
    };

    const normalized =
      normalizeBody(
        body,
        {
          ignore: [
            '$.createdAt',
            '$.users[*].requestId'
          ],
          redact: [
            '$.token'
          ]
        }
      );

    assert.deepEqual(
      normalized,
      {
        id: 42,
        createdAt:
          IGNORED_VALUE,
        token:
          REDACTED_VALUE,

        users: [
          {
            id: 1,
            requestId:
              IGNORED_VALUE
          },
          {
            id: 2,
            requestId:
              IGNORED_VALUE
          }
        ]
      }
    );

    // Normalization must not mutate
    // the original response.
    assert.equal(
      body.token,
      'secret'
    );
  }
);

test(
  'supports object, array index and wildcard paths',
  () => {
    assert.deepEqual(
      parseJsonPath(
        '$.users[0].profile.id'
      ),
      [
        'users',
        0,
        'profile',
        'id'
      ]
    );

    assert.deepEqual(
      parseJsonPath(
        '$.users[*].requestId'
      ),
      [
        'users',
        '*',
        'requestId'
      ]
    );

    assert.throws(
      () =>
        parseJsonPath(
          'users.id'
        ),
      /must start with/
    );
  }
);

test(
  'reports added removed changed and array values by path',
  () => {
    const changes =
      diffBodies(
        {
          name: 'Maxime',
          active: true,
          removed: 'old',
          roles: [
            'admin'
          ]
        },
        {
          name: 'Max',
          active: true,
          added: 42,
          roles: [
            'admin',
            'editor'
          ]
        }
      );

    assert.deepEqual(
      changes,
      [
        {
          path: '$.added',
          kind: 'added',
          after: 42
        },
        {
          path: '$.name',
          kind: 'changed',
          before: 'Maxime',
          after: 'Max'
        },
        {
          path: '$.removed',
          kind: 'removed',
          before: 'old'
        },
        {
          path: '$.roles[1]',
          kind: 'added',
          after: 'editor'
        }
      ]
    );
  }
);

test(
  'handles primitive response changes',
  () => {
    assert.deepEqual(
      diffBodies(
        'before',
        'after'
      ),
      [
        {
          path: '$',
          kind: 'changed',
          before: 'before',
          after: 'after'
        }
      ]
    );

    assert.deepEqual(
      diffBodies(
        null,
        false
      ),
      [
        {
          path: '$',
          kind: 'changed',
          before: null,
          after: false
        }
      ]
    );
  }
);

test(
  'ignores dynamic values while keeping real regressions',
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
            route: 'user',
            method: 'GET',
            url:
              'http://localhost/user',
            status: 200,
            contentType:
              'application/json',

            body: {
              id: 42,
              name: 'Maxime',
              createdAt: 'old',
              token:
                REDACTED_VALUE
            },

            durationMs: 10
          }
        ]
      };

    const current:
      RouteRunResult = {
        route: 'user',
        method: 'GET',
        url:
          'http://localhost/user',
        status: 200,
        contentType:
          'application/json',

        body: {
          id: 42,
          name: 'Max',
          createdAt: 'new',
          token:
            'different-secret'
        },

        durationMs: 12,
        passed: true
      };

    const regressions =
      compareWithBaseline(
        baseline,
        [current],
        {
          ignore: [
            '$.createdAt'
          ],
          redact: [
            '$.token'
          ]
        }
      );

    assert.equal(
      regressions.length,
      1
    );

    assert.deepEqual(
      regressions[0]
        ?.bodyChanges,
      [
        {
          path: '$.name',
          kind: 'changed',
          before: 'Maxime',
          after: 'Max'
        }
      ]
    );
  }
);

test(
  'does not report object key ordering as a regression',
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
            route: 'object',
            method: 'GET',
            url:
              'http://localhost/object',
            status: 200,
            contentType:
              'application/json',
            body: {
              first: 1,
              second: 2
            },
            durationMs: 1
          }
        ]
      };

    const regressions =
      compareWithBaseline(
        baseline,
        [
          {
            route: 'object',
            method: 'GET',
            url:
              'http://localhost/object',
            status: 200,
            contentType:
              'application/json',

            body: {
              second: 2,
              first: 1
            },

            durationMs: 1,
            passed: true
          }
        ]
      );

    assert.deepEqual(
      regressions,
      []
    );
  }
);

test(
  'redacts secrets before writing the baseline',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-'
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

    const config:
      YellowJacketConfig = {
        baseUrl:
          'http://localhost',

        baselinePath:
          'baseline.json',

        compare: {
          ignore: [
            '$.requestId'
          ],
          redact: [
            '$.token'
          ]
        },

        routes: []
      };

    const path =
      await writeBaseline(
        config,
        [
          {
            route: 'secret',
            method: 'GET',
            url:
              'http://localhost/secret',
            status: 200,
            contentType:
              'application/json',

            body: {
              requestId:
                'dynamic-id',
              token:
                'super-secret',
              name:
                'yellow-jacket'
            },

            durationMs: 5,
            passed: true
          }
        ],
        directory
      );

    const saved =
      JSON.parse(
        await readFile(
          path,
          'utf8'
        )
      ) as BaselineFile;

    assert.deepEqual(
      saved.responses[0]?.body,
      {
        requestId:
          IGNORED_VALUE,
        token:
          REDACTED_VALUE,
        name:
          'yellow-jacket'
      }
    );

    const raw =
      await readFile(
        path,
        'utf8'
      );

    assert.equal(
      raw.includes(
        'super-secret'
      ),
      false
    );
  }
);
