// pipeline.test.js — the assembled pipe's control flow, token-free. The three token-spending stages
// (pre-flight, compile-close, worker) are INJECTED as fakes so every branch is exercised without a key; the
// D5 GOLD arbiter runs FOR REAL (a real `node --test` against a real impl the fake worker writes) — that
// tripwire must be able to fail, so it is never faked.
//
// Controls that can fail (PRD-v3 §3): every escalation the pipe emits MUST be decision-ready; a delivered
// impl whose independent GOLD is RED must NOT deliver (fit-to-pass); the event stream must record the stages
// that actually ran and no others.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventLog } from '../src/event-log.mjs';
import { readEventLog, renderRun } from '../src/observer.mjs';
import { runRequest } from '../src/pipeline.mjs';
import { isDecisionReady } from '../src/escalation.mjs';

const ORACLE = { reference: 'export const double = (n) => n * 2;\n', stub: 'export const double = (n) => {};\n', mutants: [] };
// An independent GOLD the worker never sees. GREEN only for a genuinely-correct double().
const GOLD = {
  name: 'gold.test.mjs',
  source: `import { double } from './impl.mjs';\nimport { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('gold', () => { assert.equal(double(3), 6); assert.equal(double(-4), -8); assert.equal(double(0), 0); });\n`,
};

function harness() {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-pipe-'));
  const log = createEventLog(join(dir, 'run.jsonl'), { clock: () => '2026-07-04T00:00:00.000Z' });
  return { dir, log, target: join(dir, 'impl.mjs'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const base = (h) => ({
  request: 'Implement double(n): return n multiplied by two.',
  workdir: h.dir, target: h.target, oracle: ORACLE, log: h.log,
});
const okCompile = { ok: true, verdict: 'trusted', suiteBytes: 200, validity: { stubCatch: true, referencePasses: true, mutantsKilled: 5 } };
const types = (h) => readEventLog(join(h.dir, 'run.jsonl')).map((e) => e.type);

test('pre-flight decline ⇒ decision-ready escalation, 0 spend, no compile/worker', async () => {
  const h = harness();
  try {
    const r = await runRequest({ ...base(h),
      deps: { preflight: async () => ({ verdict: 'decline', reason: 'not a coding task', questions: [] }) } });
    assert.equal(r.outcome, 'escalated');
    assert.equal(r.escalation.blocker, 'preflight-declined');
    assert.equal(r.decisionReady, true, 'the come-back must be actionable');
    assert.equal(isDecisionReady(r.escalation).ok, true);
    assert.deepEqual(types(h), ['run.start', 'preflight', 'run.escalate', 'run.end']); // never compiled/worked
  } finally { h.cleanup(); }
});

test('clarify is also a HITL-open ⇒ decision-ready escalation', async () => {
  const h = harness();
  try {
    const r = await runRequest({ ...base(h),
      deps: { preflight: async () => ({ verdict: 'clarify', reason: 'which rounding?', questions: ['round?'] }) } });
    assert.equal(r.escalation.blocker, 'preflight-declined');
    assert.equal(r.decisionReady, true);
  } finally { h.cleanup(); }
});

test('untrustworthy compiled close ⇒ decision-ready close-untrustworthy escalation', async () => {
  const h = harness();
  try {
    const r = await runRequest({ ...base(h),
      deps: {
        preflight: async () => ({ verdict: 'proceed', reason: '', questions: [] }),
        compileClose: async () => ({ ok: false, verdict: 'over-constrained', suiteBytes: 300, validity: { stubCatch: true, referencePasses: false, mutantsKilled: 5 } }),
      } });
    assert.equal(r.escalation.blocker, 'close-untrustworthy');
    assert.equal(r.decisionReady, true, 'attempt-bearing: whatWasTried must carry a verdict+gap');
    assert.equal(isDecisionReady(r.escalation).ok, true);
    assert.deepEqual(types(h), ['run.start', 'preflight', 'close.compiled', 'run.escalate', 'run.end']);
  } finally { h.cleanup(); }
});

test('worker cannot close the grounded test (red) ⇒ decision-ready close-exhausted escalation', async () => {
  const h = harness();
  try {
    const r = await runRequest({ ...base(h),
      deps: {
        preflight: async () => ({ verdict: 'proceed', reason: '', questions: [] }),
        compileClose: async () => okCompile,
        implement: async () => ({ delivered: false, outcome: 'escalated-red', incomplete: false, verdict: null, iterations: 3, finalClose: { pass: false, status: 'needs_revision', output: 'double(3) expected 6' } }),
      } });
    assert.equal(r.escalation.blocker, 'close-exhausted');
    assert.equal(r.decisionReady, true);
    assert.equal(isDecisionReady(r.escalation).ok, true);
  } finally { h.cleanup(); }
});

test('incomplete (cap tripped) ⇒ budget-cap escalation', async () => {
  const h = harness();
  try {
    const r = await runRequest({ ...base(h),
      deps: {
        preflight: async () => ({ verdict: 'proceed', reason: '', questions: [] }),
        compileClose: async () => okCompile,
        implement: async () => ({ delivered: false, outcome: 'escalated-incomplete', incomplete: true, verdict: null, iterations: 1, finalClose: { pass: false, status: 'needs_revision', output: 'still red' } }),
      } });
    assert.equal(r.escalation.blocker, 'budget-cap');
    assert.equal(r.decisionReady, true);
  } finally { h.cleanup(); }
});

test('D5 TRIPWIRE: own-green but GOLD-red ⇒ NEVER deliver, gold-mismatch escalation', async () => {
  const h = harness();
  try {
    // The fake worker "delivers" a WRONG impl that would pass a weak own-suite but fails the independent GOLD.
    const r = await runRequest({ ...base(h), goldSuite: GOLD,
      deps: {
        preflight: async () => ({ verdict: 'proceed', reason: '', questions: [] }),
        compileClose: async () => okCompile,
        implement: async () => { writeFileSync(h.target, 'export const double = (n) => n + n + 1;\n'); // wrong
          return { delivered: true, outcome: 'delivered', incomplete: false, verdict: null, iterations: 2, finalClose: { pass: true, status: 'satisfied', output: '' } }; },
      } });
    assert.equal(r.delivered, false, 'own-green must not be enough — GOLD is the arbiter');
    assert.equal(r.escalation.blocker, 'gold-mismatch');
    assert.equal(r.decisionReady, true);
    assert.ok(types(h).includes('gold.checked'));
    assert.ok(!types(h).includes('run.deliver'));
  } finally { h.cleanup(); }
});

test('happy path: own-green AND GOLD-green ⇒ DELIVER, split reported, renders a timeline', async () => {
  const h = harness();
  try {
    const r = await runRequest({ ...base(h), goldSuite: GOLD,
      deps: {
        preflight: async () => ({ verdict: 'proceed', reason: '', questions: [] }),
        compileClose: async () => okCompile,
        implement: async () => { writeFileSync(h.target, 'export const double = (n) => n * 2;\n'); // correct
          return { delivered: true, outcome: 'delivered', incomplete: false, verdict: null, iterations: 1, finalClose: { pass: true, status: 'satisfied', output: '' } }; },
      } });
    assert.equal(r.delivered, true);
    assert.equal(r.outcome, 'delivered');
    assert.equal(r.gold.pass, true);
    assert.equal(r.split.groundedOfTotal, '1/1');
    const seq = types(h);
    assert.deepEqual(seq, ['run.start', 'preflight', 'close.compiled', 'receipts', 'worker.done', 'gold.checked', 'run.deliver', 'run.end']);
    // the observer renders the run purely from what it emitted
    const out = renderRun(readEventLog(join(h.dir, 'run.jsonl')));
    assert.match(out, /✅ DELIVER/);
    assert.match(out, /④ GOLD arbiter → GREEN/);
  } finally { h.cleanup(); }
});
