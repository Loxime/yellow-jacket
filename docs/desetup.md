# Desetup / uninstall

Yellow Jacket can remove its integration from a project without deleting your
configuration or snapshots by default.

## Safe removal

Run:

```bash
yellow-jacket desetup
```

You can also use the more conventional alias:

```bash
yellow-jacket uninstall
```

The default operation removes the Yellow Jacket integration while preserving
project data that may have been edited or committed manually.

## What is removed

A normal `desetup` removes:

- the Yellow Jacket `pre-push` hook
- `core.hooksPath` when it points to `.yellow-jacket/hooks`
- npm scripts created by `yellow-jacket init`
- the `yellow-jacket` package dependency from the project

The package manager is used to remove the dependency, so dependencies that are
no longer required can be cleaned up normally by npm, pnpm or Yarn.

## What is preserved

By default, Yellow Jacket keeps:

```text
yellow-jacket.config.ts
yellow-jacket.config.mjs
yellow-jacket.config.js
.yellow-jacket/
```

This includes existing snapshots such as:

```text
.yellow-jacket/snapshots/baseline.json
```

This behavior is intentional.

Configuration and baselines may contain project-specific work and should not be
deleted automatically.

## Complete removal

To remove the integration and all Yellow Jacket project state:

```bash
yellow-jacket desetup --purge
```

or:

```bash
yellow-jacket uninstall --purge
```

`--purge` additionally removes:

- Yellow Jacket configuration files
- `.yellow-jacket/`
- stored baselines
- generated Yellow Jacket hook files

::: danger
`--purge` deletes Yellow Jacket configuration and snapshots from the current
project.

Commit or back up anything you want to keep before using it.
:::

## Existing Git hook managers

Yellow Jacket only removes `core.hooksPath` when its value is exactly:

```text
.yellow-jacket/hooks
```

If the repository now uses another hook manager, for example:

```text
.husky/_
```

Yellow Jacket leaves that configuration untouched.

## Package managers

Yellow Jacket detects the package manager using:

1. the `packageManager` field in `package.json`
2. `pnpm-lock.yaml`
3. `yarn.lock`
4. npm as the default

The equivalent package removal command is then used.

Examples:

```text
npm uninstall yellow-jacket
pnpm remove yellow-jacket
yarn remove yellow-jacket
```

## Example

Before:

```text
my-app/
├── .yellow-jacket/
│   ├── hooks/
│   │   └── pre-push
│   └── snapshots/
│       └── baseline.json
├── yellow-jacket.config.mjs
└── package.json
```

After:

```bash
yellow-jacket desetup
```

the configuration and snapshots remain available.

After:

```bash
yellow-jacket desetup --purge
```

the Yellow Jacket project files are removed completely.
