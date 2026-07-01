import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ticketId } from './ticketId.js';

// Same convention as every entity; only the prefix (=> check letter) and change.
test('ticketId formats per the project ID convention', () => {
  assert.equal(ticketId(9), "TICKET-000009-T");
  assert.equal(ticketId(42), "TICKET-000042-T");
  assert.equal(ticketId(1000), "TICKET-001000-T");
});
