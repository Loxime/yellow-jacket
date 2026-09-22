import {
  normalizeBody
} from './normalize.js';

import type {
  CompareConfig,
  CoverageReport,
  Regression,
  RunReport
} from './types.js';

function escapeMarkdownCell(
  value: string
): string {
  return value
    .replace(
      /\|/g,
      '\\|'
    )
    .replace(
      /\r?\n/g,
      ' '
    );
}

export function formatCoverageMarkdown(
  report: CoverageReport
): string {
  const lines = [
    '## 🐝 Yellow Jacket coverage',
    '',
    `**Coverage:** ${report.percentage}% (${report.covered}/${report.total})`
  ];

  if (
    report.minimum !== undefined
  ) {
    lines.push(
      `**Minimum:** ${report.minimum}%`,
      `**Result:** ${
        report.passed
          ? '✅ Coverage requirement satisfied'
          : '❌ Coverage requirement not satisfied'
      }`
    );
  }

  lines.push(
    '',
    '| Method | Path | Status | Matched by |',
    '| --- | --- | --- | --- |'
  );

  for (
    const operation
    of report.operations
  ) {
    lines.push(
      [
        '|',
        escapeMarkdownCell(
          operation.method
        ),
        '|',
        escapeMarkdownCell(
          operation.path
        ),
        '|',
        operation.covered
          ? '✅ Covered'
          : '❌ Uncovered',
        '|',
        escapeMarkdownCell(
          operation.matchedBy ??
            '—'
        ),
        '|'
      ].join(' ')
    );
  }

  return `${lines.join('\n')}\n`;
}

function escapeHtml(
  value: string
): string {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#39;'
    );
}

export function formatCoverageHtml(
  report: CoverageReport
): string {
  const resultClass =
    report.passed
      ? 'passed'
      : 'failed';

  const resultLabel =
    report.passed
      ? 'Coverage requirement satisfied'
      : 'Coverage requirement not satisfied';

  const minimum =
    report.minimum === undefined
      ? ''
      : `
        <div class="metric">
          <span class="metric-label">Minimum</span>
          <strong>${report.minimum}%</strong>
        </div>`;

  const rows =
    report.operations
      .map(
        (operation) => `
        <tr>
          <td>
            <code>${escapeHtml(operation.method)}</code>
          </td>
          <td>
            <code>${escapeHtml(operation.path)}</code>
          </td>
          <td>
            <span class="status ${operation.covered ? 'covered' : 'uncovered'}">
              ${operation.covered ? 'Covered' : 'Uncovered'}
            </span>
          </td>
          <td>
            ${escapeHtml(operation.matchedBy ?? '—')}
          </td>
        </tr>`
      )
      .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
  <title>Yellow Jacket coverage</title>

  <style>
    :root {
      color-scheme: light dark;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    body {
      margin: 0;
      background: Canvas;
      color: CanvasText;
    }

    main {
      width: min(1100px, calc(100% - 32px));
      margin: 48px auto;
    }

    header {
      margin-bottom: 32px;
    }

    h1 {
      margin-bottom: 8px;
    }

    .subtitle {
      opacity: 0.72;
      margin: 0;
    }

    .metrics {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin: 24px 0;
    }

    .metric {
      border: 1px solid color-mix(
        in srgb,
        CanvasText 18%,
        transparent
      );
      border-radius: 10px;
      padding: 16px;
    }

    .metric-label {
      display: block;
      font-size: 0.8rem;
      opacity: 0.68;
      margin-bottom: 6px;
    }

    .metric strong {
      font-size: 1.45rem;
    }

    .result {
      border: 1px solid;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-weight: 600;
    }

    .result.passed {
      border-color: #299764;
    }

    .result.failed {
      border-color: #c43b3b;
    }

    .source {
      margin-bottom: 24px;
      font-size: 0.9rem;
      opacity: 0.72;
      word-break: break-all;
    }

    .table-wrapper {
      overflow-x: auto;
      border: 1px solid color-mix(
        in srgb,
        CanvasText 18%,
        transparent
      );
      border-radius: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid color-mix(
        in srgb,
        CanvasText 12%,
        transparent
      );
    }

    th {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.7;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    code {
      font-family:
        ui-monospace,
        SFMono-Regular,
        Menlo,
        Monaco,
        Consolas,
        monospace;
    }

    .status {
      font-weight: 600;
    }

    .covered {
      color: #299764;
    }

    .uncovered {
      color: #c43b3b;
    }

    footer {
      margin-top: 24px;
      opacity: 0.6;
      font-size: 0.85rem;
    }
  </style>
</head>

<body>
  <main>
    <header>
      <h1>🐝 Yellow Jacket coverage</h1>
      <p class="subtitle">
        HTTP route coverage report
      </p>
    </header>

    <section class="metrics">
      <div class="metric">
        <span class="metric-label">Coverage</span>
        <strong>${report.percentage}%</strong>
      </div>

      <div class="metric">
        <span class="metric-label">Covered</span>
        <strong>${report.covered}/${report.total}</strong>
      </div>

      <div class="metric">
        <span class="metric-label">Uncovered</span>
        <strong>${report.uncovered}</strong>
      </div>
      ${minimum}
    </section>

    <div class="result ${resultClass}">
      ${escapeHtml(resultLabel)}
    </div>

    <div class="source">
      Source: ${escapeHtml(report.source)}
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Status</th>
            <th>Matched by</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <footer>
      Generated by Yellow Jacket
    </footer>
  </main>
</body>
</html>
`;
}

function escapeGitHubCommandData(
  value: string
): string {
  return value
    .replace(
      /%/g,
      '%25'
    )
    .replace(
      /\r/g,
      '%0D'
    )
    .replace(
      /\n/g,
      '%0A'
    );
}

export function formatCoverageGitHub(
  report: CoverageReport
): string {
  const lines:
    string[] = [];

  for (
    const operation
    of report.operations
  ) {
    if (
      operation.covered
    ) {
      continue;
    }

    lines.push(
      `::warning title=Yellow Jacket coverage::${escapeGitHubCommandData(
        `${operation.method} ${operation.path} is not covered`
      )}`
    );
  }

  const summary =
    report.minimum ===
      undefined
      ? `Coverage ${report.percentage}% (${report.covered}/${report.total}).`
      : `Coverage ${report.percentage}% (${report.covered}/${report.total}). Minimum ${report.minimum}%.`;

  lines.push(
    report.passed
      ? `::notice title=Yellow Jacket coverage::${escapeGitHubCommandData(
          summary
        )}`
      : `::error title=Yellow Jacket coverage::${escapeGitHubCommandData(
          summary
        )}`
  );

  return `${lines.join('\n')}\n`;
}

function escapeXml(
  value: string
): string {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&apos;'
    );
}

export function formatCoverageGitLab(
  report: CoverageReport
): string {
  const tests =
    report.total + 1;

  const failures =
    report.passed
      ? 0
      : 1;

  const rows =
    report.operations
      .map(
        (operation) => {
          const name =
            `${operation.method} ${operation.path}`;

          if (
            operation.covered
          ) {
            return `    <testcase classname="yellow-jacket.coverage" name="${escapeXml(
              name
            )}" />`;
          }

          return [
            `    <testcase classname="yellow-jacket.coverage" name="${escapeXml(
              name
            )}">`,
            '      <skipped message="Uncovered operation" />',
            '    </testcase>'
          ].join('\n');
        }
      )
      .join('\n');

  const gateName =
    report.minimum ===
      undefined
      ? 'coverage summary'
      : `coverage minimum ${report.minimum}%`;

  const gate =
    report.passed
      ? `    <testcase classname="yellow-jacket.coverage" name="${escapeXml(
          gateName
        )}" />`
      : [
          `    <testcase classname="yellow-jacket.coverage" name="${escapeXml(
            gateName
          )}">`,
          `      <failure message="Coverage requirement not satisfied">${escapeXml(
            `Coverage ${report.percentage}% is below minimum ${String(
              report.minimum
            )}%.`
          )}</failure>`,
          '    </testcase>'
        ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="Yellow Jacket coverage" tests="${tests}" failures="${failures}" skipped="${report.uncovered}">`,
    rows,
    gate,
    `  <system-out>${escapeXml(
      `Coverage ${report.percentage}% (${report.covered}/${report.total}). Source: ${report.source}`
    )}</system-out>`,
    '</testsuite>',
    ''
  ]
    .filter(
      (line) =>
        line.length >
        0
    )
    .join('\n');
}

function runKey(
  method: string,
  route: string
): string {
  return `${method} ${route}`;
}

function resultAttempts(
  result:
    RunReport['results'][number]
): number {
  return (
    result.attempts ??
    1
  );
}

function totalRunAttempts(
  report: RunReport
): number {
  return report.results.reduce(
    (
      total,
      result
    ) =>
      total +
      resultAttempts(
        result
      ),
    0
  );
}

function retriedRequestCount(
  report: RunReport
): number {
  return report.results.filter(
    (result) =>
      resultAttempts(
        result
      ) >
      1
  ).length;
}

function httpAttemptLabel(
  attempts: number
): string {
  return `${attempts} HTTP ${
    attempts ===
      1
      ? 'attempt'
      : 'attempts'
  }`;
}

function formatBodyValue(
  value: unknown
): string {
  const encoded =
    JSON.stringify(
      value
    );

  return encoded ===
    undefined
      ? String(value)
      : encoded;
}

function regressionDetails(
  regression: Regression
): string[] {
  const details =
    regression.changes.filter(
      (change) =>
        change !==
        'response body changed'
    );

  const bodyChanges =
    regression.bodyChanges ??
    [];

  for (
    const change
    of bodyChanges
  ) {
    if (
      change.kind ===
      'changed'
    ) {
      details.push(
        `${change.path}: ${formatBodyValue(
          change.before
        )} -> ${formatBodyValue(
          change.after
        )}`
      );
    } else if (
      change.kind ===
      'added'
    ) {
      details.push(
        `${change.path} added: ${formatBodyValue(
          change.after
        )}`
      );
    } else {
      details.push(
        `${change.path} removed: ${formatBodyValue(
          change.before
        )}`
      );
    }
  }

  if (
    bodyChanges.length === 0 &&
    regression.changes.includes(
      'response body changed'
    )
  ) {
    details.push(
      'response body changed'
    );
  }

  return details;
}

export function formatRunMarkdown(
  report: RunReport
): string {
  const failedAssertions =
    report.results.filter(
      (result) =>
        !result.passed
    );

  const lines = [
    '## 🐝 Yellow Jacket run',
    '',
    `**Result:** ${
      report.passed
        ? '✅ Passed'
        : '❌ Failed'
    }`,
    `**Requests:** ${report.results.length}`,
    `**HTTP attempts:** ${totalRunAttempts(
      report
    )}`,
    `**Retried requests:** ${retriedRequestCount(
      report
    )}`,
    `**Failed assertions:** ${failedAssertions.length}`,
    `**Regressions:** ${report.regressions.length}`,
    `**Baseline:** ${
      report.baselineFound
        ? 'loaded'
        : 'not found'
    }`
  ];

  if (
    failedAssertions.length >
    0
  ) {
    lines.push(
      '',
      '### Failed assertions'
    );

    for (
      const result
      of failedAssertions
    ) {
      const attempts =
        resultAttempts(
          result
        );

      const retrySuffix =
        attempts >
          1
          ? ` after ${attempts} attempts`
          : '';

      lines.push(
        `- \`${result.method} ${result.route}\` — ${
          result.error ??
          `request failed with status ${result.status}`
        }${retrySuffix}`
      );
    }
  }

  if (
    report.regressions.length >
    0
  ) {
    lines.push(
      '',
      '### Regressions'
    );

    for (
      const regression
      of report.regressions
    ) {
      lines.push(
        `- \`${regression.method} ${regression.route}\``
      );

      for (
        const detail
        of regressionDetails(
          regression
        )
      ) {
        lines.push(
          `  - ${detail.replace(
            /\r?\n/g,
            ' '
          )}`
        );
      }
    }
  }

  if (
    !report.baselineFound
  ) {
    lines.push(
      '',
      '> No baseline found. Regression comparison was skipped.'
    );
  }

  return `${lines.join('\n')}\n`;
}

export function formatRunJson(
  report: RunReport,
  compare: CompareConfig = {}
): string {
  const safeReport:
    RunReport = {
      ...report,

      results:
        report.results.map(
          (result) => ({
            ...result,

            body:
              normalizeBody(
                result.body,
                compare
              )
          })
        )
    };

  return `${JSON.stringify(
    safeReport,
    null,
    2
  )}\n`;
}

export function formatRunHtml(
  report: RunReport
): string {
  const failedAssertions =
    report.results.filter(
      (result) =>
        !result.passed
    );

  const attempts =
    totalRunAttempts(
      report
    );

  const retried =
    retriedRequestCount(
      report
    );

  const resultRows =
    report.results
      .map(
        (result) => `
        <tr>
          <td>
            <code>${escapeHtml(
              result.method
            )}</code>
          </td>
          <td>
            <code>${escapeHtml(
              result.route
            )}</code>
          </td>
          <td>
            ${result.status}
          </td>
          <td>
            ${result.durationMs}ms
          </td>
          <td>
            ${resultAttempts(
              result
            )}
          </td>
          <td>
            <span class="status ${
              result.passed
                ? 'passed'
                : 'failed'
            }">
              ${
                result.passed
                  ? 'Passed'
                  : 'Failed'
              }
            </span>
            ${
              result.error
                ? `<div class="detail">${escapeHtml(
                    result.error
                  )}</div>`
                : ''
            }
          </td>
        </tr>`
      )
      .join('');

  const regressions =
    report.regressions.length ===
      0
      ? `
        <p class="empty">
          No baseline regressions detected.
        </p>`
      : `
        <ul class="regressions">
          ${report.regressions
            .map(
              (regression) => `
            <li>
              <strong>
                <code>${escapeHtml(
                  `${regression.method} ${regression.route}`
                )}</code>
              </strong>

              <ul>
                ${regressionDetails(
                  regression
                )
                  .map(
                    (detail) =>
                      `<li>${escapeHtml(
                        detail
                      )}</li>`
                  )
                  .join('')}
              </ul>
            </li>`
            )
            .join('')}
        </ul>`;

  const baseline =
    report.baselineFound
      ? 'Loaded'
      : 'Not found';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>Yellow Jacket run</title>

  <style>
    :root {
      color-scheme: light dark;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    body {
      margin: 0;
      background: Canvas;
      color: CanvasText;
    }

    main {
      width: min(
        1100px,
        calc(100% - 32px)
      );
      margin: 48px auto;
    }

    h1,
    h2 {
      margin-bottom: 8px;
    }

    .subtitle,
    .empty {
      opacity: 0.7;
    }

    .metrics {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(150px, 1fr)
        );
      gap: 12px;
      margin: 24px 0;
    }

    .metric {
      border:
        1px solid
        color-mix(
          in srgb,
          CanvasText 18%,
          transparent
        );
      border-radius: 10px;
      padding: 16px;
    }

    .metric span {
      display: block;
      font-size: 0.8rem;
      opacity: 0.68;
      margin-bottom: 6px;
    }

    .metric strong {
      font-size: 1.4rem;
    }

    .summary {
      border: 1px solid;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 28px;
      font-weight: 600;
    }

    .summary.passed {
      border-color: #299764;
    }

    .summary.failed {
      border-color: #c43b3b;
    }

    .table-wrapper {
      overflow-x: auto;
      border:
        1px solid
        color-mix(
          in srgb,
          CanvasText 18%,
          transparent
        );
      border-radius: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 12px 14px;
      text-align: left;
      vertical-align: top;
      border-bottom:
        1px solid
        color-mix(
          in srgb,
          CanvasText 12%,
          transparent
        );
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    th {
      font-size: 0.78rem;
      text-transform: uppercase;
      opacity: 0.7;
    }

    code {
      font-family:
        ui-monospace,
        SFMono-Regular,
        Menlo,
        Monaco,
        Consolas,
        monospace;
    }

    .status {
      font-weight: 600;
    }

    .passed {
      color: #299764;
    }

    .failed {
      color: #c43b3b;
    }

    .detail {
      margin-top: 6px;
      font-size: 0.85rem;
      opacity: 0.75;
    }

    section {
      margin-top: 32px;
    }

    .regressions > li {
      margin-bottom: 16px;
    }

    footer {
      margin-top: 32px;
      font-size: 0.85rem;
      opacity: 0.6;
    }
  </style>
</head>

<body>
  <main>
    <header>
      <h1>🐝 Yellow Jacket run</h1>

      <p class="subtitle">
        HTTP regression report
      </p>
    </header>

    <section class="metrics">
      <div class="metric">
        <span>Requests</span>
        <strong>${report.results.length}</strong>
      </div>

      <div class="metric">
        <span>HTTP attempts</span>
        <strong>${attempts}</strong>
      </div>

      <div class="metric">
        <span>Retried requests</span>
        <strong>${retried}</strong>
      </div>

      <div class="metric">
        <span>Failed assertions</span>
        <strong>${failedAssertions.length}</strong>
      </div>

      <div class="metric">
        <span>Regressions</span>
        <strong>${report.regressions.length}</strong>
      </div>

      <div class="metric">
        <span>Baseline</span>
        <strong>${escapeHtml(
          baseline
        )}</strong>
      </div>
    </section>

    <div class="summary ${
      report.passed
        ? 'passed'
        : 'failed'
    }">
      ${
        report.passed
          ? 'Run passed'
          : 'Run failed'
      }
    </div>

    <section>
      <h2>Requests</h2>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Route</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Attempts</th>
              <th>Result</th>
            </tr>
          </thead>

          <tbody>
            ${resultRows}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Regressions</h2>

      ${regressions}
    </section>

    ${
      report.baselineFound
        ? ''
        : `
    <section>
      <p>
        No baseline found. Regression comparison was skipped.
      </p>
    </section>`
    }

    <footer>
      Generated by Yellow Jacket
    </footer>
  </main>
</body>
</html>
`;
}

export function formatRunGitHub(
  report: RunReport
): string {
  const lines:
    string[] = [];

  for (
    const result
    of report.results
  ) {
    const attempts =
      resultAttempts(
        result
      );

    if (
      !result.passed
    ) {
      const retrySuffix =
        attempts >
          1
          ? ` after ${attempts} attempts`
          : '';

      lines.push(
        `::error title=Yellow Jacket assertion::${escapeGitHubCommandData(
          `${result.method} ${result.route}: ${
            result.error ??
            `request failed with status ${result.status}`
          }${retrySuffix}`
        )}`
      );

      continue;
    }

    if (
      attempts >
        1
    ) {
      lines.push(
        `::notice title=Yellow Jacket retry::${escapeGitHubCommandData(
          `${result.method} ${result.route} passed after ${attempts} attempts.`
        )}`
      );
    }
  }

  for (
    const regression
    of report.regressions
  ) {
    const details =
      regressionDetails(
        regression
      );

    lines.push(
      `::error title=Yellow Jacket regression::${escapeGitHubCommandData(
        `${regression.method} ${regression.route}: ${details.join(
          '; '
        )}`
      )}`
    );
  }

  if (
    !report.baselineFound
  ) {
    lines.push(
      '::warning title=Yellow Jacket baseline::No baseline found. Regression comparison was skipped.'
    );
  }

  if (
    report.passed
  ) {
    lines.push(
      `::notice title=Yellow Jacket run::${escapeGitHubCommandData(
        `${report.results.length} HTTP request(s) passed with no detected regressions. ${httpAttemptLabel(
          totalRunAttempts(
            report
          )
        )}; ${retriedRequestCount(
          report
        )} retried request(s).`
      )}`
    );
  }

  return `${lines.join('\n')}\n`;
}

export function formatRunGitLab(
  report: RunReport
): string {
  const regressions =
    new Map<
      string,
      Regression
    >();

  for (
    const regression
    of report.regressions
  ) {
    regressions.set(
      runKey(
        regression.method,
        regression.route
      ),
      regression
    );
  }

  const seen =
    new Set<string>();

  const cases:
    {
      xml: string;
      failed: boolean;
    }[] = [];

  for (
    const result
    of report.results
  ) {
    const key =
      runKey(
        result.method,
        result.route
      );

    seen.add(
      key
    );

    const attempts =
      resultAttempts(
        result
      );

    const messages:
      string[] = [];

    if (
      !result.passed
    ) {
      messages.push(
        result.error ??
        `request failed with status ${result.status}`
      );
    }

    const regression =
      regressions.get(
        key
      );

    if (
      regression
    ) {
      messages.push(
        ...regressionDetails(
          regression
        )
      );
    }

    const name =
      `${result.method} ${result.route}`;

    const attemptOutput =
      attempts >
        1
        ? `      <system-out>${escapeXml(
            httpAttemptLabel(
              attempts
            )
          )}</system-out>`
        : null;

    if (
      messages.length ===
        0
    ) {
      if (
        attemptOutput ===
          null
      ) {
        cases.push({
          failed:
            false,

          xml:
            `    <testcase classname="yellow-jacket.run" name="${escapeXml(
              name
            )}" time="${(
              result.durationMs /
              1000
            ).toFixed(3)}" />`
        });
      } else {
        cases.push({
          failed:
            false,

          xml: [
            `    <testcase classname="yellow-jacket.run" name="${escapeXml(
              name
            )}" time="${(
              result.durationMs /
              1000
            ).toFixed(3)}">`,
            attemptOutput,
            '    </testcase>'
          ].join(
            '\n'
          )
        });
      }

      continue;
    }

    cases.push({
      failed:
        true,

      xml: [
        `    <testcase classname="yellow-jacket.run" name="${escapeXml(
          name
        )}" time="${(
          result.durationMs /
          1000
        ).toFixed(3)}">`,
        ...(
          attemptOutput ===
            null
            ? []
            : [
                attemptOutput
              ]
        ),
        `      <failure message="Yellow Jacket run failed">${escapeXml(
          messages.join(
            '\n'
          )
        )}</failure>`,
        '    </testcase>'
      ].join(
        '\n'
      )
    });
  }

  for (
    const regression
    of report.regressions
  ) {
    const key =
      runKey(
        regression.method,
        regression.route
      );

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    cases.push({
      failed:
        true,

      xml: [
        `    <testcase classname="yellow-jacket.run" name="${escapeXml(
          `${regression.method} ${regression.route}`
        )}">`,
        `      <failure message="Yellow Jacket regression">${escapeXml(
          regressionDetails(
            regression
          ).join(
            '\n'
          )
        )}</failure>`,
        '    </testcase>'
      ].join(
        '\n'
      )
    });
  }

  const failures =
    cases.filter(
      (item) =>
        item.failed
    ).length;

  const attemptSummary =
    `${httpAttemptLabel(
      totalRunAttempts(
        report
      )
    )}; ${retriedRequestCount(
      report
    )} retried request(s).`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="Yellow Jacket run" tests="${cases.length}" failures="${failures}" skipped="0">`,
    ...cases.map(
      (item) =>
        item.xml
    ),
    `  <system-out>${escapeXml(
      report.baselineFound
        ? `${report.results.length} request(s), ${report.regressions.length} regression(s). ${attemptSummary}`
        : `${report.results.length} request(s). No baseline found; regression comparison was skipped. ${attemptSummary}`
    )}</system-out>`,
    '</testsuite>',
    ''
  ].join(
    '\n'
  );
}
