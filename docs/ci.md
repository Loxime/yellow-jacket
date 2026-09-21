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
