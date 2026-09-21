import type { CompareConfig } from './types.js';

export const IGNORED_VALUE = '[IGNORED]';
export const REDACTED_VALUE = '[REDACTED]';

type PathSegment = string | number | '*';
type Mode = 'ignore' | 'redact';

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(
      value as Record<string, unknown>
    )) {
      output[key] = cloneValue(child);
    }

    return output;
  }

  return value;
}

export function parseJsonPath(path: string): PathSegment[] {
  if (!path.startsWith('$')) {
    throw new Error(
      `Invalid compare path "${path}": paths must start with $.`
    );
  }

  if (path === '$') {
    return [];
  }

  const segments: PathSegment[] = [];
  let index = 1;

  while (index < path.length) {
    const char = path[index];

    if (char === '.') {
      index += 1;

      const start = index;

      while (
        index < path.length &&
        path[index] !== '.' &&
        path[index] !== '['
      ) {
        index += 1;
      }

      const key = path.slice(start, index);

      if (!key) {
        throw new Error(`Invalid compare path "${path}".`);
      }

      segments.push(key === '*' ? '*' : key);
      continue;
    }

    if (char === '[') {
      const end = path.indexOf(']', index);

      if (end === -1) {
        throw new Error(`Invalid compare path "${path}".`);
      }

      const token = path.slice(index + 1, end);

      if (token === '*') {
        segments.push('*');
      } else if (/^\d+$/.test(token)) {
        segments.push(Number(token));
      } else {
        throw new Error(
          `Invalid compare path "${path}": bracket notation only supports numeric indexes or *.`
        );
      }

      index = end + 1;
      continue;
    }

    throw new Error(
      `Invalid compare path "${path}" near "${path.slice(index)}".`
    );
  }

  return segments;
}

function applyRule(
  current: unknown,
  segments: PathSegment[],
  mode: Mode,
  depth = 0
): void {
  if (
    depth >= segments.length ||
    current === null ||
    typeof current !== 'object'
  ) {
    return;
  }

  const segment = segments[depth];
  const isLast = depth === segments.length - 1;

  const replacement =
    mode === 'ignore'
      ? IGNORED_VALUE
      : REDACTED_VALUE;

  if (Array.isArray(current)) {
    if (segment === '*') {
      for (let index = 0; index < current.length; index += 1) {
        if (isLast) {
          current[index] = replacement;
        } else {
          applyRule(
            current[index],
            segments,
            mode,
            depth + 1
          );
        }
      }

      return;
    }

    if (
      typeof segment !== 'number' ||
      segment < 0 ||
      segment >= current.length
    ) {
      return;
    }

    if (isLast) {
      current[segment] = replacement;
    } else {
      applyRule(
        current[segment],
        segments,
        mode,
        depth + 1
      );
    }

    return;
  }

  const record = current as Record<string, unknown>;

  if (segment === '*') {
    for (const key of Object.keys(record)) {
      if (isLast) {
        record[key] = replacement;
      } else {
        applyRule(
          record[key],
          segments,
          mode,
          depth + 1
        );
      }
    }

    return;
  }

  if (
    typeof segment !== 'string' ||
    !(segment in record)
  ) {
    return;
  }

  if (isLast) {
    record[segment] = replacement;
  } else {
    applyRule(
      record[segment],
      segments,
      mode,
      depth + 1
    );
  }
}

export function normalizeBody(
  body: unknown,
  compare: CompareConfig = {}
): unknown {
  let normalized = cloneValue(body);

  for (const path of compare.ignore ?? []) {
    const segments = parseJsonPath(path);

    if (segments.length === 0) {
      normalized = IGNORED_VALUE;
      continue;
    }

    applyRule(
      normalized,
      segments,
      'ignore'
    );
  }

  for (const path of compare.redact ?? []) {
    const segments = parseJsonPath(path);

    if (segments.length === 0) {
      normalized = REDACTED_VALUE;
      continue;
    }

    applyRule(
      normalized,
      segments,
      'redact'
    );
  }

  return normalized;
}
