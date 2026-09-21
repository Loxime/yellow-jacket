import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';

import {
  dirname,
  resolve
} from 'node:path';

import { diffBodies } from './diff.js';
import { normalizeBody } from './normalize.js';

import type {
  BaselineFile,
  CompareConfig,
  Regression,
  ResponseSnapshot,
  RouteRunResult,
  YellowJacketConfig
} from './types.js';

function normalizeSnapshot(
  snapshot: ResponseSnapshot,
  compare: CompareConfig | undefined
): ResponseSnapshot {
  return {
    ...snapshot,
    body: normalizeBody(
      snapshot.body,
      compare ?? {}
    )
  };
}

function normalizeContentType(
  value: string | null
): string | null {
  if (value === null) {
    return null;
  }

  const mediaType =
    value
      .split(
        ';',
        1
      )[0]
      ?.trim()
      .toLowerCase();

  return mediaType || null;
}

function comparedHeaderNames(
  compare: CompareConfig | undefined
): string[] {
  const names =
    new Set<string>();

  for (
    const name
    of compare?.headers ?? []
  ) {
    const normalized =
      name
        .trim()
        .toLowerCase();

    if (
      normalized &&
      normalized !==
        'content-type'
    ) {
      names.add(
        normalized
      );
    }
  }

  if (
    compare?.redirects
  ) {
    names.add(
      'location'
    );
  }

  return [
    ...names
  ];
}

function hasCapturedHeader(
  snapshot: ResponseSnapshot,
  name: string
): boolean {
  return (
    snapshot.responseHeaders !==
      undefined &&
    Object.prototype
      .hasOwnProperty
      .call(
        snapshot.responseHeaders,
        name
      )
  );
}

function formatHeaderValue(
  value: string | null
): string {
  return value === null
    ? 'null'
    : JSON.stringify(
        value
      );
}

export function baselinePath(
  config: YellowJacketConfig,
  cwd = process.cwd()
): string {
  return resolve(
    cwd,
    config.baselinePath ??
      '.yellow-jacket/snapshots/baseline.json'
  );
}

function snapshotFromResult(
  config: YellowJacketConfig,
  result: RouteRunResult
): ResponseSnapshot {
  const {
    passed: _passed,
    error: _error,
    ...snapshot
  } = result;

  return normalizeSnapshot(
    snapshot,
    config.compare
  );
}

export async function writeBaseline(
  config: YellowJacketConfig,
  results: RouteRunResult[],
  cwd = process.cwd()
): Promise<string> {
  const path = baselinePath(
    config,
    cwd
  );

  await mkdir(
    dirname(path),
    {
      recursive: true
    }
  );

  const baseline: BaselineFile = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    baseUrl: config.baseUrl,

    responses: results.map(
      ({
        passed: _passed,
        error: _error,
        ...snapshot
      }) =>
        normalizeSnapshot(
          snapshot,
          config.compare
        )
    )
  };

  await writeFile(
    path,
    `${JSON.stringify(
      baseline,
      null,
      2
    )}\n`,
    'utf8'
  );

  return path;
}

export async function updateBaseline(
  config: YellowJacketConfig,
  baseline: BaselineFile,
  results: RouteRunResult[],
  cwd = process.cwd()
): Promise<string> {
  const path =
    baselinePath(
      config,
      cwd
    );

  const replacements =
    new Map<
      string,
      ResponseSnapshot
    >();

  for (
    const result
    of results
  ) {
    const snapshot =
      snapshotFromResult(
        config,
        result
      );

    replacements.set(
      `${snapshot.method} ${snapshot.route}`,
      snapshot
    );
  }

  const responses =
    baseline.responses.map(
      (snapshot) => {
        const key =
          `${snapshot.method} ${snapshot.route}`;

        const replacement =
          replacements.get(
            key
          );

        if (
          replacement ===
          undefined
        ) {
          return snapshot;
        }

        replacements.delete(
          key
        );

        return replacement;
      }
    );

  responses.push(
    ...replacements.values()
  );

  const updated:
    BaselineFile = {
      formatVersion:
        1,

      createdAt:
        new Date()
          .toISOString(),

      baseUrl:
        config.baseUrl,

      responses
    };

  await mkdir(
    dirname(
      path
    ),
    {
      recursive:
        true
    }
  );

  await writeFile(
    path,
    `${JSON.stringify(
      updated,
      null,
      2
    )}\n`,
    'utf8'
  );

  return path;
}

export async function readBaseline(
  config: YellowJacketConfig,
  cwd = process.cwd()
): Promise<BaselineFile | null> {
  const path = baselinePath(
    config,
    cwd
  );

  try {
    return JSON.parse(
      await readFile(
        path,
        'utf8'
      )
    ) as BaselineFile;
  } catch (error) {
    const code = (
      error as NodeJS.ErrnoException
    ).code;

    if (code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export function compareWithBaseline(
  baseline: BaselineFile,
  results: RouteRunResult[],
  compare?: CompareConfig
): Regression[] {
  const expected =
    new Map<
      string,
      ResponseSnapshot
    >();

  for (const item of baseline.responses) {
    expected.set(
      `${item.method} ${item.route}`,
      item
    );
  }

  const regressions: Regression[] = [];

  const seen =
    new Set<string>();

  for (const currentRaw of results) {
    const current =
      normalizeSnapshot(
        currentRaw,
        compare
      );

    const key =
      `${current.method} ${current.route}`;

    seen.add(
      key
    );

    const previousRaw =
      expected.get(key);

    if (!previousRaw) {
      regressions.push({
        route: current.route,
        method: current.method,
        changes: [
          'route was not present in baseline'
        ]
      });

      continue;
    }

    const previous =
      normalizeSnapshot(
        previousRaw,
        compare
      );

    const changes: string[] = [];

    if (
      previous.status !==
      current.status
    ) {
      changes.push(
        `status ${previous.status} -> ${current.status}`
      );
    }

    const bodyChanges =
      diffBodies(
        previous.body,
        current.body
      );

    if (bodyChanges.length > 0) {
      changes.push(
        'response body changed'
      );
    }

    if (
      normalizeContentType(
        previous.contentType
      ) !==
      normalizeContentType(
        current.contentType
      )
    ) {
      changes.push(
        `content-type ${String(
          previous.contentType
        )} -> ${String(
          current.contentType
        )}`
      );
    }

    for (
      const name
      of comparedHeaderNames(
        compare
      )
    ) {
      if (
        !hasCapturedHeader(
          previous,
          name
        )
      ) {
        continue;
      }

      const before =
        previous
          .responseHeaders
          ?.[name] ??
        null;

      const after =
        current
          .responseHeaders
          ?.[name] ??
        null;

      if (
        before !==
        after
      ) {
        changes.push(
          `header ${name} ${formatHeaderValue(
            before
          )} -> ${formatHeaderValue(
            after
          )}`
        );
      }
    }

    if (
      compare?.redirects
    ) {
      if (
        previous.redirected !==
          undefined &&
        previous.redirected !==
          current.redirected
      ) {
        changes.push(
          `redirected ${String(
            previous.redirected
          )} -> ${String(
            current.redirected
          )}`
        );
      }

      if (
        previous.finalUrl !==
          undefined &&
        previous.finalUrl !==
          current.finalUrl
      ) {
        changes.push(
          `final URL ${String(
            previous.finalUrl
          )} -> ${String(
            current.finalUrl
          )}`
        );
      }
    }

    if (changes.length > 0) {
      regressions.push({
        route: current.route,
        method: current.method,
        changes,
        ...(bodyChanges.length > 0
          ? { bodyChanges }
          : {})
      });
    }
  }

  for (
    const [key, previous]
    of expected
  ) {
    if (
      seen.has(key)
    ) {
      continue;
    }

    regressions.push({
      route:
        previous.route,
      method:
        previous.method,
      changes: [
        'route is missing from current run'
      ]
    });
  }

  return regressions;
}
