# Troubleshooting

Common Yellow Jacket problems and their expected solutions.

## No configuration found

Error:

```text
No yellow-jacket config found
```

Run Yellow Jacket from an application containing a configuration file.

Create one with:

```bash
yellow-jacket init
```

The expected file is:

```text
yellow-jacket.config.mjs
```

The Yellow Jacket source repository itself intentionally has no application
configuration.

## No baseline found

Message:

```text
No baseline found.
Run "yellow-jacket baseline" to create one.
```

Create the known-good snapshot:

```bash
yellow-jacket baseline
```

Then run:

```bash
yellow-jacket run
```

## Mutating request blocked

Example:

```text
Blocked POST request to api.example.com.
```

Mutating requests to non-local targets are blocked by default.

For an environment that is intentionally authorized:

```bash
yellow-jacket run \
  --allow-actions
```

or:

```bash
yellow-jacket baseline \
  --allow-actions
```

Do not enable this flag for an unintended production target.

## Coverage source missing

Yellow Jacket coverage requires at least one inventory.

OpenAPI:

```js
coverage: {
  openapi:
    './openapi.json'
}
```

Sitemap:

```js
coverage: {
  sitemap:
    './sitemap.xml'
}
```

Or combine both.

## OpenAPI document rejected

Yellow Jacket currently supports OpenAPI 3.x JSON documents.

Verify that the document contains:

```json
{
  "openapi": "3.1.0",
  "paths": {}
}
```

## Remote sitemap index rejected

Sitemap index discovery is intentionally local.

A child such as:

```text
https://example.com/sitemap-pages.xml
```

is rejected because coverage discovery does not perform HTTP requests.

Use a local sitemap file instead.

## Existing Git hook manager

If `yellow-jacket install` detects an existing `core.hooksPath`, it refuses to
overwrite it.

Chain:

```bash
yellow-jacket run
```

from the existing pre-push hook.

## Skip the pre-push check once

```bash
YELLOW_JACKET=0 git push
```

## VitePress reports a dead link

When working on the Yellow Jacket documentation, VitePress checks internal links.

For example:

```text
Found dead link /get-started
```

means that the referenced Markdown page does not exist yet.

Create the page rather than disabling dead-link checking.
