import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountId } from './accountId.js';

// Same convention as every entity; only the prefix (=> check letter) and change.
test('accountId formats per the project ID convention', () => {
  assert.equal(accountId(42), "ACCOUNT-000042-A");
  assert.equal(accountId(0), "ACCOUNT-000000-A");
  assert.equal(accountId(7), "ACCOUNT-000007-A");
});
