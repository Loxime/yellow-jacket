# yellow-jacket

> Catch unintended HTTP behavior changes before they spread.

`yellow-jacket` is a developer-first HTTP regression tool inspired by Husky's local, installable workflow. It executes declared routes, stores a known-good baseline, and reports behavior changes directly in the terminal and CI.

## Status

Early development. The current scaffold already provides:

- `yellow-jacket init`
- GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS request execution
- status assertions
- JSON/text response snapshots
- `yellow-jacket baseline`
- `yellow-jacket run` with baseline comparison
- exit code `1` on assertion failure or regression
- zero runtime dependencies

## Local development

Requires Node.js 24.12+.

```bash
npm install
npm test
npm link
```

Then, from a project you want to test:

```bash
yellow-jacket init
yellow-jacket baseline
yellow-jacket run
```

The generated configuration looks like:

```js
import { defineConfig } from 'yellow-jacket';

export default defineConfig({
  baseUrl: process.env.YELLOW_JACKET_URL ?? 'http://localhost:3000',
  routes: [
    {
      name: 'home',
      method: 'GET',
      path: '/',
      expect: { status: 200 }
    }
  ]
});
```

## Repository synchronization

The intended local topology is:

- `origin`: `https://github.com/Loxime/yellow-jacket.git` - fetch + push
- `gitlab`: `git@gitlab.rusanor.fr:inquest/inquest-dev/yellow-jacket.git` - push only by convention

After cloning the GitHub repository, run:

```bash
./scripts/setup-remotes.sh
```

To publish the same commit to both hosts:

```bash
git push origin main
git push gitlab main
```

## Roadmap

The detailed technical roadmap is maintained in the project design PDF. The next implementation blocks are response normalization/ignore rules, scenarios with captured values, Git hooks, route coverage, provider integrations, HTML reports, and GitHub Pages documentation.
