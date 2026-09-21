import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCoverageMarkdown
} from '../src/core/report.js';

import type {
  CoverageReport
} from '../src/core/types.js';

test(
  'formats coverage as a Markdown CI summary',
  () => {
    const report:
      CoverageReport = {
        source:
          '/tmp/openapi.json',
        total: 2,
        covered: 1,
        uncovered: 1,
        percentage: 50,
        minimum: 80,
        passed: false,

        operations: [
          {
            method:
              'GET',
            path:
              '/users',
            covered: true,
            matchedBy:
              'route: users'
          },
          {
            method:
              'POST',
            path:
              '/users',
            covered: false
          }
        ]
      };

    const markdown =
      formatCoverageMarkdown(
        report
      );

    assert.match(
      markdown,
      /## 🐝 Yellow Jacket coverage/
    );

    assert.match(
      markdown,
      /\*\*Coverage:\*\* 50% \(1\/2\)/
    );

    assert.match(
      markdown,
      /\*\*Minimum:\*\* 80%/
    );

    assert.match(
      markdown,
      /❌ Coverage requirement not satisfied/
    );

    assert.match(
      markdown,
      /\| GET \| \/users \| ✅ Covered \| route: users \|/
    );

    assert.match(
      markdown,
      /\| POST \| \/users \| ❌ Uncovered \| — \|/
    );
  }
);
