# Releasing Yellow Jacket

npm publication is performed by GitHub Actions using npm Trusted Publishing
with OIDC.

Do not store a long-lived npm publish token in GitHub Actions.

## Prepare a release

Start from an up-to-date `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c release/vX.Y.Z
```

Update the package version without creating a tag:

```bash
npm version X.Y.Z --no-git-tag-version
```

Move the relevant `CHANGELOG.md` entries from `Unreleased` to:

```text
## X.Y.Z
```

Verify release metadata:

```bash
npm run release:verify -- vX.Y.Z
```

Run the full validation:

```bash
git diff --check
npm run check
npm test
npm run test:package
npm run docs:build
npm pack --dry-run
```

Commit and open a release preparation pull request.

## Merge and tag

After the release PR and all required checks are green, merge it into `main`.

Synchronize both remotes:

```bash
git switch main
git pull --ff-only origin main
git push gitlab main
```

Record the exact merge commit:

```bash
git rev-parse HEAD
```

Create an annotated tag pointing to that exact merge commit:

```bash
git tag -a vX.Y.Z <MERGE_SHA> -m "vX.Y.Z"

git push origin vX.Y.Z
git push gitlab vX.Y.Z
```

Pushing the GitHub tag starts `.github/workflows/publish.yml`.

The workflow verifies that:

- the tag matches `package.json`
- `package-lock.json` matches the package version
- the changelog contains the release version
- TypeScript validation succeeds
- documentation builds
- the npm package can be packed
- `prepublishOnly` tests the project and packed distribution

It then publishes to npm using OIDC.

## Verify npm

After registry propagation:

```bash
npm view @falche/yellow-jacket@X.Y.Z \
  version gitHead dist.tarball \
  --registry=https://registry.npmjs.org/ \
  --prefer-online

npm view @falche/yellow-jacket dist-tags \
  --registry=https://registry.npmjs.org/ \
  --prefer-online
```

`gitHead` must match the tagged release merge commit.

Run a fresh-registry consumer smoke when release behavior or package exports
changed.

## GitHub Release

After npm publication is confirmed:

```bash
gh release create vX.Y.Z \
  --title "Yellow Jacket vX.Y.Z" \
  --generate-notes
```

## Recovery

Do not move or recreate an already published release tag.

If a published package contains a defect, release a new patch version.

Manual `npm publish` should be reserved for recovery when the trusted
publishing workflow itself cannot be used.
