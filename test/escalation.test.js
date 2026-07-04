// escalation.test.js — the come-back artifact + the isDecisionReady control that can FAIL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEscalation, isDecisionReady } from '../src/escalation.mjs';

test('a well-formed attempt-bearing escalation is decision-ready', () => {
  const a = buildEscalation({
    goal: 'make the suite pass', blocker: 'close-exhausted',
    whatWasTried: [{ iteration: 0, delta: 'wrote impl', verdict: 'fail', gap: 'off-by-one on rounding' }],
    receipts: ['refine:iterations=3'], costSpent: 0.04,
  });
  assert.equal(isDecisionReady(a).ok, true);
  assert.ok(a.decisionNeeded.options.length >= 2);
});

test('a pre-flight decline is decision-ready with NO attempts (0 spend, legitimately empty)', () => {
  const a = buildEscalation({ goal: 'do the thing', blocker: 'preflight-declined', whatWasTried: [], costSpent: 0 });
  assert.equal(isDecisionReady(a).ok, true);
});

test('CONTROL — a bare {incomplete} (what G3 replaces) is REJECTED', () => {
  assert.equal(isDecisionReady({ incomplete: true, best: null }).ok, false);
});

test('CONTROL — a report with <2 options is REJECTED', () => {
  const a = buildEscalation({ goal: 'x', blocker: 'budget-cap', whatWasTried: [{ verdict: 'fail', gap: 'g' }] });
  a.decisionNeeded.options = ['only one'];
  assert.equal(isDecisionReady(a).ok, false);
});

test('CONTROL — an attempt-bearing stop with EMPTY whatWasTried is REJECTED', () => {
  const a = buildEscalation({ goal: 'x', blocker: 'close-exhausted', whatWasTried: [] });
  const r = isDecisionReady(a);
  assert.equal(r.ok, false);
  assert.match(r.why, /empty whatWasTried/);
});

test('CONTROL — an attempt missing its verdict/gap is REJECTED', () => {
  const a = buildEscalation({ goal: 'x', blocker: 'governance-deny', whatWasTried: [{ delta: 'tried', gap: '' }] });
  assert.equal(isDecisionReady(a).ok, false);
});

test('CONTROL — an unknown blocker is REJECTED (no fabricated question)', () => {
  assert.equal(isDecisionReady({ goal: 'x', blocker: 'made-up', decisionNeeded: { question: 'q', options: ['a', 'b'] }, whatWasTried: [], receipts: [], costSpent: 0 }).ok, false);
});
