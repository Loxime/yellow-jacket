# CI & reports

Yellow Jacket uses standard process exit codes and works with normal CI systems.

The same route inventory and coverage rules used locally can be reused in
automation.

## Coverage gate

Run:

```bash
yellow-jacket coverage
```

With a configured minimum:

```js
coverage: {
  openapi:
    './openapi.json',

  minimum:
    80
}
```

the command returns:

```text
exit 0 = coverage requirement satisfied
exit 1 = coverage requirement not satisfied
```

## JSON output

For machines and further tooling:

```bash
yellow-jacket coverage \
  --json \
  --output yellow-jacket-coverage.json
```

## Markdown output

For human-readable CI summaries:

```bash
yellow-jacket coverage \
  --markdown \
  --output yellow-jacket-coverage.md
```

## GitHub Actions

A complete example is included in:

```text
examples/ci/github-actions.yml
```

The report can be appended to:

```text
$GITHUB_STEP_SUMMARY
```

while preserving Yellow Jacket's original exit code.

## GitLab CI

A GitLab example is included in:

```text
examples/ci/gitlab-ci.yml
```

The Markdown report can be preserved as a job artifact even when the coverage
gate fails.

## HTTP regression reporting

HTTP runs support the same generic report formats as coverage.

JSON:

```bash
yellow-jacket run \
  --json \
  --output yellow-jacket-run.json
```

Markdown:

```bash
yellow-jacket run \
  --markdown \
  --output yellow-jacket-run.md
```

Static HTML:

```bash
yellow-jacket run \
  --html \
  --output yellow-jacket-run.html
```

The JSON report contains the run result, individual request results and
detected regressions.

Configured `compare.ignore` and `compare.redact` rules are applied to response
bodies before JSON output is serialized, so values configured for redaction
are not exposed by the report.

All formats preserve the normal `run` exit code.

The native CI formats also work with the main regression runner.

GitHub Actions:

```bash
yellow-jacket run --github
```

Failed expectations and detected baseline regressions are emitted as native
workflow errors.

This includes regressions in:

- status codes
- response bodies
- selected response headers
- redirect behavior
- final redirect URLs

GitLab:

```bash
yellow-jacket run \
  --gitlab \
  --output yellow-jacket-run.xml
```

The resulting file is a JUnit report and can be published with GitLab
`artifacts:reports:junit`.

If no baseline exists, request expectations are still checked and the native
report explicitly states that regression comparison was skipped.

## Native GitHub Actions reporting

Use:

```bash
yellow-jacket coverage --github
```

Yellow Jacket emits GitHub Actions workflow annotations.

Uncovered operations are reported as warnings. If the configured coverage
minimum is not satisfied, the coverage summary is emitted as an error and the
command exits with code `1`.

When `GITHUB_STEP_SUMMARY` is available, Yellow Jacket also appends its Markdown
coverage report to the job summary automatically.

This means a GitHub Actions step can be as small as:

```yaml
- name: Yellow Jacket coverage
  run: npx yellow-jacket coverage --github
```

## Native GitLab reporting

Use the GitLab format to generate a JUnit report:

```bash
yellow-jacket coverage \
  --gitlab \
  --output yellow-jacket-junit.xml
```

Then expose it as a GitLab test report:

```yaml
artifacts:
  when: always

  reports:
    junit:
      - yellow-jacket-junit.xml
```

Covered operations are represented as passing test cases. Uncovered operations
are represented as skipped test cases. The synthetic coverage gate fails only
when the configured minimum is not satisfied.

## Static HTML reports

Generate an HTML report:

```bash
yellow-jacket coverage \
  --html \
  --output public/index.html
```

The resulting file is fully static.

It can be:

- opened locally
- uploaded as a CI artifact
- served by a static hosting service
- published with GitHub Pages

## GitHub Pages

A consumer-project example is available in:

```text
examples/ci/github-pages.yml
```

It generates:

```text
public/index.html
```

uploads it as a GitHub Pages artifact and deploys it.

The workflow preserves the original coverage status so a failed coverage gate
can still publish a report for inspection.

## Yellow Jacket documentation

The Yellow Jacket project documentation itself is also built as a static site
with VitePress and deployed using GitHub Pages.
