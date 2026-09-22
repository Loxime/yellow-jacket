# Changelog

All notable changes to Yellow Jacket are documented in this file.

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
