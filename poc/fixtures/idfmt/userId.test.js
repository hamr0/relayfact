import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userId } from './userId.js';

// Multiple cases force the RULE (uppercase prefix, width-6 zero pad, check = first letter), not one output.
test('userId formats per the project ID convention', () => {
  assert.equal(userId(7), 'USER-000007-U');
  assert.equal(userId(0), 'USER-000000-U');
  assert.equal(userId(123456), 'USER-123456-U');
});
