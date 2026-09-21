import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { YellowJacketConfig } from './types.js';

const CONFIG_FILES = [
  'yellow-jacket.config.ts',
  'yellow-jacket.config.mjs',
  'yellow-jacket.config.js'
] as const;

export function defineConfig(config: YellowJacketConfig): YellowJacketConfig {
  return config;
}

export async function findConfig(cwd = process.cwd()): Promise<string> {
  for (const filename of CONFIG_FILES) {
    const candidate = resolve(cwd, filename);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep searching.
    }
  }

  throw new Error(
    `No yellow-jacket config found in ${cwd}. Run "yellow-jacket init" first.`
  );
}

export async function loadConfig(cwd = process.cwd()): Promise<YellowJacketConfig> {
  const path = await findConfig(cwd);
  const imported = (await import(pathToFileURL(path).href)) as {
    default?: YellowJacketConfig;
  };

  if (!imported.default) {
    throw new Error(`${path} must export a default configuration.`);
  }

  if (!imported.default.baseUrl || !Array.isArray(imported.default.routes)) {
    throw new Error(`${path} must define baseUrl and routes.`);
  }

  return imported.default;
}
