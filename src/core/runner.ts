import type {
  HttpMethod,
  RouteDefinition,
  RouteRunResult,
  YellowJacketConfig
} from './types.js';

function expectedStatusMatches(route: RouteDefinition, status: number): boolean {
  const expected = route.expect?.status;
  if (expected === undefined) return true;
  return Array.isArray(expected) ? expected.includes(status) : expected === status;
}

function parseBody(text: string, contentType: string | null): unknown {
  if (text.length === 0) return null;
  if (contentType?.includes('json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

export async function runRoute(
  config: YellowJacketConfig,
  route: RouteDefinition
): Promise<RouteRunResult> {
  const method: HttpMethod = route.method ?? 'GET';
  const url = new URL(route.path, config.baseUrl).toString();
  const headers = new Headers(config.headers);

  for (const [name, value] of Object.entries(route.headers ?? {})) {
    headers.set(name, value);
  }

  let body: BodyInit | undefined;
  if (route.body !== undefined) {
    if (typeof route.body === 'string') {
      body = route.body;
    } else if (route.body instanceof Uint8Array) {
      // BodyInit expects a standard ArrayBuffer here.
      body = new Uint8Array(route.body).buffer;
    } else {
      body = JSON.stringify(route.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }
  }

  const startedAt = performance.now();

  try {
    const requestInit: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(config.timeoutMs ?? 10_000)
    };
    if (body !== undefined) requestInit.body = body;

    const response = await fetch(url, requestInit);
    const text = await response.text();
    const contentType = response.headers.get('content-type');
    const statusMatches = expectedStatusMatches(route, response.status);

    return {
      route: route.name ?? route.path,
      method,
      url,
      status: response.status,
      contentType,
      body: parseBody(text, contentType),
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      passed: statusMatches,
      ...(statusMatches
        ? {}
        : { error: `Expected status ${String(route.expect?.status)}, received ${response.status}.` })
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      route: route.name ?? route.path,
      method,
      url,
      status: 0,
      contentType: null,
      body: null,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      passed: false,
      error: message
    };
  }
}

export async function runSuite(config: YellowJacketConfig): Promise<RouteRunResult[]> {
  const results: RouteRunResult[] = [];
  for (const route of config.routes) {
    results.push(await runRoute(config, route));
  }
  return results;
}
