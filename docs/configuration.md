# Configuration

Yellow Jacket uses a JavaScript or TypeScript configuration.

A project initialized with:

```bash
yellow-jacket init
```

receives:

```text
yellow-jacket.config.mjs
```

## Complete example

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

      method:
        'GET',

      path:
        '/health',

      expect: {
        status: 200
      }
    }
  ],

  coverage: {
    openapi:
      './openapi.json',

    sitemap:
      './sitemap.xml',

    minimum:
      80
  }
});
```

## `baseUrl`

The base URL used by routes and scenarios.

```js
baseUrl:
  'http://localhost:3000'
```

Relative request paths are resolved against this URL.

Environment variables can also be used:

```js
baseUrl:
  process.env.YELLOW_JACKET_URL ??
  'http://localhost:3000'
```

## `timeoutMs`

Request timeout in milliseconds:

```js
timeoutMs:
  10_000
```

When omitted, Yellow Jacket uses a 10 second timeout.

Routes and scenario steps can override the global timeout:

```js
{
  path:
    '/slow-report',

  timeoutMs:
    30_000
}
```

The most specific value wins:

```text
route or scenario step timeoutMs
global timeoutMs
10 second default
```

Request timeout and duration expectations serve different purposes.
`timeoutMs` aborts the HTTP operation, while `expect.maxDurationMs` evaluates a
completed operation against an explicit performance budget.

## Shared headers

Headers can be declared once:

```js
headers: {
  authorization:
    `Bearer ${process.env.TEST_TOKEN}`,

  'x-test-client':
    'yellow-jacket'
}
```

Route-level headers can override shared values.

## Routes

Supported HTTP methods are:

```text
GET
POST
PUT
PATCH
DELETE
HEAD
OPTIONS
```

When `method` is omitted, `GET` is used.

Example:

```js
routes: [
  {
    name:
      'users',

    method:
      'GET',

    path:
      '/users',

    expect: {
      status: 200
    }
  }
]
```

## Request bodies

JSON-compatible values are serialized automatically:

```js
{
  name:
    'create user',

  method:
    'POST',

  path:
    '/users',

  body: {
    email:
      'yellow-jacket@example.test'
  }
}
```

Yellow Jacket automatically sets:

```text
content-type: application/json
```

when appropriate.

## Status expectations

A single status can be expected:

```js
expect: {
  status: 200
}
```

Multiple statuses are also supported:

```js
expect: {
  status: [
    200,
    204
  ]
}
```

## Content type expectations

Routes and scenario steps can require a response media type:

```js
expect: {
  status:
    200,

  contentType:
    'application/json'
}
```

Multiple media types can be accepted:

```js
expect: {
  contentType: [
    'application/json',
    'application/problem+json'
  ]
}
```

Comparison is case-insensitive and ignores content type parameters.

For example:

```text
Application/JSON; charset=utf-8
```

matches:

```text
application/json
```

## Response duration budgets

A route or scenario step can define a maximum response duration:

```js
expect: {
  status:
    200,

  maxDurationMs:
    500
}
```

If the complete HTTP response takes longer than the configured budget, the
request fails.

Duration budgets are explicit expectations rather than baseline comparisons.
This avoids treating small timing variations between runs as regressions.

Content type and duration expectation failures are also included automatically
in native GitHub Actions and GitLab reports.

## Response header expectations

Routes and scenario steps can assert exact response header values:

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

Header names are case-insensitive.

These are explicit expectations and are separate from `compare.headers`.
Expected headers do not need to be persisted in the baseline.

## Retries

Retries are disabled by default because the default `maxAttempts` is `1`.

Configure safe-request retries globally:

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
    408,
    425,
    429,
    500,
    502,
    503,
    504
  ]
}
```

A retry can occur after a network error or one of the configured statuses.

The default retry delay strategy is fixed, preserving the behavior of
`delayMs` from earlier releases.

With:

```js
backoff:
  'exponential'
```

the delays before successive retries are:

```text
delayMs
delayMs * 2
delayMs * 4
...
```

`jitterMs` adds a random value from `0` up to the configured number of
milliseconds to each calculated retry delay. Set it to `0` or omit it for
deterministic delays.

Server-provided retry timing is opt-in:

```js
respectRetryAfter:
  true
```

When enabled, Yellow Jacket accepts `Retry-After` as either delta-seconds:

```text
Retry-After: 5
```

or an HTTP date:

```text
Retry-After: Wed, 23 Sep 2026 10:00:00 GMT
```

The server delay acts as a minimum: Yellow Jacket waits for whichever is longer,
the locally calculated delay or the valid `Retry-After` delay.

A maximum can be configured:

```js
maxRetryDelayMs:
  10_000
```

This caps the final retry delay, including exponential backoff, jitter and
`Retry-After`. Omitting it leaves the retry delay uncapped.

`Retry-After` is ignored unless `respectRetryAfter` is enabled. Invalid header
values fall back to the locally calculated retry delay.

A status explicitly accepted by `expect.status` is not retried.

POST, PUT, PATCH and DELETE are never retried unless `retryActions` is
explicitly enabled:

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

A route or scenario step can disable inherited retries:

```js
retry:
  false
```

Every run result exposes the number of HTTP attempts performed.

Retry information is included in CLI, JSON, Markdown, HTML, GitHub Actions and
GitLab reports. Response duration covers the complete operation, including
retry attempts and configured delays.

Retry metadata is execution-only and is not persisted in baselines.

## Concurrency

Top-level routes run sequentially by default.

Set a bounded concurrency:

```js
concurrency:
  4
```

Yellow Jacket preserves result order even when requests complete in a different
order.

Scenarios remain sequential and are executed after the independent route set.
Scenario steps are never parallelized.

## Ignore dynamic values

Values that legitimately change between requests can be ignored:

```js
compare: {
  ignore: [
    '$.createdAt',
    '$.users[*].requestId'
  ]
}
```

Ignored values remain structurally present as:

```text
[IGNORED]
```

This allows Yellow Jacket to still detect when an ignored field disappears
completely.

## Redact sensitive values

Secrets can be removed before snapshots are persisted:

```js
compare: {
  redact: [
    '$.token',
    '$.password'
  ]
}
```

Stored value:

```text
[REDACTED]
```

This prevents newly generated baselines from containing the original secret.

## Compare response headers

Response headers are opt-in because many headers contain dynamic values such as
dates, request IDs or infrastructure metadata.

Choose the headers that represent stable application behavior:

```js
compare: {
  headers: [
    'cache-control',
    'etag',
    'x-api-version'
  ]
}
```

Header names are case-insensitive.

`content-type` is already compared separately and normalized so parameters such
as `charset=utf-8` do not create false regressions.

## Redirect behavior

Native fetch follows redirects by default.

A route can explicitly choose its redirect behavior:

```js
{
  name:
    'legacy page',

  path:
    '/old',

  redirect:
    'manual',

  expect: {
    status: 302
  }
}
```

Supported modes:

```text
follow
manual
error
```

To compare redirect behavior against the baseline:

```js
compare: {
  redirects:
    true
}
```

With `follow`, Yellow Jacket records whether a redirect happened and the final
URL.

With `manual`, Yellow Jacket can also compare the redirect status and
`Location` header directly.

## Supported JSON paths

Current forms include:

```text
$.createdAt
$.user.profile.id
$.users[0].id
$.users[*].requestId
```

## Coverage

Coverage configuration can combine OpenAPI and sitemap inventories:

```js
coverage: {
  openapi:
    './openapi.json',

  sitemap:
    './sitemap.xml',

  minimum:
    80
}
```

Continue with [Coverage](/coverage) for route discovery and reports.
