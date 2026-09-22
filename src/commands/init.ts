import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CONFIG_TEMPLATE = `import { defineConfig } from '@falche/yellow-jacket';

export default defineConfig({
  baseUrl: process.env.YELLOW_JACKET_URL ?? 'http://localhost:3000',
  timeoutMs: 10_000,

  compare: {
    ignore: [
      // '$.createdAt',
      // '$.updatedAt'
    ],
    redact: [
      // '$.token',
      // '$.password'
    ]
  },

  routes: [
    {
      name: 'home',
      method: 'GET',
      path: '/',
      expect: { status: 200 }
    }
  ]
});
`;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function addPackageScripts(cwd: string): Promise<void> {
  const packagePath = resolve(cwd, 'package.json');
  if (!(await exists(packagePath))) return;

  const json = JSON.parse(await readFile(packagePath, 'utf8')) as {
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };
  json.scripts ??= {};
  json.scripts['yellow-jacket'] ??= 'yellow-jacket run';
  json.scripts['yellow-jacket:baseline'] ??= 'yellow-jacket baseline';
  await writeFile(packagePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

export async function initProject(cwd = process.cwd()): Promise<string[]> {
  const created: string[] = [];
  const configPath = resolve(cwd, 'yellow-jacket.config.mjs');
  const snapshotDir = resolve(cwd, '.yellow-jacket/snapshots');

  if (!(await exists(configPath))) {
    await writeFile(configPath, CONFIG_TEMPLATE, 'utf8');
    created.push('yellow-jacket.config.mjs');
  }

  await mkdir(snapshotDir, { recursive: true });
  await addPackageScripts(cwd);
  return created;
}
