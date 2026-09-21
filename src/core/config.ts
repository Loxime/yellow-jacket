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
    validateRedirect(
      route,
      `${path} route ${route.name ?? route.path}`
    );

    validateTags(
      route.tags,
      `${path} route ${route.name ?? route.path}`
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
      validateRedirect(
        step,
        `${path} scenario ${scenario.name} > ${step.name ?? step.path}`
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
