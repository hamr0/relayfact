// d7-cohort.test.js — the TOKEN-FREE oracle pre-check for the D7 benches cohort (PRD-v3 §6 step 5, descope
// D7). It spends NO tokens and needs NO network: it validates, offline, that each cohort task's oracle
// (reference / stub / mutants) and its independent GOLD are well-BUILT before any live budget is spent — so a
// mis-built oracle is caught for free. It exercises SHIPPED code (src/validity-gate.mjs::validateSuite over
// src/close.mjs::runClose), i.e. the exact validity path the live pipe uses (benches "replay-through-shipped-code").
//
// The claim proven per task: the maintainer's independent GOLD, used as the grounded close, is TRUSTED —
// it PASSES the held-back reference, CATCHES the no-op stub, and KILLS every subtle mutant. This can fail
// honestly: a GOLD that is vacuously always-green fails stubCatch; an always-red one fails referencePasses;
// a mutant the GOLD cannot tell apart from the reference shows up in `survivors`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runClose } from '../src/close.mjs';
import { validateSuite, countGrounded } from '../src/validity-gate.mjs';
import { task1 } from './fixtures/d7/filenamify/task.mjs';
import { task2 } from './fixtures/d7/semver/task.mjs';
import { task3 } from './fixtures/d7/echo/task.mjs';

/**
 * A runSuiteAgainst that writes the task's GOLD to a temp workdir and swaps each impl at implName. The GOLD's
 * `command` is tier-agnostic: `['node','--test','gold.test.mjs']` for a predicate task, `['node',
 * 'gold.exercise.mjs']` for an agentic one (deploy + probe). Exit code = truth, via the same shipped runClose.
 */
function goldRunnerFor(task) {
  const dir = mkdtempSync(join(tmpdir(), 'd7-oracle-'));
  writeFileSync(join(dir, task.goldSuite.name), task.goldSuite.source);
  const implName = task.implName ?? 'impl.mjs';
  const command = task.goldSuite.command ?? ['node', '--test', task.goldSuite.name];
  return {
    dir,
    runSuiteAgainst(code) {
      writeFileSync(join(dir, implName), code);
      return runClose(command, { cwd: dir });
    },
    cleanup() { rmSync(dir, { recursive: true, force: true }); },
  };
}

/** Assert a task's oracle+GOLD are well-built. Shared across every cohort task (predicate & agentic tiers). */
function assertOracleWellBuilt(task) {
  const r = goldRunnerFor(task);
  try {
    const v = validateSuite({
      runSuiteAgainst: r.runSuiteAgainst,
      referenceImpl: task.oracle.reference,
      stubImpl: task.oracle.stub,
      mutants: task.oracle.mutants.map((m) => m.code),
      minKill: task.oracle.mutants.length, // GOLD must kill ALL of them — a surviving mutant = mis-built oracle
    });

    assert.equal(v.referencePasses, true, `[${task.id}] the held-back reference must PASS its GOLD`);
    assert.equal(v.stubCatch, true, `[${task.id}] the no-op stub must FAIL its GOLD (else GOLD grounds nothing)`);

    // Name any mutant the GOLD could not distinguish from the reference — the exact "mis-built oracle" signal.
    const survivors = task.oracle.mutants.filter((m) => r.runSuiteAgainst(m.code).pass).map((m) => m.name);
    assert.deepEqual(survivors, [], `[${task.id}] mutants that SURVIVED GOLD (should be none): ${survivors.join(', ') || '—'}`);

    assert.equal(v.passes, true, `[${task.id}] GOLD is not a trusted grounded close: ${v.reasons.join('; ')}`);
  } finally {
    r.cleanup();
  }
}

test('D7 Task 1 — filenamify reserved-name-with-extension (real-repo bug): oracle + GOLD are well-built', () => {
  assertOracleWellBuilt(task1);
});

test('D7 Task 2 — semver §11 precedence compare: oracle + GOLD are well-built', () => {
  assertOracleWellBuilt(task2);
});

test('D7 Task 3 — /echo service (AGENTIC tier: deploy + probe): oracle + GOLD are well-built', () => {
  assertOracleWellBuilt(task3);
});

// The grounded/rubric split is a REPORTED cohort number (G5-EXIT). Prove it is computed correctly OFFLINE via
// the shipped countGrounded() before the live run leans on it — the predicate tasks are fully grounded (N/N),
// and the agentic task carries exactly one un-grounded rubric residue (5 grounded / 6 total, per the plan).
test('D7 grounded/rubric split per task is correct (via shipped countGrounded)', () => {
  const s1 = countGrounded(task1.criteriaMap);
  assert.deepEqual([s1.N, s1.M], [1, 1], 'Task 1 is fully grounded (1/1)');
  const s2 = countGrounded(task2.criteriaMap);
  assert.deepEqual([s2.N, s2.M], [1, 1], 'Task 2 is fully grounded (1/1)');
  const s3 = countGrounded(task3.criteriaMap);
  assert.deepEqual([s3.N, s3.M], [5, 6], 'Task 3 is 5 grounded of 6 (one rubric residue)');
  assert.deepEqual(s3.residue, ['the 400 error message is developer-friendly']);
});
