export {
  defineConfig,
  findConfig,
  loadConfig
} from './core/config.js';

export {
  isActionMethod,
  isSafeActionTarget,
  runRoute,
  runSuite
} from './core/runner.js';

export {
  runScenario,
  validateCapture
} from './core/scenario.js';

export {
  YELLOW_JACKET_HOOKS_PATH,
  findGitRoot,
  getGitHooksPath,
  installGitHook
} from './core/git.js';

export {
  buildCoverageReport,
  normalizeCoveragePath
} from './core/coverage.js';

export {
  baselinePath,
  compareWithBaseline,
  readBaseline,
  writeBaseline
} from './core/baseline.js';

export {
  diffBodies
} from './core/diff.js';

export {
  IGNORED_VALUE,
  REDACTED_VALUE,
  normalizeBody,
  parseJsonPath
} from './core/normalize.js';

export type {
  BaselineFile,
  BodyChange,
  BodyChangeKind,
  CompareConfig,
  CoverageConfig,
  CoverageMethod,
  CoverageOperation,
  CoverageReport,
  HttpMethod,
  Regression,
  ResponseSnapshot,
  RouteDefinition,
  RouteExpectation,
  RouteRunResult,
  RunOptions,
  ScenarioDefinition,
  ScenarioStep,
  YellowJacketConfig
} from './core/types.js';
