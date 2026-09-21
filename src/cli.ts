#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { initProject } from './commands/init.js';
import { loadConfig } from './core/config.js';
import { compareWithBaseline, readBaseline, writeBaseline } from './core/baseline.js';
import { runSuite } from './core/runner.js';

function printHelp(): void {
  console.log(`yellow-jacket

Usage:
  yellow-jacket init
  yellow-jacket run
  yellow-jacket baseline

Commands:
  init      Create a local yellow-jacket configuration.
  run       Execute routes and compare them with the baseline when available.
  baseline  Execute routes and save their current responses as the baseline.
`);
}

function printResults(results: Awaited<ReturnType<typeof runSuite>>): void {
  for (const result of results) {
    const marker = result.passed ? '✓' : '✗';
    console.log(
      `${marker} ${result.method.padEnd(7)} ${result.route.padEnd(24)} ${String(result.status).padEnd(3)} ${result.durationMs}ms`
    );
    if (result.error) console.log(`  ${result.error}`);
  }
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' }
    }
  });
  const command = positionals[0] ?? 'run';

  if (values.help || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'init') {
    const created = await initProject();
    console.log('yellow-jacket initialized.');
    if (created.length > 0) console.log(`Created: ${created.join(', ')}`);
    return;
  }

  const config = await loadConfig();
  const results = await runSuite(config);
  printResults(results);

  const failedAssertions = results.filter((result) => !result.passed);
  if (command === 'baseline') {
    if (failedAssertions.length > 0) {
      console.error('Baseline not written because route expectations failed.');
      process.exitCode = 1;
      return;
    }
    const path = await writeBaseline(config, results);
    console.log(`Baseline written to ${path}`);
    return;
  }

  if (command !== 'run') {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 2;
    return;
  }

  const baseline = await readBaseline(config);
  const regressions = baseline ? compareWithBaseline(baseline, results) : [];

  for (const regression of regressions) {
    console.error(`△ ${regression.method} ${regression.route}: ${regression.changes.join(', ')}`);
  }

  if (!baseline) {
    console.log('No baseline found. Run "yellow-jacket baseline" to create one.');
  }

  if (failedAssertions.length > 0 || regressions.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
