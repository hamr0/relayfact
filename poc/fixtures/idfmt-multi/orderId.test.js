import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderId } from './orderId.js';

// Same convention as every entity; only the prefix (=> check letter) and change.
test('orderId formats per the project ID convention', () => {
  assert.equal(orderId(42), "ORDER-000042-O");
  assert.equal(orderId(5), "ORDER-000005-O");
  assert.equal(orderId(999999), "ORDER-999999-O");
});
