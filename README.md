# Yellow Jacket

> Catch HTTP regressions before they sting.

Yellow Jacket is a developer-first HTTP regression testing tool for local
development, Git hooks and CI.

It executes declared HTTP routes and chained scenarios, stores known-good
baselines, detects unintended response changes, measures route coverage and can
block a Git push when application behavior changes unexpectedly.

## Highlights

- GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS requests
- status, content-type, response-header and response-duration expectations
- safe configurable request retries
- bounded concurrency for independent routes
- JSON and text response snapshots
- structured response diffs
- ignored dynamic response values
- secret redaction before persistence and JSON reporting
- selected response-header comparison
- redirect and final-URL regression detection
- chained HTTP scenarios with captured variables
- route, scenario and tag selection
- safe partial baseline updates
- OpenAPI 3.x JSON/YAML route coverage
- sitemap route coverage
- minimum coverage gates
- JSON, Markdown and standalone HTML reports
- native GitHub Actions annotations and summaries
- native GitLab JUnit reports
- Git `pre-push` integration
- local project diagnostics with `doctor`
- safe project desetup
- one focused runtime dependency: `yaml`

## Requirements

- Node.js 24.12 or newer
- Git for hook installation

## Installation

```bash
npm install --save-dev @falche/yellow-jacket
```

Initialize Yellow Jacket in your project:

```bash
npx yellow-jacket init
```

This creates `yellow-jacket.config.mjs`.

## Quick start

```js
import {
  defineConfig
} from '@falche/yellow-jacket';

export default defineConfig({
  baseUrl:
    process.env.YELLOW_JACKET_URL ??
    'http://localhost:3000',

  routes: [
    {
      name:
        'health',

      method:
        'GET',

      path:
        '/health',

      expect: {
        status:
          200,

        contentType:
          'application/json',

        maxDurationMs:
          500
      }
    }
  ]
});
```

Create a known-good baseline:

```bash
npx yellow-jacket baseline
```

Run against it:

```bash
npx yellow-jacket run
```

A successful run exits with code `0`. Failed expectations or detected
regressions exit with code `1`.

## Configuration

```js
import {
  defineConfig
} from '@falche/yellow-jacket';

export default defineConfig({
  baseUrl:
    process.env.YELLOW_JACKET_URL ??
    'http://localhost:3000',

  timeoutMs:
    10_000,

  headers: {
    'x-test-client':
      'yellow-jacket'
  },

  compare: {
    ignore: [
      '$.createdAt',
      '$.updatedAt'
    ],

    redact: [
      '$.token',
      '$.password'
    ],

    headers: [
      'cache-control',
      'x-api-version'
    ],

    redirects:
      true
  },

  routes: [
    {
      name:
        'health',

      tags: [
        'smoke'
      ],

      path:
        '/health',

      expect: {
        status:
          200,

        contentType:
          'application/json',

        maxDurationMs:
          500
      }
    }
  ],

  coverage: {
    openapi:
      './openapi.yaml',

    sitemap:
      './sitemap.xml',

    minimum:
      80
  }
});
```

JavaScript and TypeScript configuration files are supported.

## Response expectations

Routes and scenario steps can define explicit HTTP contracts.

Status:

```js
expect: {
  status:
    200
}
```

Multiple statuses:

```js
expect: {
  status: [
    200,
    204
  ]
}
```

Content type:

```js
expect: {
  contentType:
    'application/json'
}
```

Multiple media types:

```js
expect: {
  contentType: [
    'application/json',
    'application/problem+json'
  ]
}
```

Content-type comparison is case-insensitive and ignores parameters such as
`charset=utf-8`.

Response-duration budget:

```js
expect: {
  maxDurationMs:
    500
}
```

Duration is treated as an explicit budget rather than a baseline value, avoiding
noisy timing regressions between runs.

`timeoutMs` controls request cancellation and can be configured globally or
overridden on an individual route or scenario step:

```js
{
  path:
    '/slow-report',

  timeoutMs:
    30_000
}
```

`timeoutMs` controls how long Yellow Jacket waits for the HTTP operation.
`expect.maxDurationMs` is a separate assertion on the completed operation.

## Response header expectations

Response headers can be asserted directly without adding them to the baseline:

```js
expect: {
  headers: {
    'x-api-version':
      '2',

    'cache-control': [
      'no-cache',
      'no-store'
    ]
  }
}
```

Header names are case-insensitive. Expected values are exact strings.

## Retries

Retries are opt-in. Without configuration every request is attempted once.

```js
retries: {
  maxAttempts:
    3,

  delayMs:
    100,

  backoff:
    'exponential',

  jitterMs:
    50,

  respectRetryAfter:
    true,

  maxRetryDelayMs:
    10_000,

  statuses: [
    429,
    502,
    503,
    504
  ]
}
```

Safe requests can be retried after network failures or configured transient
statuses.

`delayMs` uses a fixed delay by default. Set `backoff: 'exponential'` to double
the base delay after each failed attempt. `jitterMs` adds up to the configured
number of random milliseconds to each retry delay.

`respectRetryAfter: true` honors a valid server `Retry-After` header when its
delay is longer than the locally calculated retry delay. Both delta-seconds and
HTTP-date values are supported. `maxRetryDelayMs` can cap the final delay,
including delays derived from `Retry-After`.

Mutating methods are never retried by default, even when global retries are
enabled. Explicitly opt in for a route when the operation is known to be safe
to repeat:

```js
{
  method:
    'POST',

  path:
    '/jobs',

  retry: {
    maxAttempts:
      2,

    retryActions:
      true
  }
}
```

Set `retry: false` on a route or scenario step to disable inherited retries.

Run results expose the number of HTTP attempts performed. CLI, JSON, Markdown,
HTML, GitHub Actions and GitLab reports surface retried requests.

Response duration includes the complete operation, including retry attempts and
configured retry delays.

## Route concurrency

Independent top-level routes are sequential by default.

Enable bounded concurrency with:

```js
concurrency:
  4
```

Results retain configuration order.

Scenarios are intentionally not parallelized. Their steps always execute
sequentially because later requests may depend on captures or side effects from
earlier steps.

## Baselines

Create or replace the complete baseline:

```bash
npx yellow-jacket baseline
```

Run against the current baseline:

```bash
npx yellow-jacket run
```

Yellow Jacket compares HTTP status, response body, content type, selected
response headers, redirect behavior and the final redirect URL.

Response duration is recorded but is not baseline-diffed.

Baselines currently use `formatVersion: 1`. Existing baselines are validated
before `run`, partial updates and `doctor` use them. A malformed or unsupported
baseline is rejected before HTTP requests are sent.

Each stored response is identified by its HTTP method and displayed route
label. These identities must be unique. Routes with the same label remain valid
when their HTTP methods differ.

## Structured response diffs

JSON bodies are compared structurally.

```text
$.user.name
"Maxime" -> "Max"
```

Object-key ordering does not produce a regression.

## Ignore dynamic values

```js
compare: {
  ignore: [
    '$.createdAt',
    '$.users[*].requestId'
  ]
}
```

Ignored values are stored as `[IGNORED]`. The field remains structurally
present, so Yellow Jacket still detects if it disappears entirely.

Supported paths include:

```text
$.createdAt
$.user.profile.id
$.users[0].id
$.users[*].requestId
```

## Redact sensitive values

```js
compare: {
  redact: [
    '$.token',
    '$.password'
  ]
}
```

Stored values become `[REDACTED]`.

The same redaction rules are applied before `run --json` is serialized.

## Response headers

Header comparison is opt-in:

```js
compare: {
  headers: [
    'cache-control',
    'etag',
    'x-api-version'
  ]
}
```

Header names are case-insensitive. `content-type` is handled separately.

## Redirects

A route can override native fetch redirect behavior:

```js
{
  name:
    'legacy page',

  path:
    '/old',

  redirect:
    'manual',

  expect: {
    status:
      302
  }
}
```

Supported modes:

```text
follow
manual
error
```

Enable redirect comparison with:

```js
compare: {
  redirects:
    true
}
```

## Scenarios

Scenarios chain requests when later requests depend on previous responses.

```js
scenarios: [
  {
    name:
      'user lifecycle',

    tags: [
      'integration'
    ],

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
          status:
            201
        },

        capture: {
          userId:
            '$.id'
        }
      },

      {
        name:
          'read user',

        path:
          '/users/{{userId}}',

        expect: {
          status:
            200
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

          name:
            'Updated'
        },

        expect: {
          status:
            200
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
          status:
            204
        }
      }
    ]
  }
]
```

Captured variables can be reused in request paths, headers and JSON bodies.
When a placeholder is the complete JSON value, the captured value keeps its
original type.

A failed request, unresolved variable or missing capture stops the remaining
steps of the scenario.

## Targeted runs

```bash
npx yellow-jacket run --route health
npx yellow-jacket run --route /health
npx yellow-jacket run --scenario "user lifecycle"
npx yellow-jacket run --tag smoke
```

Selectors are repeatable. Different selector categories are combined as a
union.

## Partial baseline updates

A normal baseline command replaces the complete baseline:

```bash
npx yellow-jacket baseline
```

Refresh only selected entries with `--update`:

```bash
npx yellow-jacket baseline \
  --update \
  --route health

npx yellow-jacket baseline \
  --update \
  --scenario "user lifecycle"

npx yellow-jacket baseline \
  --update \
  --tag smoke
```

Unselected snapshots are preserved. Partial updates require an existing
baseline.

## Action safety

Mutating requests are POST, PUT, PATCH and DELETE.

They are allowed by default only for local targets such as:

```text
localhost
*.localhost
127.0.0.0/8
::1
```

Explicitly authorize another target with:

```bash
npx yellow-jacket run --allow-actions
```

The same option is available for baseline creation.

Names under `.local` are not considered loopback targets because mDNS can
resolve them to another machine on the local network.

When a mutating request follows redirects, Yellow Jacket checks every redirect
that would preserve `POST`, `PUT`, `PATCH` or `DELETE` before forwarding it.
A redirect to a non-loopback target is blocked unless `--allow-actions` is
explicitly enabled.

## Route coverage

```js
coverage: {
  openapi:
    './openapi.yaml'
}
```

Run:

```bash
npx yellow-jacket coverage
```

OpenAPI 3.x JSON, YAML and YML documents are supported.

Dynamic path forms are normalized:

```text
/users/{id}
/users/{{userId}}
/users/:id
```

HTTP methods remain distinct.

## Sitemap coverage

```js
coverage: {
  sitemap:
    './sitemap.xml'
}
```

Local sitemap indexes are followed recursively. Multiple coverage sources can
be combined and duplicate operations are deduplicated.

## Coverage gate

```js
coverage: {
  openapi:
    './openapi.yaml',

  minimum:
    80
}
```

Below the threshold, `yellow-jacket coverage` exits with code `1`.

## Reports

Both HTTP runs and coverage support JSON, Markdown and standalone HTML reports.

```bash
npx yellow-jacket run --json
npx yellow-jacket run --markdown
npx yellow-jacket run --html

npx yellow-jacket coverage --json
npx yellow-jacket coverage --markdown
npx yellow-jacket coverage --html
```

Write reports to a file with `--output`:

```bash
npx yellow-jacket run \
  --html \
  --output reports/run.html

npx yellow-jacket coverage \
  --markdown \
  --output reports/coverage.md
```

## GitHub Actions

```bash
npx yellow-jacket run --github
npx yellow-jacket coverage --github
```

Yellow Jacket emits native workflow annotations. When `GITHUB_STEP_SUMMARY` is
available, it appends a Markdown summary automatically.

## GitLab CI

```bash
npx yellow-jacket run \
  --gitlab \
  --output yellow-jacket-run.xml

npx yellow-jacket coverage \
  --gitlab \
  --output yellow-jacket-coverage.xml
```

These files can be exposed as GitLab JUnit reports.

## Git pre-push hook

Install:

```bash
npx yellow-jacket install
```

Yellow Jacket creates:

```text
.yellow-jacket/
└── hooks/
    └── pre-push
```

and configures `core.hooksPath` locally.

Temporarily bypass the hook with:

```bash
YELLOW_JACKET=0 git push
```

Yellow Jacket does not overwrite another configured hook manager.

## Project diagnostics

```bash
npx yellow-jacket doctor
npx yellow-jacket doctor --json
```

Doctor checks configuration, baselines, coverage sources, Git integration and
the installed pre-push hook without making HTTP requests.

## Removing Yellow Jacket

Preserve configuration and snapshots:

```bash
npx yellow-jacket desetup
```

Alias:

```bash
npx yellow-jacket uninstall
```

Remove configuration and Yellow Jacket state as well:

```bash
npx yellow-jacket desetup --purge
```

## Commands

```text
yellow-jacket --version

yellow-jacket init
yellow-jacket install

yellow-jacket doctor
yellow-jacket doctor --json

yellow-jacket run
yellow-jacket run --route <name-or-path>
yellow-jacket run --scenario <name>
yellow-jacket run --tag <tag>
yellow-jacket run --json
yellow-jacket run --markdown
yellow-jacket run --html
yellow-jacket run --github
yellow-jacket run --gitlab

yellow-jacket baseline
yellow-jacket baseline --update --route <name-or-path>
yellow-jacket baseline --update --scenario <name>
yellow-jacket baseline --update --tag <tag>

yellow-jacket coverage
yellow-jacket coverage --json
yellow-jacket coverage --markdown
yellow-jacket coverage --html
yellow-jacket coverage --github
yellow-jacket coverage --gitlab

yellow-jacket desetup
yellow-jacket desetup --purge
yellow-jacket uninstall
```

## Exit codes

```text
0  success
1  failed expectation, regression or coverage gate
2  invalid CLI usage or selection
```

## Documentation

Full documentation:

https://loxime.github.io/yellow-jacket/

## Feedback and contributing

Bug reports, feature requests and general usage feedback are welcome.

GitHub provides dedicated issue forms for bugs, feature requests and user
feedback. Equivalent issue templates are also included for the GitLab mirror.

Please remove tokens, credentials and private response data before sharing logs
or configuration.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and reporting guidance.

## Security

Security vulnerabilities should not be reported in public issues.

See [SECURITY.md](SECURITY.md) for private reporting instructions and the
supported security policy.

## Releasing

Release preparation and npm publication are documented in
[RELEASING.md](RELEASING.md).

npm releases are published from GitHub Actions with OIDC rather than a
long-lived npm publish token.

## Development

```bash
git clone https://github.com/Loxime/yellow-jacket.git
cd yellow-jacket
npm install
npm run check
npm test
npm run test:package
npm run docs:build
```

`npm run test:package` packs Yellow Jacket, installs the tarball in a clean
temporary project, checks the package-root exports and CLI, then executes a real
`baseline` followed by `run`.

Inspect the tarball contents without installing it:

```bash
npm pack --dry-run
```

## License

MIT
