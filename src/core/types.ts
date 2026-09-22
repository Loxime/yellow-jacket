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

export type RedirectMode =
  | 'follow'
  | 'error'
  | 'manual';

export interface RetryConfig {
  maxAttempts?: number;
  delayMs?: number;
  statuses?: number[];
  retryActions?: boolean;
}

export interface RouteExpectation {
  status?: number | number[];

  contentType?:
    string | string[];

  maxDurationMs?: number;

  headers?: Record<
    string,
    string | string[]
  >;
}

export interface RouteDefinition {
  name?: string;
  tags?: string[];
  method?: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  redirect?: RedirectMode;
  retry?: RetryConfig | false;
  expect?: RouteExpectation;
}

export interface ScenarioStep
  extends Omit<
    RouteDefinition,
    'tags'
  > {
  capture?: Record<string, string>;
}

export interface ScenarioDefinition {
  name: string;
  tags?: string[];
  steps: ScenarioStep[];
}

export interface CompareConfig {
  ignore?: string[];
  redact?: string[];
  headers?: string[];
  redirects?: boolean;
}

export interface CoverageConfig {
  openapi?: string;
  sitemap?: string;
  minimum?: number;
}

export interface YellowJacketConfig {
  baseUrl: string;
  timeoutMs?: number;

  concurrency?: number;

  retries?: RetryConfig;

  headers?: Record<string, string>;
  baselinePath?: string;
  compare?: CompareConfig;
  coverage?: CoverageConfig;
  routes?: RouteDefinition[];
  scenarios?: ScenarioDefinition[];
}

export interface RunSelection {
  routes?: string[];
  scenarios?: string[];
  tags?: string[];
}

export interface RunOptions {
  allowActions?: boolean;
  selection?: RunSelection;
}

export interface ResponseSnapshot {
  route: string;
  method: HttpMethod;
  url: string;
  status: number;
  contentType: string | null;
  body: unknown;
  durationMs: number;

  responseHeaders?: Record<
    string,
    string | null
  >;

  redirected?: boolean;
  finalUrl?: string;
}

export interface RouteRunResult
  extends ResponseSnapshot {
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

export interface RunReport {
  baselineFound: boolean;
  passed: boolean;
  results: RouteRunResult[];
  regressions: Regression[];
}

export type DoctorCheckStatus =
  | 'pass'
  | 'warning'
  | 'error';

export interface DoctorCheck {
  id: string;
  status: DoctorCheckStatus;
  message: string;
}

export interface DoctorReport {
  passed: boolean;

  summary: {
    pass: number;
    warning: number;
    error: number;
  };

  checks: DoctorCheck[];
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
