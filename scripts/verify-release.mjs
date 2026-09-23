#!/usr/bin/env node

import assert from 'node:assert/strict';

import {
  readFile
} from 'node:fs/promises';

const tag =
  process.argv[2] ??
  process.env.GITHUB_REF_NAME;

if (
  !tag
) {
  throw new Error(
    'Release tag is required. Example: npm run release:verify -- v0.5.0'
  );
}

if (
  !/^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(
    tag
  )
) {
  throw new Error(
    `Invalid release tag: ${tag}`
  );
}

const version =
  tag.slice(
    1
  );

const packageJson =
  JSON.parse(
    await readFile(
      new URL(
        '../package.json',
        import.meta.url
      ),
      'utf8'
    )
  );

const packageLock =
  JSON.parse(
    await readFile(
      new URL(
        '../package-lock.json',
        import.meta.url
      ),
      'utf8'
    )
  );

const changelog =
  await readFile(
    new URL(
      '../CHANGELOG.md',
      import.meta.url
    ),
    'utf8'
  );

assert.equal(
  packageJson.version,
  version,
  `package.json version ${packageJson.version} does not match ${tag}`
);

assert.equal(
  packageLock.version,
  version,
  `package-lock.json version ${packageLock.version} does not match ${tag}`
);

assert.equal(
  packageLock.packages?.['']
    ?.version,
  version,
  `package-lock root version does not match ${tag}`
);

assert.equal(
  packageJson.repository?.url,
  'git+https://github.com/Loxime/yellow-jacket.git',
  'package.json repository URL does not match the publishing repository'
);

assert.equal(
  packageJson.publishConfig
    ?.access,
  'public',
  'package must be configured for public npm publishing'
);

assert.match(
  changelog,
  new RegExp(
    `^## ${version.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}$`,
    'm'
  ),
  `CHANGELOG.md does not contain a ${version} release heading`
);

console.log(
  `Release metadata verified for ${tag}.`
);
