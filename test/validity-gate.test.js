// validity-gate.test.js — the G1 honesty guards, each with a control that FAILS on a dishonest suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSuite, countGrounded, arbitrate } from '../src/validity-gate.mjs';

// A synthetic suite-runner: model a suite by the SET of impls it fails. `fails` = impls the suite catches.
// pass(impl) = !fails.has(impl). This lets us construct honest and dishonest suites without spawning.
const suiteThatFails = (...fails) => {
  const set = new Set(fails);
  return (impl) => ({ pass: !set.has(impl) });
};
const REF = 'reference', STUB = 'stub';
const MUT = ['m-noop', 'm-offbyone', 'm-padwidth', 'm-sign', 'm-truncate']; // 1 no-op + 4 subtle (the k=5 canon)

test('an HONEST suite passes: fails stub + all mutants, passes reference', () => {
  const run = suiteThatFails(STUB, ...MUT);            // catches everything wrong, lets the reference through
  const r = validateSuite({ runSuiteAgainst: run, referenceImpl: REF, stubImpl: STUB, mutants: MUT });
  assert.equal(r.passes, true);
  assert.equal(r.stubCatch, true);
  assert.equal(r.referencePasses, true);
  assert.equal(r.mutantsKilled, 5);
  assert.equal(r.reasons.length, 0);
});

test('CONTROL — a suite GREEN on the stub is rejected (grounds nothing)', () => {
  const run = suiteThatFails(...MUT);                  // does NOT fail the stub
  const r = validateSuite({ runSuiteAgainst: run, referenceImpl: REF, stubImpl: STUB, mutants: MUT });
  assert.equal(r.passes, false);
  assert.equal(r.stubCatch, false);
  assert.match(r.reasons.join(' '), /green against a no-op stub/);
});

test('CONTROL — an OVER-CONSTRAINED suite (fails the reference too) is rejected (the SAFE G1 mode)', () => {
  const run = suiteThatFails(STUB, REF, ...MUT);       // catches wrong code but ALSO rejects a correct impl
  const r = validateSuite({ runSuiteAgainst: run, referenceImpl: REF, stubImpl: STUB, mutants: MUT });
  assert.equal(r.passes, false);
  assert.equal(r.referencePasses, false);
  assert.match(r.reasons.join(' '), /known-correct impl does NOT pass/);
});

test('CONTROL — a WEAK suite that kills only 3/5 mutants is rejected (subtle mutants are the teeth)', () => {
  const run = suiteThatFails(STUB, MUT[0], MUT[1], MUT[2]); // misses two subtle mutants
  const r = validateSuite({ runSuiteAgainst: run, referenceImpl: REF, stubImpl: STUB, mutants: MUT });
  assert.equal(r.passes, false);
  assert.equal(r.mutantsKilled, 3);
  assert.match(r.reasons.join(' '), /killed only 3\/5/);
});

test('countGrounded splits predicate/agentic (grounded) from rubric/none (the HITL residue)', () => {
  const map = [
    { criterion: 'rounds half-up', eval: 'predicate' },
    { criterion: 'renders correctly', eval: 'agentic' },
    { criterion: 'feels premium', eval: 'rubric' },
    { criterion: 'unspecified', eval: 'none' },
  ];
  const r = countGrounded(map);
  assert.equal(r.N, 2);
  assert.equal(r.M, 4);
  assert.deepEqual(r.residue, ['feels premium', 'unspecified']);
});

test('arbitrate (D5): own-green + GOLD-green → deliver', () => {
  const r = arbitrate({ ownClose: { pass: true }, gold: { pass: true } });
  assert.equal(r.deliver, true);
  assert.equal(r.fitToPass, false);
});

test('arbitrate (D5) CONTROL: own-green + GOLD-RED → FIT-TO-PASS, never delivered', () => {
  const r = arbitrate({ ownClose: { pass: true }, gold: { pass: false } });
  assert.equal(r.deliver, false);
  assert.equal(r.fitToPass, true);
  assert.equal(r.escalate, true);
});

test('arbitrate: own close not green → do not deliver (refine/escalate), not flagged fit-to-pass', () => {
  const r = arbitrate({ ownClose: { pass: false }, gold: { pass: false } });
  assert.equal(r.deliver, false);
  assert.equal(r.fitToPass, false);
  assert.equal(r.escalate, true);
});
