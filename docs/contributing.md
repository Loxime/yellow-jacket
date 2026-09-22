# Feedback and contributing

Yellow Jacket is developed in public and user feedback is welcome.

## Report a bug

A useful bug report includes:

- Yellow Jacket version
- Node.js version
- operating system or CI environment
- the command that failed
- expected and actual behavior
- a minimal reproduction when possible

Remove secrets, credentials and private response data before posting logs or
configuration.

## Request a feature

Describe the workflow you are trying to improve before describing the proposed
solution.

Useful examples include:

- the current command or configuration
- the desired command or configuration
- why the existing behavior is insufficient
- any workaround currently required

## Share usage feedback

Feedback does not need to describe a defect.

Useful feedback includes:

- onboarding friction
- confusing CLI output
- difficult configuration
- noisy CI reports
- missing documentation
- unexpectedly useful features

## Development checks

Before submitting a code contribution:

```bash
git diff --check
npm run check
npm test
npm run docs:build
```

See the repository `CONTRIBUTING.md` for the full contribution workflow.
