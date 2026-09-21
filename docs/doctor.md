# Doctor

`yellow-jacket doctor` checks the local Yellow Jacket installation and project
configuration without sending any HTTP requests.

Run:

```bash
yellow-jacket doctor
```

For machine-readable output:

```bash
yellow-jacket doctor --json
```

## Checks

Doctor currently inspects:

- the Node.js version
- `package.json`
- the detected package manager
- the declared `yellow-jacket` dependency
- the Yellow Jacket configuration
- the baseline file
- configured OpenAPI and sitemap coverage sources
- the Git repository
- `core.hooksPath`
- the Yellow Jacket pre-push hook

Doctor never executes configured routes or scenarios.

## Status levels

Each check has one of three states:

```text
pass
warning
error
```

A warning describes an optional or incomplete integration, for example:

- no baseline yet
- no coverage source configured
- no Git repository
- another Git hook manager is already configured

Warnings do not make the command fail.

An error indicates a broken required configuration, for example:

- unsupported Node.js version
- invalid Yellow Jacket configuration
- unreadable baseline
- configured OpenAPI file missing
- Yellow Jacket owns `core.hooksPath` but its pre-push hook is missing

## Exit codes

```text
exit 0 = no errors
exit 1 = one or more errors
```

Warnings alone still return exit code `0`.

## CI

Doctor can be used before HTTP tests:

```bash
yellow-jacket doctor
yellow-jacket run
```

Or consumed as JSON:

```bash
yellow-jacket doctor --json
```

This can help distinguish a project/setup problem from an actual HTTP
regression.
