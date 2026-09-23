# Architecture

Yellow Jacket is a developer-first HTTP regression testing CLI. It executes a
declared set of HTTP requests, compares current responses with known-good
baselines and returns deterministic output suitable for local development, Git
hooks and CI.

## Runtime

Yellow Jacket requires Node.js 24.12.0 or newer.

The implementation uses:

- TypeScript compiled as ESM
- native `fetch`
- `node:test` and `node:assert`
- `util.parseArgs` for the CLI
- JSON files for response baselines
- `yaml` as the focused runtime dependency for YAML OpenAPI input

Yellow Jacket does not require Docker, a server process or a database.

## Execution pipeline

The core execution flow is:

```text
configuration
    ↓
route / scenario selection
    ↓
HTTP runner
    ↓
response normalization
    ↓
baseline read / write
    ↓
structured diff
    ↓
CLI / JSON / Markdown / HTML / CI report
```

## Configuration

Configuration declares:

- a base URL
- independent routes
- optional sequential scenarios
- response expectations
- retries and request timeouts
- baseline comparison normalization
- optional OpenAPI or sitemap coverage inventories

Configuration is validated before HTTP execution.

## HTTP runner

The runner uses native `fetch` and supports:

```text
GET
POST
PUT
PATCH
DELETE
HEAD
OPTIONS
```

Independent top-level routes may use bounded concurrency while preserving
configured result order.

Scenario steps always run sequentially because later steps can depend on values
captured from earlier responses.

## Action safety

`POST`, `PUT`, `PATCH` and `DELETE` are considered mutating requests.

Without `--allow-actions`, mutating requests are limited to localhost and
loopback destinations. Redirects are inspected before a mutating method is
forwarded to another destination.

Retries for mutating requests are disabled unless explicitly enabled.

## Retries and timeouts

Retries are opt-in and support:

- configurable attempts
- fixed or exponential backoff
- jitter
- transient status selection
- `Retry-After`
- maximum retry delay
- explicit action retry authorization

Request cancellation timeouts are separate from response-duration
expectations. Routes and scenario steps may override the global timeout.

## Baselines

Baselines are JSON documents using `formatVersion: 1`.

Every stored response is identified by:

```text
HTTP method + displayed route label
```

Duplicate identities are rejected.

Existing baselines are validated before a normal `run` sends HTTP requests.
Partial baseline updates preserve unselected snapshots.

Dynamic response values may be ignored or redacted while retaining structural
comparison.

## Diff model

Yellow Jacket compares:

- status
- structured response body
- normalized content type
- configured response headers
- redirect behavior
- final redirect URL

JSON object key ordering is ignored.

Body regressions are reported as added, removed or changed values at structured
JSON paths.

## Coverage

Coverage compares configured requests with declared route inventories.

Supported sources include:

- OpenAPI 3.x JSON
- OpenAPI 3.x YAML / YML
- XML sitemaps
- recursive local sitemap indexes

Coverage reports may enforce a minimum percentage.

## Git integration

`yellow-jacket install` creates a tracked pre-push hook and configures
`core.hooksPath`.

The hook does not silently authorize remote mutating actions.

Yellow Jacket refuses to overwrite another configured hook manager.

## Reports

Run and coverage results can be rendered for:

- terminal output
- JSON
- Markdown
- standalone HTML
- GitHub Actions annotations and summaries
- GitLab JUnit-compatible output

## Distribution validation

The npm distribution is tested as an artifact, not only from repository
sources.

CI:

1. builds the project,
2. creates the npm tarball,
3. installs it into a clean consumer project,
4. checks package-root exports and the CLI,
5. creates a real baseline,
6. performs a real regression run.

The compatibility matrix covers Ubuntu, macOS and Windows on the minimum
supported Node.js 24.12.0 release and the current Node.js 24 release.

## Product boundaries

Yellow Jacket focuses on deterministic HTTP regression detection before code is
pushed.

It intentionally does not provide:

- an application server
- a database
- a hosted dashboard
- browser automation
- load testing
- Docker orchestration

Those concerns are better handled by complementary tools.
