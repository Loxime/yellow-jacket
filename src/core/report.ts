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
