import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceId } from './invoiceId.js';

// Same convention as every entity; only the prefix (=> check letter) and change.
test('invoiceId formats per the project ID convention', () => {
  assert.equal(invoiceId(1), "INVOICE-000001-I");
  assert.equal(invoiceId(42), "INVOICE-000042-I");
  assert.equal(invoiceId(123456), "INVOICE-123456-I");
});
