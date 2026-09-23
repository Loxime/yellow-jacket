# Security policy

Yellow Jacket executes HTTP requests and can run mutating actions, so security
issues affecting target authorization, redirect handling, secret exposure,
package publication or Git integration are treated seriously.

## Supported versions

Security fixes are provided for the latest published Yellow Jacket release.

Older versions may receive fixes when practical, but users should upgrade to
the latest release before reporting an issue that has already been corrected.

## Reporting a vulnerability

Do not report security vulnerabilities in a public GitHub or GitLab issue.

Use GitHub private vulnerability reporting:

https://github.com/Loxime/yellow-jacket/security/advisories/new

Include, when possible:

- the affected Yellow Jacket version
- the operating system and Node.js version
- a minimal reproduction
- the expected and observed behavior
- the potential impact
- whether the issue can expose secrets or send unintended HTTP mutations

Do not include production credentials, access tokens, session cookies or
private response payloads unless a secure channel has explicitly been agreed.

## Scope

Examples of security-sensitive behavior include:

- mutating HTTP requests reaching an unauthorized destination
- redirect safety bypasses
- secrets appearing in persisted baselines or reports
- Git hook behavior executing unintended commands
- package or release integrity problems
- dependency or supply-chain compromise

Normal HTTP regressions and feature requests should use the regular issue
templates instead.

## Disclosure

Please allow reasonable time to investigate and release a fix before public
disclosure.

When appropriate, fixes will be documented in the changelog and released as a
new package version.
