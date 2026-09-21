import assert from 'node:assert/strict';

import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';

import {
  tmpdir
} from 'node:os';

import {
  dirname,
  join,
  resolve
} from 'node:path';

import {
  spawn
} from 'node:child_process';

import test from 'node:test';

import {
  fileURLToPath
} from 'node:url';

const CLI_PATH =
  resolve(
    dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    '../src/cli.js'
  );

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCli(
  args: string[],
  cwd: string
): Promise<CliResult> {
  return new Promise(
    (resolvePromise, reject) => {
      const child =
        spawn(
          process.execPath,
          [
            CLI_PATH,
            ...args
          ],
          {
            cwd,
            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        );

      let stdout = '';
      let stderr = '';

      child.stdout.setEncoding(
        'utf8'
      );

      child.stderr.setEncoding(
        'utf8'
      );

      child.stdout.on(
        'data',
        (chunk: string) => {
          stdout += chunk;
        }
      );

      child.stderr.on(
        'data',
        (chunk: string) => {
          stderr += chunk;
        }
      );

      child.once(
        'error',
        reject
      );

      child.once(
        'close',
        (code) => {
          resolvePromise({
            code:
              code ?? 1,
            stdout,
            stderr
          });
        }
      );
    }
  );
}

test(
  'coverage --json emits JSON and fails below the configured minimum',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-'
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
          title: 'CLI API',
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

    await writeFile(
      join(
        directory,
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  coverage: {
    openapi: './openapi.json',
    minimum: 100
  },
  routes: [
    {
      method: 'GET',
      path: '/users'
    }
  ]
};
`,
      'utf8'
    );

    const result =
      await runCli(
        [
          'coverage',
          '--json'
        ],
        directory
      );

    assert.equal(
      result.code,
      1
    );

    assert.equal(
      result.stderr,
      ''
    );

    const report =
      JSON.parse(
        result.stdout
      ) as {
        percentage: number;
        minimum: number;
        passed: boolean;
      };

    assert.equal(
      report.percentage,
      50
    );

    assert.equal(
      report.minimum,
      100
    );

    assert.equal(
      report.passed,
      false
    );
  }
);

test(
  '--json is rejected outside the coverage command',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-json-'
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

    const result =
      await runCli(
        [
          'run',
          '--json'
        ],
        directory
      );

    assert.equal(
      result.code,
      2
    );

    assert.match(
      result.stderr,
      /--json is only supported by the coverage command/
    );
  }
);

test(
  'run blocks non-local mutating requests by default',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-actions-'
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
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'https://api.example.test',
  routes: [
    {
      name: 'create user',
      method: 'POST',
      path: '/users'
    }
  ]
};
`,
      'utf8'
    );

    const result =
      await runCli(
        [
          'run'
        ],
        directory
      );

    assert.equal(
      result.code,
      1
    );

    assert.match(
      result.stdout,
      /Blocked POST request/
    );

    assert.match(
      result.stdout,
      /--allow-actions/
    );
  }
);

test(
  'coverage --markdown emits a Markdown report',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-markdown-'
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
        openapi:
          '3.1.0',

        info: {
          title:
            'Markdown API',
          version:
            '1.0.0'
        },

        paths: {
          '/health': {
            get: {
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
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  coverage: {
    openapi: './openapi.json',
    minimum: 100
  },
  routes: [
    {
      name: 'health',
      path: '/health'
    }
  ]
};
`,
      'utf8'
    );

    const result =
      await runCli(
        [
          'coverage',
          '--markdown'
        ],
        directory
      );

    assert.equal(
      result.code,
      0
    );

    assert.equal(
      result.stderr,
      ''
    );

    assert.match(
      result.stdout,
      /## 🐝 Yellow Jacket coverage/
    );

    assert.match(
      result.stdout,
      /\*\*Coverage:\*\* 100% \(1\/1\)/
    );

    assert.match(
      result.stdout,
      /\| GET \| \/health \| ✅ Covered/
    );
  }
);

test(
  'coverage rejects multiple output formats',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-formats-'
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

    const result =
      await runCli(
        [
          'coverage',
          '--json',
          '--markdown'
        ],
        directory
      );

    assert.equal(
      result.code,
      2
    );

    assert.match(
      result.stderr,
      /cannot be used together/
    );
  }
);

test(
  'coverage --html emits a standalone HTML report',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-html-'
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
        openapi:
          '3.1.0',

        info: {
          title:
            'HTML API',
          version:
            '1.0.0'
        },

        paths: {
          '/health': {
            get: {
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
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  coverage: {
    openapi: './openapi.json',
    minimum: 100
  },
  routes: [
    {
      name: 'health',
      path: '/health'
    }
  ]
};
`,
      'utf8'
    );

    const result =
      await runCli(
        [
          'coverage',
          '--html'
        ],
        directory
      );

    assert.equal(
      result.code,
      0
    );

    assert.equal(
      result.stderr,
      ''
    );

    assert.match(
      result.stdout,
      /^<!doctype html>/
    );

    assert.match(
      result.stdout,
      /<title>Yellow Jacket coverage<\/title>/
    );

    assert.match(
      result.stdout,
      /\/health/
    );
  }
);

test(
  '--html is rejected outside the coverage command',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-html-invalid-'
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

    const result =
      await runCli(
        [
          'run',
          '--html'
        ],
        directory
      );

    assert.equal(
      result.code,
      2
    );

    assert.match(
      result.stderr,
      /--html is only supported by the coverage command/
    );
  }
);

test(
  'coverage writes an HTML report to --output and preserves the exit code',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-output-'
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
        openapi:
          '3.1.0',

        info: {
          title:
            'Output API',
          version:
            '1.0.0'
        },

        paths: {
          '/health': {
            get: {
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
        'yellow-jacket.config.mjs'
      ),
      `export default {
  baseUrl: 'http://localhost',
  coverage: {
    openapi: './openapi.json',
    minimum: 100
  },
  routes: []
};
`,
      'utf8'
    );

    const result =
      await runCli(
        [
          'coverage',
          '--html',
          '--output',
          'reports/coverage.html'
        ],
        directory
      );

    assert.equal(
      result.code,
      1
    );

    assert.equal(
      result.stderr,
      ''
    );

    assert.match(
      result.stdout,
      /Coverage report written to/
    );

    const html =
      await readFile(
        join(
          directory,
          'reports',
          'coverage.html'
        ),
        'utf8'
      );

    assert.match(
      html,
      /^<!doctype html>/
    );

    assert.match(
      html,
      /Coverage requirement not satisfied/
    );
  }
);

test(
  '--output requires a structured coverage format',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-output-invalid-'
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

    const result =
      await runCli(
        [
          'coverage',
          '--output',
          'coverage.txt'
        ],
        directory
      );

    assert.equal(
      result.code,
      2
    );

    assert.match(
      result.stderr,
      /--output requires --json, --markdown or --html/
    );
  }
);

test(
  'desetup --purge removes Yellow Jacket project files without requiring a config',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'yellow-jacket-cli-desetup-'
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
        'package.json'
      ),
      JSON.stringify({
        name:
          'consumer',
        version:
          '1.0.0',

        scripts: {
          'yellow-jacket':
            'yellow-jacket run',

          'yellow-jacket:baseline':
            'yellow-jacket baseline'
        }
      }),
      'utf8'
    );

    await writeFile(
      join(
        directory,
        'yellow-jacket.config.mjs'
      ),
      'export default {};\n',
      'utf8'
    );

    const result =
      await runCli(
        [
          'desetup',
          '--purge'
        ],
        directory
      );

    assert.equal(
      result.code,
      0
    );

    assert.equal(
      result.stderr,
      ''
    );

    assert.match(
      result.stdout,
      /yellow-jacket removed from this project/
    );

    await assert.rejects(
      readFile(
        join(
          directory,
          'yellow-jacket.config.mjs'
        ),
        'utf8'
      ),
      {
        code:
          'ENOENT'
      }
    );
  }
);
