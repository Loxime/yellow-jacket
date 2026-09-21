# Get started

Yellow Jacket detects unintended HTTP behavior changes before your code is pushed.

It runs declared HTTP requests against your application, compares the responses
with a known-good baseline and exits with an error when an unexpected change is
detected.

## Requirements

- Node.js 24.12+
- Git for hook installation

## Install for development

Yellow Jacket is currently in early development and is not published to npm yet.

Clone the repository:

```bash
git clone https://github.com/Loxime/yellow-jacket.git
cd yellow-jacket
```

Install dependencies and verify the project:

```bash
npm install
npm test
```

Expose the CLI locally:

```bash
npm link
```

The `yellow-jacket` command is now available from other local projects.

## Initialize a project

Move to the application you want to protect:

```bash
cd ~/project/my-app
```

Initialize Yellow Jacket:

```bash
yellow-jacket init
```

This creates:

```text
yellow-jacket.config.mjs
```

A minimal configuration looks like this:

```js
import {
  defineConfig
} from 'yellow-jacket';

export default defineConfig({
  baseUrl:
    'http://localhost:3000',

  routes: [
    {
      name:
        'home',

      method:
        'GET',

      path:
        '/',

      expect: {
        status: 200
      }
    }
  ]
});
```

## Create a baseline

Start your application, then run:

```bash
yellow-jacket baseline
```

Yellow Jacket stores the known-good responses in:

```text
.yellow-jacket/snapshots/baseline.json
```

The baseline can be committed to Git.

## Detect regressions

After modifying your application:

```bash
yellow-jacket run
```

A successful run exits with code `0`.

An assertion failure or regression exits with code `1`.

## Install the Git hook

Install the pre-push integration:

```bash
yellow-jacket install
```

A normal:

```bash
git push
```

will then execute Yellow Jacket before the push is allowed to continue.

## Mutating requests

`POST`, `PUT`, `PATCH` and `DELETE` requests are restricted to local targets by
default.

Typical safe targets include:

```text
localhost
*.localhost
127.0.0.0/8
::1
*.local
```

To explicitly authorize actions against another target:

```bash
yellow-jacket run \
  --allow-actions
```

The same option can be used when creating a baseline:

```bash
yellow-jacket baseline \
  --allow-actions
```

Use this override only for a target that is intentionally allowed to receive
mutating requests.

## Next

Continue with [Configuration](/configuration) to declare routes, comparison
rules and coverage sources.

## Remove Yellow Jacket

To remove the integration while preserving configuration and snapshots:

```bash
yellow-jacket desetup
```

For a complete removal:

```bash
yellow-jacket desetup --purge
```

See [Desetup / uninstall](/desetup) for the exact cleanup behavior.
