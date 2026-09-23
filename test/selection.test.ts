import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterBaselineForRun,
  hasRunSelection,
  selectRunConfig
} from '../src/core/selection.js';

import type {
  BaselineFile,
  YellowJacketConfig
} from '../src/core/types.js';

const config:
  YellowJacketConfig = {
    baseUrl:
      'http://localhost',

    routes: [
      {
        name:
          'health',
        path:
          '/health',
        tags: [
          'smoke'
        ]
      },
      {
        name:
          'users',
        path:
          '/users',
        tags: [
          'api'
        ]
      }
    ],

    scenarios: [
      {
        name:
          'checkout',
        tags: [
          'smoke'
        ],

        steps: [
          {
            name:
              'create cart',
            method:
              'POST',
            path:
              '/cart'
          },
          {
            name:
              'pay',
            method:
              'POST',
            path:
              '/pay'
          }
        ],

        cleanup: [
          {
            name:
              'delete cart',
            method:
              'DELETE',
            path:
              '/cart'
          }
        ]
      },
      {
        name:
          'admin',
        steps: [
          {
            name:
              'login',
            path:
              '/admin/login'
          }
        ]
      }
    ]
  };

test(
  'selects routes by name or path',
  () => {
    const selected =
      selectRunConfig(
        config,
        {
          routes: [
            'health',
            '/users'
          ]
        }
      );

    assert.deepEqual(
      selected.routes
        ?.map(
          (route) =>
            route.name
        ),
      [
        'health',
        'users'
      ]
    );

    assert.equal(
      selected.scenarios
        ?.length,
      0
    );
  }
);

test(
  'selects scenarios by name',
  () => {
    const selected =
      selectRunConfig(
        config,
        {
          scenarios: [
            'checkout'
          ]
        }
      );

    assert.equal(
      selected.routes
        ?.length,
      0
    );

    assert.deepEqual(
      selected.scenarios
        ?.map(
          (scenario) =>
            scenario.name
        ),
      [
        'checkout'
      ]
    );
  }
);

test(
  'selects tagged routes and scenarios as a union',
  () => {
    const selected =
      selectRunConfig(
        config,
        {
          tags: [
            'smoke'
          ]
        }
      );

    assert.deepEqual(
      selected.routes
        ?.map(
          (route) =>
            route.name
        ),
      [
        'health'
      ]
    );

    assert.deepEqual(
      selected.scenarios
        ?.map(
          (scenario) =>
            scenario.name
        ),
      [
        'checkout'
      ]
    );
  }
);

test(
  'filters baseline entries to selected targets',
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
              'health',
            method:
              'GET',
            url:
              'http://localhost/health',
            status:
              200,
            contentType:
              null,
            body:
              null,
            durationMs:
              1
          },
          {
            route:
              'checkout > create cart',
            method:
              'POST',
            url:
              'http://localhost/cart',
            status:
              201,
            contentType:
              null,
            body:
              null,
            durationMs:
              1
          },
          {
            route:
              'checkout > pay',
            method:
              'POST',
            url:
              'http://localhost/pay',
            status:
              200,
            contentType:
              null,
            body:
              null,
            durationMs:
              1
          },
          {
            route:
              'checkout > cleanup > delete cart',
            method:
              'DELETE',
            url:
              'http://localhost/cart',
            status:
              204,
            contentType:
              null,
            body:
              null,
            durationMs:
              1
          },
          {
            route:
              'admin > login',
            method:
              'GET',
            url:
              'http://localhost/admin/login',
            status:
              200,
            contentType:
              null,
            body:
              null,
            durationMs:
              1
          }
        ]
      };

    const selected =
      selectRunConfig(
        config,
        {
          scenarios: [
            'checkout'
          ]
        }
      );

    const filtered =
      filterBaselineForRun(
        baseline,
        selected
      );

    assert.deepEqual(
      filtered.responses.map(
        (response) =>
          response.route
      ),
      [
        'checkout > create cart',
        'checkout > pay',
        'checkout > cleanup > delete cart'
      ]
    );

    assert.equal(
      hasRunSelection({
        scenarios: [
          'checkout'
        ]
      }),
      true
    );
  }
);

test(
  'filters baseline entries by method when selected labels collide',
  () => {
    const collisionConfig:
      YellowJacketConfig = {
        baseUrl:
          'http://localhost',

        routes: [
          {
            name:
              'users',
            method:
              'GET',
            path:
              '/users',
            tags: [
              'read'
            ]
          },
          {
            name:
              'users',
            method:
              'POST',
            path:
              '/users',
            tags: [
              'write'
            ]
          }
        ]
      };

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
              'users',
            method:
              'GET',
            url:
              'http://localhost/users',
            status:
              200,
            contentType:
              null,
            body:
              null,
            durationMs:
              1
          },
          {
            route:
              'users',
            method:
              'POST',
            url:
              'http://localhost/users',
            status:
              201,
            contentType:
              null,
            body:
              null,
            durationMs:
              1
          }
        ]
      };

    const selected =
      selectRunConfig(
        collisionConfig,
        {
          tags: [
            'read'
          ]
        }
      );

    const filtered =
      filterBaselineForRun(
        baseline,
        selected
      );

    assert.deepEqual(
      filtered.responses.map(
        (response) =>
          `${response.method} ${response.route}`
      ),
      [
        'GET users'
      ]
    );
  }
);

