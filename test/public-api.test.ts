import assert from 'node:assert/strict';
import test from 'node:test';

import * as api
  from '../src/index.js';

test(
  'exports retry scheduling helpers from the package entrypoint',
  () => {
    assert.equal(
      typeof api.calculateRetryDelay,
      'function'
    );

    assert.equal(
      typeof api.calculateEffectiveRetryDelay,
      'function'
    );

    assert.equal(
      typeof api.parseRetryAfter,
      'function'
    );
  }
);
