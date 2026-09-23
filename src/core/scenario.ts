import { parseJsonPath } from './normalize.js';

import type {
  HttpMethod,
  RouteDefinition,
  RouteRunResult,
  ScenarioDefinition,
  ScenarioStep,
  YellowJacketConfig
} from './types.js';

type ScenarioVariables = Record<string, unknown>;

type RouteExecutor = (
  config: YellowJacketConfig,
  route: RouteDefinition
) => Promise<RouteRunResult>;

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const FULL_VARIABLE =
  /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/;

const EMBEDDED_VARIABLE =
  /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

function getVariable(
  name: string,
  variables: ScenarioVariables
): unknown {
  if (
    !Object.prototype.hasOwnProperty.call(
      variables,
      name
    )
  ) {
    throw new Error(
      `Unknown scenario variable "${name}".`
    );
  }

  return variables[name];
}

function stringifyVariable(
  name: string,
  value: unknown
): string {
  if (value === null) {
    return 'null';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  throw new Error(
    `Scenario variable "${name}" cannot be embedded in text because it is not a scalar value.`
  );
}

function interpolateText(
  value: string,
  variables: ScenarioVariables
): string {
  const fullMatch =
    value.match(FULL_VARIABLE);

  if (fullMatch) {
    const name = fullMatch[1];

    if (!name) {
      return value;
    }

    return stringifyVariable(
      name,
      getVariable(
        name,
        variables
      )
    );
  }

  return value.replace(
    EMBEDDED_VARIABLE,
    (_match, name: string) =>
      stringifyVariable(
        name,
        getVariable(
          name,
          variables
        )
      )
  );
}

function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function interpolateValue(
  value: unknown,
  variables: ScenarioVariables
): unknown {
  if (typeof value === 'string') {
    const fullMatch =
      value.match(FULL_VARIABLE);

    if (fullMatch) {
      const name = fullMatch[1];

      if (!name) {
        return value;
      }

      return getVariable(
        name,
        variables
      );
    }

    return interpolateText(
      value,
      variables
    );
  }

  if (Array.isArray(value)) {
    return value.map(
      (item) =>
        interpolateValue(
          item,
          variables
        )
    );
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (isPlainRecord(value)) {
    const output:
      Record<string, unknown> = {};

    for (
      const [key, child]
      of Object.entries(value)
    ) {
      output[key] =
        interpolateValue(
          child,
          variables
        );
    }

    return output;
  }

  return value;
}

function stepLabel(
  scenario: ScenarioDefinition,
  step: ScenarioStep,
  cleanup = false
): string {
  const label =
    step.name ??
    step.path;

  return cleanup
    ? `${scenario.name} > cleanup > ${label}`
    : `${scenario.name} > ${label}`;
}

function resolveScenarioStep(
  scenario: ScenarioDefinition,
  step: ScenarioStep,
  variables: ScenarioVariables,
  cleanup = false
): RouteDefinition {
  const {
    capture: _capture,
    ...baseRoute
  } = step;

  const route: RouteDefinition = {
    ...baseRoute,
    name: stepLabel(
      scenario,
      step,
      cleanup
    ),
    path: interpolateText(
      step.path,
      variables
    )
  };

  if (step.headers) {
    route.headers =
      Object.fromEntries(
        Object.entries(
          step.headers
        ).map(
          ([name, value]) => [
            name,
            interpolateText(
              value,
              variables
            )
          ]
        )
      );
  }

  if (step.body !== undefined) {
    route.body =
      interpolateValue(
        step.body,
        variables
      );
  }

  return route;
}

interface CaptureResult {
  found: boolean;
  value?: unknown;
}

function captureValue(
  body: unknown,
  path: string
): CaptureResult {
  const segments =
    parseJsonPath(path);

  if (
    segments.includes('*')
  ) {
    throw new Error(
      `Capture path "${path}" cannot contain a wildcard.`
    );
  }

  let current = body;

  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (
        !Array.isArray(current) ||
        segment < 0 ||
        segment >= current.length
      ) {
        return {
          found: false
        };
      }

      current =
        current[segment];

      continue;
    }

    if (
      current === null ||
      typeof current !== 'object'
    ) {
      return {
        found: false
      };
    }

    const record =
      current as Record<
        string,
        unknown
      >;

    if (
      !Object.prototype.hasOwnProperty.call(
        record,
        segment
      )
    ) {
      return {
        found: false
      };
    }

    current =
      record[segment];
  }

  return {
    found: true,
    value: current
  };
}

function failedStepResult(
  config: YellowJacketConfig,
  scenario: ScenarioDefinition,
  step: ScenarioStep,
  error: unknown,
  cleanup = false
): RouteRunResult {
  const method:
    HttpMethod =
      step.method ?? 'GET';

  let url = step.path;

  try {
    url = new URL(
      step.path,
      config.baseUrl
    ).toString();
  } catch {
    // Keep the unresolved path for diagnostics.
  }

  return {
    route: stepLabel(
      scenario,
      step,
      cleanup
    ),
    method,
    url,
    status: 0,
    contentType: null,
    body: null,
    durationMs: 0,
    passed: false,
    error:
      error instanceof Error
        ? error.message
        : String(error)
  };
}

async function executeScenarioStep(
  config: YellowJacketConfig,
  scenario: ScenarioDefinition,
  step: ScenarioStep,
  variables: ScenarioVariables,
  execute: RouteExecutor,
  cleanup: boolean
): Promise<RouteRunResult> {
  let route:
    RouteDefinition;

  try {
    route =
      resolveScenarioStep(
        scenario,
        step,
        variables,
        cleanup
      );
  } catch (error) {
    return failedStepResult(
      config,
      scenario,
      step,
      error,
      cleanup
    );
  }

  let result:
    RouteRunResult;

  try {
    result =
      await execute(
        config,
        route
      );
  } catch (error) {
    return failedStepResult(
      config,
      scenario,
      step,
      error,
      cleanup
    );
  }

  if (
    !result.passed
  ) {
    return result;
  }

  try {
    for (
      const [
        variable,
        path
      ]
      of Object.entries(
        step.capture ??
        {}
      )
    ) {
      validateCapture(
        variable,
        path
      );

      const captured =
        captureValue(
          result.body,
          path
        );

      if (
        !captured.found
      ) {
        throw new Error(
          `Capture "${variable}" could not resolve "${path}".`
        );
      }

      variables[variable] =
        captured.value;
    }
  } catch (error) {
    return {
      ...result,
      passed:
        false,
      error:
        error instanceof Error
          ? error.message
          : String(
              error
            )
    };
  }

  return result;
}

export function validateCapture(
  variable: string,
  path: string
): void {
  if (
    !VARIABLE_NAME.test(variable)
  ) {
    throw new Error(
      `Invalid scenario variable "${variable}". Use letters, numbers and underscores, starting with a letter or underscore.`
    );
  }

  const segments =
    parseJsonPath(path);

  if (
    segments.includes('*')
  ) {
    throw new Error(
      `Capture path "${path}" cannot contain a wildcard.`
    );
  }
}

export async function runScenario(
  config: YellowJacketConfig,
  scenario: ScenarioDefinition,
  execute: RouteExecutor
): Promise<RouteRunResult[]> {
  const variables:
    ScenarioVariables = {};

  const results:
    RouteRunResult[] = [];

  for (
    const step
    of scenario.steps
  ) {
    const result =
      await executeScenarioStep(
        config,
        scenario,
        step,
        variables,
        execute,
        false
      );

    results.push(
      result
    );

    if (
      !result.passed
    ) {
      break;
    }
  }

  for (
    const step
    of scenario.cleanup ??
      []
  ) {
    const result =
      await executeScenarioStep(
        config,
        scenario,
        step,
        variables,
        execute,
        true
      );

    results.push(
      result
    );
  }

  return results;
}
