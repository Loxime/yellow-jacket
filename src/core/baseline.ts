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
  HttpMethod,
  Regression,
  ResponseSnapshot,
  RouteRunResult,
  YellowJacketConfig
} from './types.js';

const BASELINE_HTTP_METHODS:
  ReadonlySet<string> =
    new Set([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS'
    ]);

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value ===
      'object' &&
    !Array.isArray(
      value
    )
  );
}

function invalidBaseline(
  source: string,
  message: string
): never {
  throw new Error(
    `Invalid baseline at ${source}: ${message}`
  );
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  source: string
): string {
  const result =
    value[key];

  if (
    typeof result !==
      'string' ||
    result.length ===
      0
  ) {
    invalidBaseline(
      source,
      `${key} must be a non-empty string.`
    );
  }

  return result;
}

function validateResponseSnapshot(
  value: unknown,
  index: number,
  source: string
): ResponseSnapshot {
  const itemSource =
    `${source} responses[${index}]`;

  if (
    !isRecord(
      value
    )
  ) {
    invalidBaseline(
      itemSource,
      'response must be an object.'
    );
  }

  const route =
    requiredString(
      value,
      'route',
      itemSource
    );

  const rawMethod =
    requiredString(
      value,
      'method',
      itemSource
    );

  if (
    !BASELINE_HTTP_METHODS.has(
      rawMethod
    )
  ) {
    invalidBaseline(
      itemSource,
      `method "${rawMethod}" is not supported.`
    );
  }

  requiredString(
    value,
    'url',
    itemSource
  );

  const status =
    value.status;

  if (
    typeof status !==
      'number' ||
    !Number.isInteger(
      status
    ) ||
    status <
      100 ||
    status >
      599
  ) {
    invalidBaseline(
      itemSource,
      'status must be an HTTP status between 100 and 599.'
    );
  }

  if (
    value.contentType !==
      null &&
    typeof value.contentType !==
      'string'
  ) {
    invalidBaseline(
      itemSource,
      'contentType must be a string or null.'
    );
  }

  if (
    !Object.prototype
      .hasOwnProperty
      .call(
        value,
        'body'
      )
  ) {
    invalidBaseline(
      itemSource,
      'body is required.'
    );
  }

  const durationMs =
    value.durationMs;

  if (
    typeof durationMs !==
      'number' ||
    !Number.isFinite(
      durationMs
    ) ||
    durationMs <
      0
  ) {
    invalidBaseline(
      itemSource,
      'durationMs must be a non-negative finite number.'
    );
  }

  const responseHeaders =
    value.responseHeaders;

  if (
    responseHeaders !==
      undefined
  ) {
    if (
      !isRecord(
        responseHeaders
      )
    ) {
      invalidBaseline(
        itemSource,
        'responseHeaders must be an object.'
      );
    }

    for (
      const [
        name,
        headerValue
      ]
      of Object.entries(
        responseHeaders
      )
    ) {
      if (
        headerValue !==
          null &&
        typeof headerValue !==
          'string'
      ) {
        invalidBaseline(
          itemSource,
          `responseHeaders.${name} must be a string or null.`
        );
      }
    }
  }

  if (
    value.redirected !==
      undefined &&
    typeof value.redirected !==
      'boolean'
  ) {
    invalidBaseline(
      itemSource,
      'redirected must be a boolean.'
    );
  }

  if (
    value.finalUrl !==
      undefined &&
    (
      typeof value.finalUrl !==
        'string' ||
      value.finalUrl.length ===
        0
    )
  ) {
    invalidBaseline(
      itemSource,
      'finalUrl must be a non-empty string.'
    );
  }

  return value as unknown as
    ResponseSnapshot;
}

export function snapshotKey(
  method: HttpMethod,
  route: string
): string {
  return `${method} ${route}`;
}

function parseBaselineFile(
  value: unknown,
  source: string
): BaselineFile {
  if (
    !isRecord(
      value
    )
  ) {
    invalidBaseline(
      source,
      'root value must be an object.'
    );
  }

  if (
    value.formatVersion !==
      1
  ) {
    invalidBaseline(
      source,
      `expected formatVersion 1, received ${JSON.stringify(
        value.formatVersion
      )}.`
    );
  }

  const createdAt =
    requiredString(
      value,
      'createdAt',
      source
    );

  const baseUrl =
    requiredString(
      value,
      'baseUrl',
      source
    );

  if (
    !Array.isArray(
      value.responses
    )
  ) {
    invalidBaseline(
      source,
      'responses must be an array.'
    );
  }

  const responses =
    value.responses.map(
      (
        response,
        index
      ) =>
        validateResponseSnapshot(
          response,
          index,
          source
        )
    );

  const identities =
    new Set<string>();

  for (
    const response
    of responses
  ) {
    const key =
      snapshotKey(
        response.method,
        response.route
      );

    if (
      identities.has(
        key
      )
    ) {
      invalidBaseline(
        source,
        `duplicate response identity "${key}".`
      );
    }

    identities.add(
      key
    );
  }

  return {
    formatVersion:
      1,
    createdAt,
    baseUrl,
    responses
  };
}

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
    attempts: _attempts,
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
      (result) =>
        snapshotFromResult(
          config,
          result
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
      snapshotKey(
        snapshot.method,
        snapshot.route
      ),
      snapshot
    );
  }

  const responses =
    baseline.responses.map(
      (snapshot) => {
        const key =
          snapshotKey(
            snapshot.method,
            snapshot.route
          );

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

  let contents:
    string;

  try {
    contents =
      await readFile(
        path,
        'utf8'
      );
  } catch (error) {
    const code =
      (
        error as NodeJS.ErrnoException
      ).code;

    if (
      code ===
        'ENOENT'
    ) {
      return null;
    }

    throw error;
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        contents
      ) as unknown;
  } catch (error) {
    throw new Error(
      `Baseline is not valid JSON at ${path}: ${
        error instanceof Error
          ? error.message
          : String(
              error
            )
      }`
    );
  }

  return parseBaselineFile(
    parsed,
    path
  );
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
      snapshotKey(
        item.method,
        item.route
      ),
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
      snapshotKey(
        current.method,
        current.route
      );

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
