import type {
  BaselineFile,
  RouteDefinition,
  RunSelection,
  ScenarioDefinition,
  YellowJacketConfig
} from './types.js';

function normalized(
  values:
    string[] | undefined
): Set<string> {
  return new Set(
    (
      values ??
      []
    )
      .map(
        (value) =>
          value.trim()
      )
      .filter(
        Boolean
      )
  );
}

export function hasRunSelection(
  selection:
    RunSelection | undefined
): boolean {
  return (
    (
      selection?.routes
        ?.length ??
      0
    ) >
      0 ||
    (
      selection?.scenarios
        ?.length ??
      0
    ) >
      0 ||
    (
      selection?.tags
        ?.length ??
      0
    ) >
      0
  );
}

function hasSelectedTag(
  tags: string[] | undefined,
  selectedTags: Set<string>
): boolean {
  return (
    selectedTags.size >
      0 &&
    (
      tags ??
      []
    ).some(
      (tag) =>
        selectedTags.has(
          tag
        )
    )
  );
}

function routeMatches(
  route: RouteDefinition,
  selection: RunSelection
): boolean {
  const routes =
    normalized(
      selection.routes
    );

  const tags =
    normalized(
      selection.tags
    );

  return (
    routes.has(
      route.path
    ) ||
    (
      route.name !==
        undefined &&
      routes.has(
        route.name
      )
    ) ||
    hasSelectedTag(
      route.tags,
      tags
    )
  );
}

function scenarioMatches(
  scenario: ScenarioDefinition,
  selection: RunSelection
): boolean {
  const scenarios =
    normalized(
      selection.scenarios
    );

  const tags =
    normalized(
      selection.tags
    );

  return (
    scenarios.has(
      scenario.name
    ) ||
    hasSelectedTag(
      scenario.tags,
      tags
    )
  );
}

export function selectRunConfig(
  config: YellowJacketConfig,
  selection:
    RunSelection | undefined
): YellowJacketConfig {
  if (
    !hasRunSelection(
      selection
    )
  ) {
    return config;
  }

  const selected =
    selection ?? {};

  return {
    ...config,

    routes:
      (
        config.routes ??
        []
      ).filter(
        (route) =>
          routeMatches(
            route,
            selected
          )
      ),

    scenarios:
      (
        config.scenarios ??
        []
      ).filter(
        (scenario) =>
          scenarioMatches(
            scenario,
            selected
          )
      )
  };
}

export function countRunTargets(
  config: YellowJacketConfig
): number {
  return (
    (
      config.routes
        ?.length ??
      0
    ) +
    (
      config.scenarios
        ?.length ??
      0
    )
  );
}

function selectedSnapshotKeys(
  config: YellowJacketConfig
): Set<string> {
  const keys =
    new Set<string>();

  for (
    const route
    of config.routes ?? []
  ) {
    keys.add(
      `${route.method ?? 'GET'} ${route.name ?? route.path}`
    );
  }

  for (
    const scenario
    of config.scenarios ?? []
  ) {
    for (
      const step
      of scenario.steps
    ) {
      keys.add(
        `${step.method ?? 'GET'} ${scenario.name} > ${step.name ?? step.path}`
      );
    }
  }

  return keys;
}

export function filterBaselineForRun(
  baseline: BaselineFile,
  config: YellowJacketConfig
): BaselineFile {
  const keys =
    selectedSnapshotKeys(
      config
    );

  return {
    ...baseline,

    responses:
      baseline.responses.filter(
        (response) =>
          keys.has(
            `${response.method} ${response.route}`
          )
      )
  };
}
