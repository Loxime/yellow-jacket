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

  return regressions;
}
