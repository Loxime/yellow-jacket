import {
  access
} from 'node:fs/promises';

import {
  resolve
} from 'node:path';

import {
  pathToFileURL
} from 'node:url';

import {
  parseJsonPath
} from './normalize.js';

import {
  validateCapture
} from './scenario.js';

import type {
  RetryConfig,
  RouteDefinition,
  YellowJacketConfig
} from './types.js';

const CONFIG_FILES = [
  'yellow-jacket.config.ts',
  'yellow-jacket.config.mjs',
  'yellow-jacket.config.js'
] as const;

function validateRedirect(
  route: RouteDefinition,
  source: string
): void {
  if (
    route.redirect !==
      undefined &&
    route.redirect !==
      'follow' &&
    route.redirect !==
      'manual' &&
    route.redirect !==
      'error'
  ) {
    throw new Error(
      `${source} redirect must be "follow", "manual", or "error".`
    );
  }
}

function validateTags(
  tags: string[] | undefined,
  source: string
): void {
  if (
    tags ===
    undefined
  ) {
    return;
  }

  if (
    !Array.isArray(
      tags
    ) ||
    tags.some(
      (tag) =>
        typeof tag !==
          'string' ||
        tag.trim().length ===
          0
    )
  ) {
    throw new Error(
      `${source} tags must be an array of non-empty strings.`
    );
  }
}

function validHttpStatus(
  value: unknown
): value is number {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value
    ) &&
    value >=
      100 &&
    value <=
      599
  );
}

function validateExpectation(
  route: RouteDefinition,
  source: string
): void {
  const status =
    route.expect?.status;

  if (
    status !==
    undefined
  ) {
    const valid =
      Array.isArray(
        status
      )
        ? (
            status.length >
              0 &&
            status.every(
              validHttpStatus
            )
          )
        : validHttpStatus(
            status
          );

    if (!valid) {
      throw new Error(
        `${source} expect.status must be an HTTP status or non-empty array of HTTP statuses.`
      );
    }
  }

  const contentType =
    route.expect?.contentType;

  if (
    contentType !==
    undefined
  ) {
    const valid =
      typeof contentType ===
        'string'
        ? contentType.trim()
            .length >
          0
        : Array.isArray(
              contentType
            ) &&
          contentType.length >
            0 &&
          contentType.every(
            (value) =>
              typeof value ===
                'string' &&
              value.trim()
                .length >
                0
          );

    if (!valid) {
      throw new Error(
        `${source} expect.contentType must be a non-empty string or array of non-empty strings.`
      );
    }
  }

  const expectedHeaders =
    route.expect?.headers;

  if (
    expectedHeaders !==
    undefined
  ) {
    if (
      expectedHeaders ===
        null ||
      typeof expectedHeaders !==
        'object' ||
      Array.isArray(
        expectedHeaders
      )
    ) {
      throw new Error(
        `${source} expect.headers must be an object.`
      );
    }

    for (
      const [
        name,
        expected
      ]
      of Object.entries(
        expectedHeaders
      )
    ) {
      if (
        name.trim().length ===
          0
      ) {
        throw new Error(
          `${source} expect.headers contains an empty header name.`
        );
      }

      const valid =
        typeof expected ===
          'string' ||
        (
          Array.isArray(
            expected
          ) &&
          expected.length >
            0 &&
          expected.every(
            (value) =>
              typeof value ===
                'string'
          )
        );

      if (!valid) {
        throw new Error(
          `${source} expect.headers.${name} must be a string or non-empty array of strings.`
        );
      }
    }
  }

  const maxDurationMs =
    route.expect
      ?.maxDurationMs;

  if (
    maxDurationMs !==
      undefined &&
    (
      typeof maxDurationMs !==
        'number' ||
      !Number.isFinite(
        maxDurationMs
      ) ||
      maxDurationMs <=
        0
    )
  ) {
    throw new Error(
      `${source} expect.maxDurationMs must be a positive finite number.`
    );
  }
}

function validateRetry(
  retry:
    RetryConfig |
    false |
    undefined,
  source: string
): void {
  if (
    retry ===
      undefined ||
    retry ===
      false
  ) {
    return;
  }

  if (
    retry ===
      null ||
    typeof retry !==
      'object' ||
    Array.isArray(
      retry
    )
  ) {
    throw new Error(
      `${source} retry must be an object or false.`
    );
  }

  if (
    retry.maxAttempts !==
      undefined &&
    (
      !Number.isInteger(
        retry.maxAttempts
      ) ||
      retry.maxAttempts <
        1
    )
  ) {
    throw new Error(
      `${source} retry.maxAttempts must be a positive integer.`
    );
  }

  if (
    retry.delayMs !==
      undefined &&
    (
      typeof retry.delayMs !==
        'number' ||
      !Number.isFinite(
        retry.delayMs
      ) ||
      retry.delayMs <
        0
    )
  ) {
    throw new Error(
      `${source} retry.delayMs must be a non-negative finite number.`
    );
  }

  if (
    retry.statuses !==
      undefined &&
    (
      !Array.isArray(
        retry.statuses
      ) ||
      retry.statuses.some(
        (status) =>
          !validHttpStatus(
            status
          )
      )
    )
  ) {
    throw new Error(
      `${source} retry.statuses must be an array of HTTP statuses.`
    );
  }

  if (
    retry.retryActions !==
      undefined &&
    typeof retry.retryActions !==
      'boolean'
  ) {
    throw new Error(
      `${source} retry.retryActions must be a boolean.`
    );
  }
}

export function defineConfig(
  config: YellowJacketConfig
): YellowJacketConfig {
  return config;
}

export async function findConfig(
  cwd = process.cwd()
): Promise<string> {
  for (
    const filename
    of CONFIG_FILES
  ) {
    const candidate =
      resolve(
        cwd,
        filename
      );

    try {
      await access(
        candidate
      );

      return candidate;
    } catch {
      // Keep searching.
    }
  }

  throw new Error(
    `No yellow-jacket config found in ${cwd}. Run "yellow-jacket init" first.`
  );
}

export async function loadConfig(
  cwd = process.cwd()
): Promise<YellowJacketConfig> {
  const path =
    await findConfig(cwd);

  const imported =
    await import(
      pathToFileURL(
        path
      ).href
    ) as {
      default?: YellowJacketConfig;
    };

  if (!imported.default) {
    throw new Error(
      `${path} must export a default configuration.`
    );
  }

  const config =
    imported.default;

  if (!config.baseUrl) {
    throw new Error(
      `${path} must define baseUrl.`
    );
  }

  if (
    config.routes !== undefined &&
    !Array.isArray(
      config.routes
    )
  ) {
    throw new Error(
      `${path} routes must be an array.`
    );
  }

  if (
    config.scenarios !== undefined &&
    !Array.isArray(
      config.scenarios
    )
  ) {
    throw new Error(
      `${path} scenarios must be an array.`
    );
  }

  if (
    config.routes === undefined &&
    config.scenarios === undefined
  ) {
    throw new Error(
      `${path} must define routes, scenarios, or both.`
    );
  }

  if (
    config.concurrency !==
      undefined &&
    (
      !Number.isInteger(
        config.concurrency
      ) ||
      config.concurrency <
        1
    )
  ) {
    throw new Error(
      `${path} concurrency must be a positive integer.`
    );
  }

  validateRetry(
    config.retries,
    `${path} retries`
  );

  if (
    config.coverage?.openapi !== undefined &&
    typeof config.coverage.openapi !== 'string'
  ) {
    throw new Error(
      `${path} coverage.openapi must be a string.`
    );
  }

  if (
    config.coverage?.sitemap !== undefined &&
    typeof config.coverage.sitemap !== 'string'
  ) {
    throw new Error(
      `${path} coverage.sitemap must be a string.`
    );
  }

  if (
    config.coverage?.minimum !== undefined &&
    (
      typeof config.coverage.minimum !== 'number' ||
      !Number.isFinite(config.coverage.minimum) ||
      config.coverage.minimum < 0 ||
      config.coverage.minimum > 100
    )
  ) {
    throw new Error(
      `${path} coverage.minimum must be a number between 0 and 100.`
    );
  }

  if (
    config.compare?.headers !==
      undefined &&
    (
      !Array.isArray(
        config.compare.headers
      ) ||
      config.compare.headers.some(
        (name) =>
          typeof name !== 'string' ||
          name.trim().length === 0
      )
    )
  ) {
    throw new Error(
      `${path} compare.headers must be an array of non-empty strings.`
    );
  }

  if (
    config.compare?.redirects !==
      undefined &&
    typeof config.compare.redirects !==
      'boolean'
  ) {
    throw new Error(
      `${path} compare.redirects must be a boolean.`
    );
  }

  for (
    const route
    of config.routes ?? []
  ) {
    const source =
      `${path} route ${route.name ?? route.path}`;

    validateRedirect(
      route,
      source
    );

    validateTags(
      route.tags,
      source
    );

    validateExpectation(
      route,
      source
    );

    validateRetry(
      route.retry,
      source
    );
  }

  for (
    const comparePath
    of [
      ...(
        config.compare
          ?.ignore ?? []
      ),
      ...(
        config.compare
          ?.redact ?? []
      )
    ]
  ) {
    parseJsonPath(
      comparePath
    );
  }

  for (
    const scenario
    of config.scenarios ?? []
  ) {
    if (
      !scenario.name ||
      !Array.isArray(
        scenario.steps
      )
    ) {
      throw new Error(
        `${path} contains an invalid scenario.`
      );
    }

    validateTags(
      scenario.tags,
      `${path} scenario ${scenario.name}`
    );

    for (
      const step
      of scenario.steps
    ) {
      const source =
        `${path} scenario ${scenario.name} > ${step.name ?? step.path}`;

      validateRedirect(
        step,
        source
      );

      validateExpectation(
        step,
        source
      );

      validateRetry(
        step.retry,
        source
      );

      for (
        const [
          variable,
          capturePath
        ]
        of Object.entries(
          step.capture ?? {}
        )
      ) {
        validateCapture(
          variable,
          capturePath
        );
      }
    }
  }

  return config;
}
