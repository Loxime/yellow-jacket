---
layout: home

hero:
  name: "🐝 Yellow Jacket"
  text: "Catch HTTP regressions before they sting."
  tagline: "Developer-first HTTP regression testing for routes and API workflows."

  actions:
    - theme: brand
      text: Get started
      link: /get-started

    - theme: alt
      text: GitHub
      link: https://github.com/Loxime/yellow-jacket

features:
  - title: HTTP regression testing
    details: Store known-good responses and detect status, body and structural regressions.

  - title: Chained scenarios
    details: Create, capture, reuse and delete resources through sequential HTTP workflows.

  - title: Route coverage
    details: Compare your declared tests against OpenAPI and sitemap route inventories.

  - title: Git pre-push protection
    details: Block pushes when HTTP behavior changes unexpectedly.

  - title: CI-friendly reports
    details: Generate text, JSON, Markdown and standalone HTML reports.

  - title: Zero runtime dependencies
    details: Built on Node.js native APIs with a deliberately small architecture.
---

## HTTP regression testing for developers
Yellow Jacket runs declared HTTP requests against your application and compares
the results with a known-good baseline.
```text
code change
|
v
yellow-jacket run
|
+-- expected behavior ----> push continues
|
+-- regression detected --> push stops
```
It is designed to sit close to the development workflow rather than becoming
another test server or hosted platform.
## Built for local development and CI
Use Yellow Jacket locally through its Git `pre-push` hook, then reuse the same
configuration in GitHub Actions, GitLab CI or another automation environment.
```bash
yellow-jacket baseline
yellow-jacket run
yellow-jacket coverage
```
[Get started ->](/get-started)
