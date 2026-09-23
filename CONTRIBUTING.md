# Contributing to Yellow Jacket

Thanks for helping improve Yellow Jacket.

## User feedback

Feedback is useful even when it is not a bug.

Use the repository issue templates for:

- reproducible bugs
- feature requests
- usability or documentation feedback

Yellow Jacket is developed on GitHub and mirrored on GitLab. Feedback can be
reported on either platform.

## Before reporting a bug

Please include:

- Yellow Jacket version
- Node.js version
- operating system or CI environment
- the command you ran
- expected behavior
- actual behavior
- a minimal reproduction when possible

Never include:

- authentication tokens
- API keys
- passwords
- cookies or session identifiers
- private production response bodies

Reduce configuration and HTTP output before publishing it.

## Development

Install dependencies:

```bash
npm ci
```

Run the complete validation:

```bash
npm run check
npm test
npm run test:package
npm run docs:build
```

## Pull requests

Keep changes focused and include tests for behavior changes.

Before opening a pull request:

```bash
git diff --check
npm run check
npm test
npm run test:package
npm run docs:build
```

For user-visible behavior, update the README, documentation or changelog when
appropriate.
