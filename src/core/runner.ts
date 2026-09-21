import {
  runScenario
} from './scenario.js';

import type {
  HttpMethod,
  RouteDefinition,
  RouteRunResult,
  RunOptions,
  YellowJacketConfig
} from './types.js';

const ACTION_METHODS:
  ReadonlySet<HttpMethod> =
    new Set([
      'POST',
      'PUT',
      'PATCH',
      'DELETE'
    ]);

function expectedStatusMatches(
  route: RouteDefinition,
  status: number
): boolean {
  const expected =
    route.expect?.status;

  if (expected === undefined) {
    return true;
  }

  return Array.isArray(expected)
    ? expected.includes(status)
    : expected === status;
}

function parseBody(
  text: string,
  contentType: string | null
): unknown {
  if (text.length === 0) {
    return null;
  }

  if (
    contentType
      ?.toLowerCase()
      .includes('json')
  ) {
    try {
      return JSON.parse(
        text
      ) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

export function isActionMethod(
  method: HttpMethod
): boolean {
  return ACTION_METHODS.has(
    method
  );
}

function normalizeHostname(
  hostname: string
): string {
  let value =
    hostname
      .toLowerCase()
      .replace(/\.$/, '');

  if (
    value.startsWith('[') &&
    value.endsWith(']')
  ) {
    value =
      value.slice(
        1,
        -1
      );
  }

  return value;
}

function isLoopbackIpv4(
  hostname: string
): boolean {
  const parts =
    hostname.split('.');

  if (
    parts.length !== 4 ||
    parts[0] !== '127'
  ) {
    return false;
  }

  return parts.every(
    (part) => {
      if (
        !/^\d{1,3}$/.test(
          part
        )
      ) {
        return false;
      }

      const value =
        Number(part);

      return (
        value >= 0 &&
        value <= 255
      );
    }
  );
}

export function isSafeActionTarget(
  input: string | URL
): boolean {
  const url =
    input instanceof URL
      ? input
      : new URL(input);

  const hostname =
    normalizeHostname(
      url.hostname
    );

  return (
    hostname === 'localhost' ||
    hostname.endsWith(
      '.localhost'
    ) ||
    hostname.endsWith(
      '.local'
    ) ||
    isLoopbackIpv4(
      hostname
    ) ||
    hostname === '::1' ||
    hostname ===
      '0:0:0:0:0:0:0:1'
  );
}

function comparedResponseHeaderNames(
  config: YellowJacketConfig
): string[] {
  const names =
    new Set<string>();

  for (
    const name
    of config.compare?.headers ?? []
  ) {
    const normalized =
      name
        .trim()
        .toLowerCase();

    if (normalized) {
      names.add(
        normalized
      );
    }
  }

  if (
    config.compare?.redirects
  ) {
    names.add(
      'location'
    );
  }

  return [
    ...names
  ];
}

function captureResponseHeaders(
  config: YellowJacketConfig,
  response: Response
): Record<string, string | null> {
  const captured:
    Record<
      string,
      string | null
    > = {};

  for (
    const name
    of comparedResponseHeaderNames(
      config
    )
  ) {
    captured[name] =
      response.headers.get(
        name
      );
  }

  return captured;
}

function durationSince(
  startedAt: number
): number {
  return (
    Math.round(
      (
        performance.now() -
        startedAt
      ) * 100
    ) / 100
  );
}

export async function runRoute(
  config: YellowJacketConfig,
  route: RouteDefinition,
  options: RunOptions = {}
): Promise<RouteRunResult> {
  const method:
    HttpMethod =
      route.method ?? 'GET';

  const target =
    new URL(
      route.path,
      config.baseUrl
    );

  const url =
    target.toString();

  const startedAt =
    performance.now();

  if (
    isActionMethod(method) &&
    !options.allowActions &&
    !isSafeActionTarget(
      target
    )
  ) {
    return {
      route:
        route.name ??
        route.path,
      method,
      url,
      status: 0,
      contentType: null,
      body: null,
      durationMs:
        durationSince(
          startedAt
        ),
      passed: false,
      error:
        `Blocked ${method} request to ${target.host}. Mutating requests are allowed only for local targets by default. Re-run with --allow-actions to override.`
    };
  }

  const headers =
    new Headers(
      config.headers
    );

  for (
    const [name, value]
    of Object.entries(
      route.headers ?? {}
    )
  ) {
    headers.set(
      name,
      value
    );
  }

  let body:
    BodyInit | undefined;

  if (
    route.body !== undefined
  ) {
    if (
      typeof route.body ===
        'string'
    ) {
      body =
        route.body;
    } else if (
      route.body instanceof
        Uint8Array
    ) {
      body =
        new Uint8Array(
          route.body
        ).buffer;
    } else {
      body =
        JSON.stringify(
          route.body
        );

      if (
        !headers.has(
          'content-type'
        )
      ) {
        headers.set(
          'content-type',
          'application/json'
        );
      }
    }
  }

  try {
    const requestInit:
      RequestInit = {
        method,
        headers,
        redirect:
          route.redirect ??
          'follow',
        signal:
          AbortSignal.timeout(
            config.timeoutMs ??
              10_000
          )
      };

    if (
      body !== undefined
    ) {
      requestInit.body =
        body;
    }

    const response =
      await fetch(
        url,
        requestInit
      );

    const text =
      await response.text();

    const contentType =
      response.headers.get(
        'content-type'
      );

    const statusMatches =
      expectedStatusMatches(
        route,
        response.status
      );

    const responseHeaders =
      captureResponseHeaders(
        config,
        response
      );

    return {
      route:
        route.name ??
        route.path,
      method,
      url,
      status:
        response.status,
      contentType,
      body:
        parseBody(
          text,
          contentType
        ),
      durationMs:
        durationSince(
          startedAt
        ),

      ...(Object.keys(
        responseHeaders
      ).length > 0
        ? {
            responseHeaders
          }
        : {}),

      redirected:
        response.redirected,

      finalUrl:
        response.url ||
        url,

      passed:
        statusMatches,

      ...(statusMatches
        ? {}
        : {
            error:
              `Expected status ${String(
                route.expect?.status
              )}, received ${response.status}.`
          })
    };
  } catch (error) {
    return {
      route:
        route.name ??
        route.path,
      method,
      url,
      status: 0,
      contentType: null,
      body: null,
      durationMs:
        durationSince(
          startedAt
        ),
      passed: false,
      error:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}

export async function runSuite(
  config: YellowJacketConfig,
  options: RunOptions = {}
): Promise<RouteRunResult[]> {
  const results:
    RouteRunResult[] = [];

  for (
    const route
    of config.routes ?? []
  ) {
    results.push(
      await runRoute(
        config,
        route,
        options
      )
    );
  }

  for (
    const scenario
    of config.scenarios ?? []
  ) {
    results.push(
      ...await runScenario(
        config,
        scenario,
        (
          scenarioConfig,
          route
        ) =>
          runRoute(
            scenarioConfig,
            route,
            options
          )
      )
    );
  }

  return results;
}
