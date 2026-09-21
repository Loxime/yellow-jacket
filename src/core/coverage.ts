import {
  readFile
} from 'node:fs/promises';

import {
  dirname,
  resolve
} from 'node:path';

import {
  fileURLToPath
} from 'node:url';

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

interface DeclaredOperation {
  method: CoverageMethod;
  path: string;
}

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
    return new URL(
      path
    ).pathname;
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

  // yellow-jacket variables:
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

  // Express parameters:
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

    configured.set(
      operationKey(
        method,
        route.path
      ),
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

      if (!configured.has(key)) {
        configured.set(
          key,
          `scenario: ${scenario.name} > ${step.name ?? step.path}`
        );
      }
    }
  }

  return configured;
}

function sortOperations(
  operations: DeclaredOperation[]
): DeclaredOperation[] {
  return operations.sort(
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
}

function parseOpenApiOperations(
  document: unknown
): DeclaredOperation[] {
  if (!isRecord(document)) {
    throw new Error(
      'OpenAPI document must contain a JSON object.'
    );
  }

  if (
    typeof document.openapi !== 'string' ||
    !document.openapi.startsWith('3.')
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
    DeclaredOperation[] = [];

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
      if (
        !isRecord(
          pathItem[method]
        )
      ) {
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

  return operations;
}

function decodeXmlEntities(
  value: string
): string {
  const decodedNumeric =
    value
      .replace(
        /&#x([0-9a-f]+);/gi,
        (match, code: string) => {
          const value =
            Number.parseInt(
              code,
              16
            );

          if (
            !Number.isFinite(value) ||
            value < 0 ||
            value > 0x10ffff
          ) {
            return match;
          }

          return String.fromCodePoint(
            value
          );
        }
      )
      .replace(
        /&#([0-9]+);/g,
        (match, code: string) => {
          const value =
            Number.parseInt(
              code,
              10
            );

          if (
            !Number.isFinite(value) ||
            value < 0 ||
            value > 0x10ffff
          ) {
            return match;
          }

          return String.fromCodePoint(
            value
          );
        }
      );

  return decodedNumeric
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function unwrapCdata(
  value: string
): string {
  const match =
    value.match(
      /^<!\[CDATA\[([\s\S]*)\]\]>$/
    );

  return (
    match?.[1] ??
    value
  );
}

function sitemapLocations(
  xml: string
): string[] {
  const locations:
    string[] = [];

  const pattern =
    /<(?:[A-Za-z_][\w.-]*:)?loc\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?loc\s*>/gi;

  for (
    const match
    of xml.matchAll(pattern)
  ) {
    const raw =
      match[1]?.trim();

    if (!raw) {
      continue;
    }

    const location =
      decodeXmlEntities(
        unwrapCdata(
          raw
        ).trim()
      );

    if (location) {
      locations.push(
        location
      );
    }
  }

  return locations;
}

type SitemapDocument =
  | {
      kind: 'urlset';
      operations:
        DeclaredOperation[];
    }
  | {
      kind: 'index';
      locations:
        string[];
    };

function parseSitemapDocument(
  xml: string
): SitemapDocument {
  if (
    /<(?:[A-Za-z_][\w.-]*:)?sitemapindex\b/i.test(
      xml
    )
  ) {
    return {
      kind:
        'index',
      locations:
        sitemapLocations(
          xml
        )
    };
  }

  if (
    !/<(?:[A-Za-z_][\w.-]*:)?urlset\b/i.test(
      xml
    )
  ) {
    throw new Error(
      'Sitemap file does not contain a valid <urlset> or <sitemapindex>.'
    );
  }

  return {
    kind:
      'urlset',

    operations:
      sitemapLocations(
        xml
      ).map(
        (location) => ({
          method:
            'GET',
          path:
            normalizeCoveragePath(
              location
            )
        })
      )
  };
}

function resolveSitemapChild(
  location: string,
  parentPath: string
): string {
  if (
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(
      location
    )
  ) {
    const url =
      new URL(
        location
      );

    if (
      url.protocol ===
      'file:'
    ) {
      return fileURLToPath(
        url
      );
    }

    throw new Error(
      `Remote sitemap index entry is not supported: ${location}. Coverage discovery does not perform HTTP requests.`
    );
  }

  return resolve(
    dirname(
      parentPath
    ),
    location
  );
}

async function readCoverageFile(
  configuredPath: string,
  cwd: string,
  label: string
): Promise<{
  path: string;
  content: string;
}> {
  const path =
    resolve(
      cwd,
      configuredPath
    );

  try {
    return {
      path,
      content:
        await readFile(
          path,
          'utf8'
        )
    };
  } catch (error) {
    if (
      (
        error as NodeJS.ErrnoException
      ).code === 'ENOENT'
    ) {
      throw new Error(
        `${label} file not found: ${path}`
      );
    }

    throw error;
  }
}

async function readSitemapTree(
  configuredPath: string,
  cwd: string
): Promise<{
  operations:
    DeclaredOperation[];
  sources:
    string[];
}> {
  const operations:
    DeclaredOperation[] = [];

  const sources:
    string[] = [];

  const visited =
    new Set<string>();

  async function visit(
    sitemapPath: string
  ): Promise<void> {
    const absolutePath =
      resolve(
        cwd,
        sitemapPath
      );

    if (
      visited.has(
        absolutePath
      )
    ) {
      return;
    }

    visited.add(
      absolutePath
    );

    const sitemap =
      await readCoverageFile(
        absolutePath,
        cwd,
        'Sitemap'
      );

    sources.push(
      sitemap.path
    );

    const document =
      parseSitemapDocument(
        sitemap.content
      );

    if (
      document.kind ===
      'urlset'
    ) {
      operations.push(
        ...document.operations
      );

      return;
    }

    for (
      const location
      of document.locations
    ) {
      await visit(
        resolveSitemapChild(
          location,
          sitemap.path
        )
      );
    }
  }

  await visit(
    configuredPath
  );

  return {
    operations,
    sources
  };
}

export async function buildCoverageReport(
  config: YellowJacketConfig,
  cwd = process.cwd()
): Promise<CoverageReport> {
  const openapiPath =
    config.coverage?.openapi;

  const sitemapPath =
    config.coverage?.sitemap;

  if (
    !openapiPath &&
    !sitemapPath
  ) {
    throw new Error(
      [
        'No coverage source configured.',
        '',
        'Configure OpenAPI, sitemap, or both:',
        '',
        'coverage: {',
        "  openapi: './openapi.json',",
        "  sitemap: './sitemap.xml'",
        '}'
      ].join('\n')
    );
  }

  const declared =
    new Map<
      string,
      DeclaredOperation
    >();

  const sources:
    string[] = [];

  if (openapiPath) {
    const openapi =
      await readCoverageFile(
        openapiPath,
        cwd,
        'OpenAPI'
      );

    let document: unknown;

    try {
      document =
        JSON.parse(
          openapi.content
        ) as unknown;
    } catch {
      throw new Error(
        `OpenAPI file is not valid JSON: ${openapi.path}`
      );
    }

    for (
      const operation
      of parseOpenApiOperations(
        document
      )
    ) {
      declared.set(
        operationKey(
          operation.method,
          operation.path
        ),
        operation
      );
    }

    sources.push(
      openapi.path
    );
  }

  if (sitemapPath) {
    const sitemapTree =
      await readSitemapTree(
        sitemapPath,
        cwd
      );

    for (
      const operation
      of sitemapTree.operations
    ) {
      const key =
        operationKey(
          operation.method,
          operation.path
        );

      if (
        !declared.has(key)
      ) {
        declared.set(
          key,
          operation
        );
      }
    }

    sources.push(
      ...sitemapTree.sources
    );
  }

  const configured =
    configuredOperations(
      config
    );

  const declaredOperations =
    sortOperations(
      [
        ...declared.values()
      ]
    );

  const operations:
    CoverageOperation[] =
      declaredOperations.map(
        (operation) => {
          const matchedBy =
            configured.get(
              operationKey(
                operation.method,
                operation.path
              )
            );

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

  const minimum =
    config.coverage?.minimum;

  const passed =
    minimum === undefined ||
    percentage >= minimum;

  return {
    source:
      sources.join(', '),
    total,
    covered,
    uncovered:
      total - covered,
    percentage,

    ...(minimum !== undefined
      ? {
          minimum
        }
      : {}),

    passed,
    operations
  };
}
