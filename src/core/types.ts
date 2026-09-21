export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type CoverageMethod =
  | HttpMethod
  | 'TRACE';

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

export interface ScenarioStep extends RouteDefinition {
  capture?: Record<string, string>;
}

export interface ScenarioDefinition {
  name: string;
  steps: ScenarioStep[];
}

export interface CompareConfig {
  ignore?: string[];
  redact?: string[];
}

export interface CoverageConfig {
  openapi?: string;
  sitemap?: string;
  minimum?: number;
}

export interface YellowJacketConfig {
  baseUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  baselinePath?: string;
  compare?: CompareConfig;
  coverage?: CoverageConfig;
  routes?: RouteDefinition[];
  scenarios?: ScenarioDefinition[];
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

export type BodyChangeKind =
  | 'added'
  | 'removed'
  | 'changed';

export interface BodyChange {
  path: string;
  kind: BodyChangeKind;
  before?: unknown;
  after?: unknown;
}

export interface Regression {
  route: string;
  method: HttpMethod;
  changes: string[];
  bodyChanges?: BodyChange[];
}

export interface CoverageOperation {
  method: CoverageMethod;
  path: string;
  covered: boolean;
  matchedBy?: string;
}

export interface CoverageReport {
  source: string;
  total: number;
  covered: number;
  uncovered: number;
  percentage: number;
  minimum?: number;
  passed: boolean;
  operations: CoverageOperation[];
}
