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
import { validateSuite } from '../src/validity-gate.mjs';
import { task1 } from './fixtures/d7/filenamify/task.mjs';

/** A runSuiteAgainst that writes the task's GOLD suite to a temp workdir and swaps each impl at implName. */
function goldRunnerFor(task) {
  const dir = mkdtempSync(join(tmpdir(), 'd7-oracle-'));
  writeFileSync(join(dir, task.goldSuite.name), task.goldSuite.source);
  const implName = task.implName ?? 'impl.mjs';
  return {
    dir,
    runSuiteAgainst(code) {
      writeFileSync(join(dir, implName), code);
      return runClose(['node', '--test', task.goldSuite.name], { cwd: dir });
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
