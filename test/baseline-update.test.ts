import assert from 'node:assert/strict';

import {
  mkdtemp,
  rm
} from 'node:fs/promises';

import {
  tmpdir
} from 'node:os';

import {
  join
} from 'node:path';

import test from 'node:test';

import {
  readBaseline,
  updateBaseline
} from '../src/core/baseline.js';

import type {
  BaselineFile,
  RouteRunResult,
  YellowJacketConfig
} from '../src/core/types.js';

test(
  'partial baseline updates preserve existing order and append new snapshots',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-baseline-update-'
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
          './baseline.json',

        routes: []
      };

    const existing:
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
              'health',
            method:
              'GET',
            url:
              'http://localhost/health',
            status:
              200,
            contentType:
              'application/json',
            body: {
              version:
                1
            },
            durationMs:
              1
          },
          {
            route:
              'untouched',
            method:
              'GET',
            url:
              'http://localhost/untouched',
            status:
              200,
            contentType:
              null,
            body:
              'keep',
            durationMs:
              1
          }
        ]
      };

    const results:
      RouteRunResult[] = [
        {
          route:
            'health',
          method:
            'GET',
          url:
            'http://localhost/health',
          status:
            200,
          contentType:
            'application/json',
          body: {
            version:
              2
          },
          durationMs:
            2,
          passed:
            true
        },
        {
          route:
            'new route',
          method:
            'GET',
          url:
            'http://localhost/new',
          status:
            200,
          contentType:
            null,
          body:
            'new',
          durationMs:
            2,
          passed:
            true
        }
      ];

    await updateBaseline(
      config,
      existing,
      results,
      directory
    );

    const updated =
      await readBaseline(
        config,
        directory
      );

    assert.ok(
      updated
    );

    assert.deepEqual(
      updated.responses.map(
        (response) =>
          response.route
      ),
      [
        'health',
        'untouched',
        'new route'
      ]
    );

    assert.deepEqual(
      updated.responses[0]?.body,
      {
        version:
          2
      }
    );

    assert.equal(
      updated.responses[1]?.body,
      'keep'
    );
  }
);
