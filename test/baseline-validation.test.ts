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

import test, {
  type TestContext
} from 'node:test';

import {
  readBaseline
} from '../src/core/baseline.js';

import {
  loadConfig
} from '../src/core/config.js';

import type {
  YellowJacketConfig
} from '../src/core/types.js';

function baselineConfig(
  baselinePath: string
): YellowJacketConfig {
  return {
    baseUrl:
      'http://localhost',
    baselinePath,
    routes: []
  };
}

function validResponse(
  overrides:
    Record<string, unknown> = {}
): Record<string, unknown> {
  return {
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
      ok:
        true
    },
    durationMs:
      10,
    ...overrides
  };
}

async function createDirectory(
  t: TestContext,
  prefix: string
): Promise<string> {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        prefix
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

  return directory;
}

test(
  'rejects unsupported baseline format versions',
  async (t) => {
    const directory =
      await createDirectory(
        t,
        'yellow-jacket-baseline-version-'
      );

    await writeFile(
      join(
        directory,
        'baseline.json'
      ),
      JSON.stringify({
        formatVersion:
          2,
        createdAt:
          new Date(0)
            .toISOString(),
        baseUrl:
          'http://localhost',
        responses:
          []
      }),
      'utf8'
    );

    await assert.rejects(
      readBaseline(
        baselineConfig(
          'baseline.json'
        ),
        directory
      ),
      /expected formatVersion 1/
    );
  }
);

test(
  'rejects malformed baseline response snapshots',
  async (t) => {
    const directory =
      await createDirectory(
        t,
        'yellow-jacket-baseline-shape-'
      );

    await writeFile(
      join(
        directory,
        'baseline.json'
      ),
      JSON.stringify({
        formatVersion:
          1,
        createdAt:
          new Date(0)
            .toISOString(),
        baseUrl:
          'http://localhost',
        responses: [
          validResponse({
            status:
              '200'
          })
        ]
      }),
      'utf8'
    );

    await assert.rejects(
      readBaseline(
        baselineConfig(
          'baseline.json'
        ),
        directory
      ),
      /responses\[0\].*status must be an HTTP status/
    );
  }
);

test(
  'rejects duplicate baseline response identities',
  async (t) => {
    const directory =
      await createDirectory(
        t,
        'yellow-jacket-baseline-duplicate-'
      );

    await writeFile(
      join(
        directory,
        'baseline.json'
      ),
      JSON.stringify({
        formatVersion:
          1,
        createdAt:
          new Date(0)
            .toISOString(),
        baseUrl:
          'http://localhost',
        responses: [
          validResponse(),
          validResponse({
            url:
              'http://localhost/other'
          })
        ]
      }),
      'utf8'
    );

    await assert.rejects(
      readBaseline(
        baselineConfig(
          'baseline.json'
        ),
        directory
      ),
      /duplicate response identity "GET health"/
    );
  }
);

test(
  'rejects duplicate route baseline identities in configuration',
  async (t) => {
    const directory =
      await createDirectory(
        t,
        'yellow-jacket-config-route-identity-'
      );

    await writeFile(
      join(
        directory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  routes: [
    {
      name: 'users',
      path: '/users'
    },
    {
      name: 'users',
      path: '/members'
    }
  ]
};
`,
      'utf8'
    );

    await assert.rejects(
      loadConfig(
        directory
      ),
      /duplicate snapshot identity "GET users"/
    );
  }
);

test(
  'rejects route and scenario baseline identity collisions',
  async (t) => {
    const directory =
      await createDirectory(
        t,
        'yellow-jacket-config-cross-identity-'
      );

    await writeFile(
      join(
        directory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  routes: [
    {
      name: 'checkout > submit',
      path: '/summary'
    }
  ],
  scenarios: [
    {
      name: 'checkout',
      steps: [
        {
          name: 'submit',
          path: '/submit'
        }
      ]
    }
  ]
};
`,
      'utf8'
    );

    await assert.rejects(
      loadConfig(
        directory
      ),
      /duplicate snapshot identity "GET checkout > submit"/
    );
  }
);

test(
  'allows the same route label for different HTTP methods',
  async (t) => {
    const directory =
      await createDirectory(
        t,
        'yellow-jacket-config-method-identity-'
      );

    await writeFile(
      join(
        directory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  routes: [
    {
      name: 'users',
      method: 'GET',
      path: '/users'
    },
    {
      name: 'users',
      method: 'POST',
      path: '/users'
    }
  ]
};
`,
      'utf8'
    );

    const config =
      await loadConfig(
        directory
      );

    assert.equal(
      config.routes?.length,
      2
    );
  }
);
