import {
  runScenario
} from './scenario.js';

import {
  selectRunConfig
} from './selection.js';

import type {
  HttpMethod,
  RetryConfig,
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

const DEFAULT_RETRY_STATUSES =
  [
    408,
    425,
    429,
    500,
    502,
    503,
    504
  ] as const;

interface EffectiveRetryConfig {
  maxAttempts: number;
  delayMs: number;
  statuses: ReadonlySet<number>;
}

function expectedStatusMatches(
  route: RouteDefinition,
  status: number
): boolean {
  const expected =
    route.expect?.status;

  if (
    expected ===
      undefined
  ) {
    return true;
  }

  return Array.isArray(
    expected
  )
    ? expected.includes(
        status
      )
    : expected ===
        status;
}

function normalizeContentType(
  value: string | null
): string | null {
  if (
    value ===
    null
  ) {
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

  return mediaType ||
    null;
}

function expectedContentTypeMatches(
  route: RouteDefinition,
  contentType: string | null
): boolean {
  const expected =
    route.expect
      ?.contentType;

  if (
    expected ===
      undefined
  ) {
    return true;
  }

  const values =
    Array.isArray(
      expected
    )
      ? expected
      : [
          expected
        ];

  const actual =
    normalizeContentType(
      contentType
    );

  return values.some(
    (value) =>
      normalizeContentType(
        value
      ) ===
      actual
  );
}

function expectedHeaderErrors(
  route: RouteDefinition,
  headers: Headers
): string[] {
  const errors:
    string[] = [];

  for (
    const [
      rawName,
      expected
    ]
    of Object.entries(
      route.expect
        ?.headers ??
        {}
    )
  ) {
    const name =
      rawName
        .trim()
        .toLowerCase();

    const values =
      Array.isArray(
        expected
      )
        ? expected
        : [
            expected
          ];

    const actual =
      headers.get(
        name
      );

    if (
      actual ===
        null ||
      !values.includes(
        actual
      )
    ) {
      errors.push(
        `Expected header ${name} ${values
          .map(
            (value) =>
              JSON.stringify(
                value
              )
          )
          .join(
            ' or '
          )}, received ${
          actual ===
            null
            ? 'null'
            : JSON.stringify(
                actual
              )
        }.`
      );
    }
  }

  return errors;
}

function parseBody(
  text: string,
  contentType: string | null
): unknown {
  if (
    text.length ===
      0
  ) {
    return null;
  }

  if (
    contentType
      ?.toLowerCase()
      .includes(
        'json'
      )
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
      .replace(
        /\.$/,
        ''
      );

  if (
    value.startsWith(
      '['
    ) &&
    value.endsWith(
      ']'
    )
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
    hostname.split(
      '.'
    );

  if (
    parts.length !==
      4 ||
    parts[0] !==
      '127'
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
        Number(
          part
        );

      return (
        value >=
          0 &&
        value <=
          255
      );
    }
  );
}

export function isSafeActionTarget(
  input: string | URL
): boolean {
  const url =
    input instanceof
      URL
      ? input
      : new URL(
          input
        );

  const hostname =
    normalizeHostname(
      url.hostname
    );

  return (
    hostname ===
      'localhost' ||
    hostname.endsWith(
      '.localhost'
    ) ||
    hostname.endsWith(
      '.local'
    ) ||
    isLoopbackIpv4(
      hostname
    ) ||
    hostname ===
      '::1' ||
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
    of config.compare
      ?.headers ??
      []
  ) {
    const normalized =
      name
        .trim()
        .toLowerCase();

    if (
      normalized
    ) {
      names.add(
        normalized
      );
    }
  }

  if (
    config.compare
      ?.redirects
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
): Record<
  string,
  string | null
> {
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
      ) *
        100
    ) /
    100
  );
}

function positiveAttemptCount(
  value: number | undefined
): number {
  return (
    value !==
      undefined &&
    Number.isInteger(
      value
    ) &&
    value >=
      1
  )
    ? value
    : 1;
}

function nonNegativeDelay(
  value: number | undefined
): number {
  return (
    value !==
      undefined &&
    Number.isFinite(
      value
    ) &&
    value >=
      0
  )
    ? value
    : 0;
}

function effectiveRetryConfig(
  config: YellowJacketConfig,
  route: RouteDefinition,
  method: HttpMethod
): EffectiveRetryConfig {
  if (
    route.retry ===
      false
  ) {
    return {
      maxAttempts:
        1,
      delayMs:
        0,
      statuses:
        new Set()
    };
  }

  const globalRetry:
    RetryConfig =
      config.retries ??
      {};

  const routeRetry:
    RetryConfig =
      route.retry ??
      {};

  const retryActions =
    routeRetry.retryActions ??
    globalRetry.retryActions ??
    false;

  const mayRetry =
    !isActionMethod(
      method
    ) ||
    retryActions;

  const maxAttempts =
    mayRetry
      ? positiveAttemptCount(
          routeRetry.maxAttempts ??
          globalRetry.maxAttempts
        )
      : 1;

  const delayMs =
    nonNegativeDelay(
      routeRetry.delayMs ??
      globalRetry.delayMs
    );

  const statuses =
    new Set<number>(
      routeRetry.statuses ??
      globalRetry.statuses ??
      DEFAULT_RETRY_STATUSES
    );

  return {
    maxAttempts,
    delayMs,
    statuses
  };
}

async function wait(
  delayMs: number
): Promise<void> {
  if (
    delayMs <=
      0
  ) {
    return;
  }

  await new Promise<void>(
    (resolvePromise) => {
      setTimeout(
        resolvePromise,
        delayMs
      );
    }
  );
}

function explicitlyAcceptsStatus(
  route: RouteDefinition,
  status: number
): boolean {
  const expected =
    route.expect
      ?.status;

  if (
    expected ===
      undefined
  ) {
    return false;
  }

  return Array.isArray(
    expected
  )
    ? expected.includes(
        status
      )
    : expected ===
        status;
}

function shouldRetryStatus(
  route: RouteDefinition,
  status: number,
  attempt: number,
  retry: EffectiveRetryConfig
): boolean {
  return (
    attempt <
      retry.maxAttempts &&
    retry.statuses.has(
      status
    ) &&
    !explicitlyAcceptsStatus(
      route,
      status
    )
  );
}

export async function runRoute(
  config: YellowJacketConfig,
  route: RouteDefinition,
  options: RunOptions = {}
): Promise<RouteRunResult> {
  const method:
    HttpMethod =
      route.method ??
      'GET';

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
    isActionMethod(
      method
    ) &&
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
      status:
        0,
      contentType:
        null,
      body:
        null,
      durationMs:
        durationSince(
          startedAt
        ),
      passed:
        false,
      error:
        `Blocked ${method} request to ${target.host}. Mutating requests are allowed only for local targets by default. Re-run with --allow-actions to override.`
    };
  }

  const headers =
    new Headers(
      config.headers
    );

  for (
    const [
      name,
      value
    ]
    of Object.entries(
      route.headers ??
      {}
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
    route.body !==
      undefined
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

  const retry =
    effectiveRetryConfig(
      config,
      route,
      method
    );

  for (
    let attempt = 1;
    attempt <=
      retry.maxAttempts;
    attempt +=
      1
  ) {
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
        body !==
          undefined
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

      if (
        shouldRetryStatus(
          route,
          response.status,
          attempt,
          retry
        )
      ) {
        await wait(
          retry.delayMs
        );

        continue;
      }

      const contentType =
        response.headers.get(
          'content-type'
        );

      const durationMs =
        durationSince(
          startedAt
        );

      const statusMatches =
        expectedStatusMatches(
          route,
          response.status
        );

      const contentTypeMatches =
        expectedContentTypeMatches(
          route,
          contentType
        );

      const errors:
        string[] = [];

      if (
        !statusMatches
      ) {
        errors.push(
          `Expected status ${String(
            route.expect
              ?.status
          )}, received ${response.status}.`
        );
      }

      if (
        !contentTypeMatches
      ) {
        const expected =
          route.expect
            ?.contentType;

        const label =
          Array.isArray(
            expected
          )
            ? expected.join(
                ' or '
              )
            : String(
                expected
              );

        errors.push(
          `Expected content-type ${label}, received ${String(
            normalizeContentType(
              contentType
            )
          )}.`
        );
      }

      errors.push(
        ...expectedHeaderErrors(
          route,
          response.headers
        )
      );

      const maxDurationMs =
        route.expect
          ?.maxDurationMs;

      if (
        maxDurationMs !==
          undefined &&
        durationMs >
          maxDurationMs
      ) {
        errors.push(
          `Expected response within ${maxDurationMs}ms, received ${durationMs}ms.`
        );
      }

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
        durationMs,

        ...(Object.keys(
          responseHeaders
        ).length >
          0
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
          errors.length ===
          0,

        ...(errors.length ===
          0
          ? {}
          : {
              error:
                errors.join(
                  ' '
                )
            })
      };
    } catch (error) {
      if (
        attempt <
          retry.maxAttempts
      ) {
        await wait(
          retry.delayMs
        );

        continue;
      }

      return {
        route:
          route.name ??
          route.path,
        method,
        url,
        status:
          0,
        contentType:
          null,
        body:
          null,
        durationMs:
          durationSince(
            startedAt
          ),
        passed:
          false,
        error:
          error instanceof
            Error
            ? error.message
            : String(
                error
              )
      };
    }
  }

  throw new Error(
    'HTTP retry loop completed without a result.'
  );
}

function effectiveConcurrency(
  config: YellowJacketConfig
): number {
  return (
    Number.isInteger(
      config.concurrency
    ) &&
    (
      config.concurrency ??
      0
    ) >
      0
  )
    ? config.concurrency ??
        1
    : 1;
}

async function runIndependentRoutes(
  config: YellowJacketConfig,
  routes: RouteDefinition[],
  options: RunOptions
): Promise<RouteRunResult[]> {
  if (
    routes.length ===
      0
  ) {
    return [];
  }

  const results:
    Array<
      RouteRunResult |
      undefined
    > =
      new Array(
        routes.length
      );

  let nextIndex =
    0;

  const worker =
    async (): Promise<void> => {
      while (
        true
      ) {
        const index =
          nextIndex;

        nextIndex +=
          1;

        if (
          index >=
            routes.length
        ) {
          return;
        }

        const route =
          routes[index];

        if (
          route ===
            undefined
        ) {
          return;
        }

        results[index] =
          await runRoute(
            config,
            route,
            options
          );
      }
    };

  const workerCount =
    Math.min(
      effectiveConcurrency(
        config
      ),
      routes.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount
      },
      () =>
        worker()
    )
  );

  return results.map(
    (
      result,
      index
    ) => {
      if (
        result ===
          undefined
      ) {
        throw new Error(
          `Route ${index} did not produce a result.`
        );
      }

      return result;
    }
  );
}

export async function runSuite(
  config: YellowJacketConfig,
  options: RunOptions = {}
): Promise<RouteRunResult[]> {
  const results:
    RouteRunResult[] = [];

  const selectedConfig =
    selectRunConfig(
      config,
      options.selection
    );

  results.push(
    ...await runIndependentRoutes(
      selectedConfig,
      selectedConfig.routes ??
        [],
      options
    )
  );

  /*
   * Scenarios deliberately remain sequential.
   *
   * Their individual steps may depend on captured values
   * and side effects from previous steps.
   */
  for (
    const scenario
    of selectedConfig.scenarios ??
      []
  ) {
    results.push(
      ...await runScenario(
        selectedConfig,
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
