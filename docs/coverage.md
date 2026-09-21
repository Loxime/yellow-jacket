# Coverage

Yellow Jacket compares configured routes and scenario steps with external route
inventories.

Coverage discovery itself does not execute application requests.

## OpenAPI

OpenAPI 3.x documents are supported in JSON and YAML.

JSON:

```js
coverage: {
  openapi:
    './openapi.json'
}
```

YAML:

```js
coverage: {
  openapi:
    './openapi.yaml'
}
```

Supported extensions:

```text
.json
.yaml
.yml
```

Run:

```bash
yellow-jacket coverage
```

Example output:

```text
yellow-jacket coverage

✓ GET     /users
✓ POST    /users
✓ GET     /users/{}
✗ PATCH   /users/{}

3 / 4 operations covered
Coverage: 75%
```

## XML sitemaps

Sitemaps can declare GET routes:

```js
coverage: {
  sitemap:
    './sitemap.xml'
}
```

Yellow Jacket supports:

- `<urlset>`
- local recursive `<sitemapindex>`
- XML entities
- CDATA locations
- cyclic sitemap index protection

## Recursive sitemap indexes

A local sitemap index can reference other local sitemap files:

```text
sitemap.xml
├── pages.xml
└── nested.xml
    └── blog.xml
```

Yellow Jacket traverses the tree and combines the routes.

Remote child sitemaps such as:

```text
https://example.com/sitemap-pages.xml
```

are intentionally rejected.

Coverage discovery does not perform HTTP requests.

## Combine OpenAPI and sitemap

Both sources can be enabled:

```js
coverage: {
  openapi:
    './openapi.json',

  sitemap:
    './sitemap.xml'
}
```

Duplicate operations are counted only once.

## Dynamic route normalization

These forms are considered equivalent:

```text
/users/{id}
/users/{{userId}}
/users/:id
```

They normalize to:

```text
/users/{}
```

HTTP methods remain distinct.

Therefore:

```text
GET /users/{id}
```

does not cover:

```text
PATCH /users/{id}
```

## Minimum coverage

Configure a required percentage:

```js
coverage: {
  openapi:
    './openapi.json',

  minimum:
    80
}
```

When coverage falls below the configured minimum, the command exits with
code `1`.

## JSON reports

```bash
yellow-jacket coverage \
  --json
```

Write directly to a file:

```bash
yellow-jacket coverage \
  --json \
  --output reports/coverage.json
```

## Markdown reports

Useful for CI summaries:

```bash
yellow-jacket coverage \
  --markdown
```

Or:

```bash
yellow-jacket coverage \
  --markdown \
  --output reports/coverage.md
```

## HTML reports

Generate a standalone static report:

```bash
yellow-jacket coverage \
  --html
```

Write it directly:

```bash
yellow-jacket coverage \
  --html \
  --output public/index.html
```

The directory is created automatically.

The HTML report has no application server dependency.

## Output format rules

Only one structured output format can be used at a time:

```text
--json
--markdown
--html
```

`--output` requires one of those formats.
