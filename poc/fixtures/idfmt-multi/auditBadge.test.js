import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditBadge } from './auditBadge.js';

// Same convention as every entity; only the prefix (=> check letter) and the output wrapping change.
test('auditBadge formats per the project ID convention', () => {
  assert.equal(auditBadge(42), "<<AUDIT-000042-A>>");
  assert.equal(auditBadge(5), "<<AUDIT-000005-A>>");
  assert.equal(auditBadge(999999), "<<AUDIT-999999-A>>");
});
