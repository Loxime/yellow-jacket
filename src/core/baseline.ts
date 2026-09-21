import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type {
  BaselineFile,
  Regression,
  ResponseSnapshot,
  RouteRunResult,
  YellowJacketConfig
} from './types.js';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function baselinePath(config: YellowJacketConfig, cwd = process.cwd()): string {
  return resolve(cwd, config.baselinePath ?? '.yellow-jacket/snapshots/baseline.json');
}

export async function writeBaseline(
  config: YellowJacketConfig,
  results: RouteRunResult[],
  cwd = process.cwd()
): Promise<string> {
  const path = baselinePath(config, cwd);
  await mkdir(dirname(path), { recursive: true });
  const baseline: BaselineFile = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    responses: results.map(({ passed: _passed, error: _error, ...snapshot }) => snapshot)
  };
  await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  return path;
}

export async function readBaseline(
  config: YellowJacketConfig,
  cwd = process.cwd()
): Promise<BaselineFile | null> {
  const path = baselinePath(config, cwd);
  try {
    return JSON.parse(await readFile(path, 'utf8')) as BaselineFile;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    throw error;
  }
}

export function compareWithBaseline(
  baseline: BaselineFile,
  results: RouteRunResult[]
): Regression[] {
  const expected = new Map<string, ResponseSnapshot>();
  for (const item of baseline.responses) {
    expected.set(`${item.method} ${item.route}`, item);
  }

  const regressions: Regression[] = [];
  for (const current of results) {
    const key = `${current.method} ${current.route}`;
    const previous = expected.get(key);
    if (!previous) {
      regressions.push({
        route: current.route,
        method: current.method,
        changes: ['route was not present in baseline']
      });
      continue;
    }

    const changes: string[] = [];
    if (previous.status !== current.status) {
      changes.push(`status ${previous.status} -> ${current.status}`);
    }
    if (stable(previous.body) !== stable(current.body)) {
      changes.push('response body changed');
    }
    if (previous.contentType !== current.contentType) {
      changes.push(`content-type ${String(previous.contentType)} -> ${String(current.contentType)}`);
    }

    if (changes.length > 0) {
      regressions.push({ route: current.route, method: current.method, changes });
    }
  }

  return regressions;
}
