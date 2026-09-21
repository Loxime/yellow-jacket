import type { BodyChange } from './types.js';

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function appendPath(
  path: string,
  key: string | number
): string {
  if (typeof key === 'number') {
    return `${path}[${key}]`;
  }

  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return `${path}.${key}`;
  }

  return `${path}[${JSON.stringify(key)}]`;
}

export function diffBodies(
  before: unknown,
  after: unknown,
  path = '$'
): BodyChange[] {
  if (Object.is(before, after)) {
    return [];
  }

  if (
    Array.isArray(before) &&
    Array.isArray(after)
  ) {
    const changes: BodyChange[] = [];

    const maxLength = Math.max(
      before.length,
      after.length
    );

    for (
      let index = 0;
      index < maxLength;
      index += 1
    ) {
      const childPath = appendPath(
        path,
        index
      );

      if (index >= before.length) {
        changes.push({
          path: childPath,
          kind: 'added',
          after: after[index]
        });

        continue;
      }

      if (index >= after.length) {
        changes.push({
          path: childPath,
          kind: 'removed',
          before: before[index]
        });

        continue;
      }

      changes.push(
        ...diffBodies(
          before[index],
          after[index],
          childPath
        )
      );
    }

    return changes;
  }

  if (
    isRecord(before) &&
    isRecord(after)
  ) {
    const changes: BodyChange[] = [];

    const keys = new Set([
      ...Object.keys(before),
      ...Object.keys(after)
    ]);

    for (const key of [...keys].sort()) {
      const childPath = appendPath(
        path,
        key
      );

      const hasBefore =
        Object.prototype.hasOwnProperty.call(
          before,
          key
        );

      const hasAfter =
        Object.prototype.hasOwnProperty.call(
          after,
          key
        );

      if (!hasBefore) {
        changes.push({
          path: childPath,
          kind: 'added',
          after: after[key]
        });

        continue;
      }

      if (!hasAfter) {
        changes.push({
          path: childPath,
          kind: 'removed',
          before: before[key]
        });

        continue;
      }

      changes.push(
        ...diffBodies(
          before[key],
          after[key],
          childPath
        )
      );
    }

    return changes;
  }

  return [
    {
      path,
      kind: 'changed',
      before,
      after
    }
  ];
}
