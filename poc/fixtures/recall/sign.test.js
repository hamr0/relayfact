import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign } from './sign.js';

// The expected value is an arbitrary project secret/convention — unguessable, and the worker
// has no tool to read THIS file. So a blind worker cannot produce it; it can only come from memory.
test('sign() returns the production signing salt (a fixed project convention)', () => {
  assert.equal(sign(), 'RLF-7Q2X-PROD');
});
