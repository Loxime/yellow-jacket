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
