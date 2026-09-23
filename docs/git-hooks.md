# Git hooks

Yellow Jacket can act as an HTTP regression gate before code leaves the
developer machine.

## Install the hook

Run:

```bash
yellow-jacket install
```

Yellow Jacket creates:

```text
.yellow-jacket/
└── hooks/
    └── pre-push
```

and configures the repository with:

```bash
git config \
  --local \
  core.hooksPath \
  .yellow-jacket/hooks
```

## Push flow

After installation:

```text
git push
    |
    v
yellow-jacket run
    |
    +-- no regression --> push continues
    |
    +-- regression ----> push stops
```

The hook executes the same Yellow Jacket configuration used manually.

## Exit behavior

A successful run returns:

```text
exit 0
```

Assertions or regressions return:

```text
exit 1
```

Git uses that exit code to decide whether the push can continue.

## Temporary bypass

Skip Yellow Jacket for one push:

```bash
YELLOW_JACKET=0 git push
```

The bypass applies only to that command invocation.

## Existing hook managers

Yellow Jacket does not silently overwrite an existing `core.hooksPath`.

If a repository already uses another hook manager, such as Husky, Yellow Jacket
asks you to chain the command instead.

For example, call:

```bash
yellow-jacket run
```

from the existing pre-push hook.

## Action safety

The generated Yellow Jacket hook does not pass:

```text
--allow-actions
```

This means mutating requests remain restricted to localhost and loopback
targets by default. Redirects that preserve a mutating method are checked before
the next request is sent.

That behavior is intentional: a normal `git push` should never silently trigger
a destructive request against a remote production API.
