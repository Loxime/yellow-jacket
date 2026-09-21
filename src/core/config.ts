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
  YellowJacketConfig
} from './types.js';

const CONFIG_FILES = [
  'yellow-jacket.config.ts',
  'yellow-jacket.config.mjs',
  'yellow-jacket.config.js'
] as const;

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

    for (
      const step
      of scenario.steps
    ) {
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
