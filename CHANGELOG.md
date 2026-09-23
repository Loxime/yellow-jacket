# Changelog

All notable changes to Yellow Jacket are documented in this file.

## Unreleased

### Action safety

- stop treating `.local` mDNS names as implicitly safe mutation targets
- validate redirect destinations before forwarding mutating requests
- preserve standard redirect method semantics while enforcing action safety
- avoid retrying requests blocked by the redirect safety guard

### Baseline integrity

- validate baseline format v1 before it is consumed
- reject malformed or duplicate response snapshots
- reject configuration entries that would share the same baseline identity
- validate baselines before a normal run sends HTTP requests

## 0.4.1

### Package API

- expose `parseRetryAfter` and `calculateEffectiveRetryDelay` from the package entrypoint
- add a public API regression test for retry scheduling helpers

## 0.4.0

### Retry-After handling

- optionally honor server-provided `Retry-After` delays
- support delta-seconds and HTTP-date `Retry-After` values
- optionally cap effective retry delays with `maxRetryDelayMs`

### Request timeouts

- allow routes and scenario steps to override the global request timeout
- validate global and per-request timeout values
- keep request cancellation separate from response-duration expectations

## 0.3.0

### Community

- GitHub bug, feature and user-feedback issue forms
- GitLab bug, feature and user-feedback issue templates
- contribution and responsible bug-reporting guidance

### Retry observability

- expose the actual HTTP attempt count in run results
- surface retried requests in CLI, JSON, Markdown, HTML, GitHub and GitLab reports
- keep retry execution metadata out of stored baselines

### Retry scheduling

- optional exponential retry backoff
- optional bounded retry jitter
- preserve fixed `delayMs` behavior by default

## 0.2.0

### Request resilience

- response header expectations
- configurable retries for transient failures
- explicit opt-in before retrying mutating requests
- bounded concurrency for independent routes
- deterministic result ordering with concurrent execution

## 0.1.1

Registry recovery release.

- first installable npm release under `@falche/yellow-jacket`
- same Yellow Jacket functionality as 0.1.0
- version bumped because npm considers `@falche/yellow-jacket@0.1.0`
  previously published while no installable 0.1.0 is available

## 0.1.0

Initial public release.

### HTTP regression testing

- GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS requests
- status expectations
- response content-type expectations
- response duration budgets
- JSON and text response snapshots
- structured response body diffs
- selected response header comparison
- redirect behavior and final URL comparison
- ignored dynamic response values
- secret redaction before persistence and JSON reporting

### Scenarios

- sequential HTTP scenarios
- captured response variables
- variable interpolation in paths, headers and JSON bodies
- typed complete-value interpolation
- failure and missing-capture short circuiting

### Baselines

- complete known-good baselines
- partial baseline refresh with `baseline --update`
- route, scenario and tag selection
- safe filtered comparison for partial runs

### Coverage

- OpenAPI 3.x JSON, YAML and YML inventories
- sitemap coverage
- recursive local sitemap indexes
- minimum coverage gates
- normalized dynamic route syntax

### Reporting

- JSON reports
- Markdown reports
- standalone HTML reports
- GitHub Actions annotations and step summaries
- GitLab JUnit reports

### Developer workflow

- Git pre-push integration
- safe mutating-request protection
- `doctor` project diagnostics
- safe desetup and purge modes
- JavaScript and TypeScript configuration
