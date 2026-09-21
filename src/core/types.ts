export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface RouteExpectation {
  status?: number | number[];
}

export interface RouteDefinition {
  name?: string;
  method?: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  expect?: RouteExpectation;
}

export interface YellowJacketConfig {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  baselinePath?: string;
  routes: RouteDefinition[];
}

export interface ResponseSnapshot {
  route: string;
  method: HttpMethod;
  url: string;
  status: number;
  contentType: string | null;
  body: unknown;
  durationMs: number;
}

export interface RouteRunResult extends ResponseSnapshot {
  passed: boolean;
  error?: string;
}

export interface BaselineFile {
  formatVersion: 1;
  createdAt: string;
  baseUrl: string;
  responses: ResponseSnapshot[];
}

export interface Regression {
  route: string;
  method: HttpMethod;
  changes: string[];
}
