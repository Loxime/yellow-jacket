import type {
  CoverageReport
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
