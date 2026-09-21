# Test selection

Yellow Jacket can execute a subset of configured routes and scenarios.

## Select a route

Routes can be selected by their configured name:

```bash
yellow-jacket run --route health
```

or by their path:

```bash
yellow-jacket run --route /health
```

The option can be repeated:

```bash
yellow-jacket run \
  --route health \
  --route users
```

## Select a scenario

Select a complete scenario by name:

```bash
yellow-jacket run --scenario checkout
```

A selected scenario always runs from its first step.

Yellow Jacket does not select individual scenario steps because later steps can
depend on variables captured by earlier steps.

## Tags

Routes and scenarios can declare tags:

```js
export default defineConfig({
  baseUrl: 'http://localhost:3000',

  routes: [
    {
      name: 'health',
      path: '/health',
      tags: ['smoke']
    }
  ],

  scenarios: [
    {
      name: 'checkout',
      tags: ['smoke', 'commerce'],

      steps: [
        {
          name: 'create cart',
          method: 'POST',
          path: '/cart'
        }
      ]
    }
  ]
});
```

Run all matching targets:

```bash
yellow-jacket run --tag smoke
```

## Combining selectors

Different selectors form a union.

For example:

```bash
yellow-jacket run \
  --route health \
  --scenario checkout \
  --tag critical
```

runs every target matching any of those selectors.

If nothing matches, Yellow Jacket exits with code `2`.

## Baselines

Selectors are supported by `run`, but not by `baseline`.

This is intentional:

```bash
yellow-jacket baseline --tag smoke
```

is rejected rather than replacing a complete baseline with a partial snapshot.

During a filtered `run`, Yellow Jacket filters the existing baseline to the
selected routes and scenarios before comparison. Unselected baseline entries
are therefore not reported as missing.
