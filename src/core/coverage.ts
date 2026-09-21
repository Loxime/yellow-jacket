import {
  readFile
} from 'node:fs/promises';

import {
  resolve
} from 'node:path';

import type {
  CoverageMethod,
  CoverageOperation,
  CoverageReport,
  HttpMethod,
  RouteDefinition,
  YellowJacketConfig
} from './types.js';

const OPENAPI_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace'
] as const;

const METHOD_ORDER:
  CoverageMethod[] = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
    'TRACE'
  ];

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function stripQueryAndHash(
  path: string
): string {
  try {
    const url =
      new URL(path);

    return url.pathname;
  } catch {
    return (
      path.split(
        /[?#]/,
        1
      )[0] ?? path
    );
  }
}

export function normalizeCoveragePath(
  input: string
): string {
  let path =
    stripQueryAndHash(
      input.trim()
    );

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // yellow-jacket scenario variables:
  // /users/{{userId}}
  path = path.replace(
    /\{\{\s*[^{}]+\s*\}\}/g,
    '{}'
  );

  // OpenAPI parameters:
  // /users/{id}
  path = path.replace(
    /\{[^/{}]+\}/g,
    '{}'
  );

  // Express-style parameters:
  // /users/:id
  path = path.replace(
    /(^|\/):[^/]+(?=\/|$)/g,
    '$1{}'
  );

  path = path.replace(
    /\/+/g,
    '/'
  );

  if (
    path.length > 1 &&
    path.endsWith('/')
  ) {
    path =
      path.slice(
        0,
        -1
      );
  }

  return path;
}

function operationKey(
  method: CoverageMethod,
  path: string
): string {
  return `${method} ${normalizeCoveragePath(path)}`;
}

function routeMethod(
  route: RouteDefinition
): HttpMethod {
  return route.method ?? 'GET';
}

function configuredOperations(
  config: YellowJacketConfig
): Map<string, string> {
  const configured =
    new Map<string, string>();

  for (
    const route
    of config.routes ?? []
  ) {
    const method =
      routeMethod(route);

    const key =
      operationKey(
        method,
        route.path
      );

    configured.set(
      key,
      `route: ${route.name ?? route.path}`
    );
  }

  for (
    const scenario
    of config.scenarios ?? []
  ) {
    for (
      const step
      of scenario.steps
    ) {
      const method =
        routeMethod(step);

      const key =
        operationKey(
          method,
          step.path
        );

      if (
        !configured.has(key)
      ) {
        configured.set(
          key,
          `scenario: ${scenario.name} > ${step.name ?? step.path}`
        );
      }
    }
  }

  return configured;
}

function parseOpenApiOperations(
  document: unknown
): Array<{
  method: CoverageMethod;
  path: string;
}> {
  if (!isRecord(document)) {
    throw new Error(
      'OpenAPI document must contain a JSON object.'
    );
  }

  if (
    typeof document.openapi !==
      'string' ||
    !document.openapi.startsWith(
      '3.'
    )
  ) {
    throw new Error(
      'yellow-jacket coverage currently supports OpenAPI 3.x JSON documents.'
    );
  }

  if (!isRecord(document.paths)) {
    throw new Error(
      'OpenAPI document does not contain a valid "paths" object.'
    );
  }

  const operations:
    Array<{
      method: CoverageMethod;
      path: string;
    }> = [];

  for (
    const [path, pathItem]
    of Object.entries(
      document.paths
    )
  ) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (
      const method
      of OPENAPI_METHODS
    ) {
      const operation =
        pathItem[method];

      if (!isRecord(operation)) {
        continue;
      }

      operations.push({
        method: (
          method.toUpperCase()
        ) as CoverageMethod,
        path
      });
    }
  }

  operations.sort(
    (left, right) => {
      const pathComparison =
        left.path.localeCompare(
          right.path
        );

      if (
        pathComparison !== 0
      ) {
        return pathComparison;
      }

      return (
        METHOD_ORDER.indexOf(
          left.method
        ) -
        METHOD_ORDER.indexOf(
          right.method
        )
      );
    }
  );

  return operations;
}

export async function buildCoverageReport(
  config: YellowJacketConfig,
  cwd = process.cwd()
): Promise<CoverageReport> {
  const configuredPath =
    config.coverage?.openapi;

  if (!configuredPath) {
    throw new Error(
      [
        'No OpenAPI coverage source configured.',
        '',
        'Add this to yellow-jacket.config:',
        '',
        'coverage: {',
        "  openapi: './openapi.json'",
        '}'
      ].join('\n')
    );
  }

  const source =
    resolve(
      cwd,
      configuredPath
    );

  let raw: string;

  try {
    raw =
      await readFile(
        source,
        'utf8'
      );
  } catch (error) {
    const code =
      (
        error as NodeJS.ErrnoException
      ).code;

    if (code === 'ENOENT') {
      throw new Error(
        `OpenAPI file not found: ${source}`
      );
    }

    throw error;
  }

  let document: unknown;

  try {
    document =
      JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      `OpenAPI file is not valid JSON: ${source}`
    );
  }

  const declared =
    parseOpenApiOperations(
      document
    );

  const configured =
    configuredOperations(
      config
    );

  const operations:
    CoverageOperation[] =
      declared.map(
        (operation) => {
          const key =
            operationKey(
              operation.method,
              operation.path
            );

          const matchedBy =
            configured.get(key);

          return {
            method:
              operation.method,
            path:
              operation.path,
            covered:
              matchedBy !==
              undefined,

            ...(matchedBy
              ? {
                  matchedBy
                }
              : {})
          };
        }
      );

  const covered =
    operations.filter(
      (operation) =>
        operation.covered
    ).length;

  const total =
    operations.length;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (
            covered /
            total
          ) *
            10_000
        ) / 100;

  return {
    source,
    total,
    covered,
    uncovered:
      total - covered,
    percentage,
    operations
  };
}
