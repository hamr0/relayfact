// worker.test.js — the delivery decision (token-free). The live gated loop is verified separately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryDecision } from '../src/worker.mjs';

test('delivers only when the final close is green AND the run is not incomplete', () => {
  const r = deliveryDecision({ finalClose: { pass: true }, incomplete: false });
  assert.equal(r.delivered, true);
  assert.equal(r.outcome, 'delivered');
});

test('CONTROL — a red final close never delivers (the test grounds delivery)', () => {
  const r = deliveryDecision({ finalClose: { pass: false }, incomplete: false });
  assert.equal(r.delivered, false);
  assert.equal(r.outcome, 'escalated-red');
});

test('CONTROL — incomplete never delivers, even if the last close happened to be green', () => {
  // Guards a "green-but-stopped-early" false deliver: incomplete wins.
  const r = deliveryDecision({ finalClose: { pass: true }, incomplete: true });
  assert.equal(r.delivered, false);
  assert.equal(r.outcome, 'escalated-incomplete');
});
