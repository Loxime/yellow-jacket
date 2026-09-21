import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCoverageGitHub,
  formatCoverageGitLab,
  formatCoverageHtml,
  formatCoverageMarkdown,
  formatRunGitHub,
  formatRunGitLab,
  formatRunMarkdown
} from '../src/core/report.js';

import type {
  CoverageReport,
  RunReport
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

test(
  'formats coverage as a safe standalone HTML report',
  () => {
    const report:
      CoverageReport = {
        source:
          '/tmp/<openapi>.json',
        total: 1,
        covered: 1,
        uncovered: 0,
        percentage: 100,
        minimum: 80,
        passed: true,

        operations: [
          {
            method:
              'GET',
            path:
              '/users/<script>',
            covered: true,
            matchedBy:
              'route: users & admin'
          }
        ]
      };

    const html =
      formatCoverageHtml(
        report
      );

    assert.match(
      html,
      /^<!doctype html>/
    );

    assert.match(
      html,
      /<title>Yellow Jacket coverage<\/title>/
    );

    assert.match(
      html,
      /100%/
    );

    assert.match(
      html,
      /\/users\/&lt;script&gt;/
    );

    assert.match(
      html,
      /route: users &amp; admin/
    );

    assert.equal(
      html.includes(
        '/users/<script>'
      ),
      false
    );
  }
);

test(
  'formats coverage as GitHub Actions annotations',
  () => {
    const report:
      CoverageReport = {
        source:
          '/tmp/openapi.json',
        total:
          2,
        covered:
          1,
        uncovered:
          1,
        percentage:
          50,
        minimum:
          80,
        passed:
          false,

        operations: [
          {
            method:
              'GET',
            path:
              '/health',
            covered:
              true
          },
          {
            method:
              'POST',
            path:
              '/users%2Fadmin',
            covered:
              false
          }
        ]
      };

    const output =
      formatCoverageGitHub(
        report
      );

    assert.match(
      output,
      /::warning title=Yellow Jacket coverage::POST \/users%252Fadmin is not covered/
    );

    assert.match(
      output,
      /::error title=Yellow Jacket coverage::Coverage 50%25 \(1\/2\)\. Minimum 80%25\./
    );
  }
);

test(
  'formats coverage as GitLab JUnit XML',
  () => {
    const report:
      CoverageReport = {
        source:
          '/tmp/openapi&api.yaml',
        total:
          2,
        covered:
          1,
        uncovered:
          1,
        percentage:
          50,
        minimum:
          80,
        passed:
          false,

        operations: [
          {
            method:
              'GET',
            path:
              '/health',
            covered:
              true
          },
          {
            method:
              'GET',
            path:
              '/users?a=1&b=2',
            covered:
              false
          }
        ]
      };

    const xml =
      formatCoverageGitLab(
        report
      );

    assert.match(
      xml,
      /^<\?xml version="1\.0" encoding="UTF-8"\?>/
    );

    assert.match(
      xml,
      /tests="3" failures="1" skipped="1"/
    );

    assert.match(
      xml,
      /GET \/users\?a=1&amp;b=2/
    );

    assert.match(
      xml,
      /<skipped message="Uncovered operation" \/>/
    );

    assert.match(
      xml,
      /Coverage 50% is below minimum 80%\./
    );

    assert.equal(
      xml.includes(
        '/tmp/openapi&api.yaml'
      ),
      false
    );
  }
);

const failingRunReport:
  RunReport = {
  baselineFound: true,
  passed: false,

  results: [
    {
      route: 'users',
      method: 'GET',
      url: 'http://localhost/users',
      status: 500,
      contentType: 'application/json',
      body: { count: 0 },
      durationMs: 12,
      passed: false,
      error: 'Expected status 200, received 500.'
    }
  ],

  regressions: [
    {
      route: 'users',
      method: 'GET',

      changes: [
        'status 200 -> 500',
        'response body changed',
        'header x-api-version "1" -> "2"'
      ],

      bodyChanges: [
        {
          path: '$.count',
          kind: 'changed',
          before: 1,
          after: 0
        }
      ]
    }
  ]
};

test(
  'formats an HTTP run as Markdown',
  () => {
    const output =
      formatRunMarkdown(
        failingRunReport
      );

    assert.match(
      output,
      /## 🐝 Yellow Jacket run/
    );

    assert.match(
      output,
      /❌ Failed/
    );

    assert.match(
      output,
      /status 200 -> 500/
    );

    assert.match(
      output,
      /\$\.count: 1 -> 0/
    );
  }
);

test(
  'formats HTTP regressions as GitHub annotations',
  () => {
    const output =
      formatRunGitHub(
        failingRunReport
      );

    assert.match(
      output,
      /::error title=Yellow Jacket assertion::/
    );

    assert.match(
      output,
      /::error title=Yellow Jacket regression::/
    );

    assert.match(
      output,
      /x-api-version/
    );
  }
);

test(
  'formats an HTTP run as GitLab JUnit XML',
  () => {
    const output =
      formatRunGitLab(
        failingRunReport
      );

    assert.match(
      output,
      /^<\?xml/
    );

    assert.match(
      output,
      /tests="1" failures="1"/
    );

    assert.match(
      output,
      /Yellow Jacket run failed/
    );

    assert.match(
      output,
      /status 200 -&gt; 500/
    );
  }
);
