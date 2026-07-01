import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seal } from './seal.js';

// Same arbitrary project salt as sign() — the shared convention. Unguessable, and this file is unreadable
// by the worker. In run 2 it can only come from memory recalled across runs.
test('seal() returns the production signing salt (same project convention as sign)', () => {
  assert.equal(seal(), 'RLF-7Q2X-PROD');
});
