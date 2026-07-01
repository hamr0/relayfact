import test from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum.js';

test('sum adds two numbers', () => {
  assert.equal(sum(2, 3), 5);
  assert.equal(sum(-1, 1), 0);
  assert.equal(sum(0, 0), 0);
});
