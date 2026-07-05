// d7-cohort.live.test.js — D7: the ≥3-real-task benches cohort, run through the ASSEMBLED pipe for real
// (PRD-v3 §6 step 5 / G5-EXIT). Each arm = one `runRequest`: prose IN → pre-flight → the worker self-authors
// a grounded close → relayfact's validity-gate trusts it → a gated worker implements red→green → the
// INDEPENDENT GOLD arbiter (D5) → deliver-green OR a decision-ready escalation. Every step lands in the event
// log the observer renders. The oracle/GOLD are relayfact-held truth the worker NEVER sees; the token-free
// pre-check (test/d7-cohort.test.js) already proved each oracle well-built, so a mis-built oracle can't cause
// a false result here.
//
// Cohort (sign-off 2026-07-05): a real-repo bug (filenamify #46, post-cutoff) + semver §11 + a /echo AGENTIC
// service (deploy+probe, one rubric residue). Models: haiku on all three (control tier) + sonnet on the
// subtlest (semver) for the model-modulation datapoint. Token-spending ⇒ SELF-SKIPS unless RELAYFACT_LIVE=1
// AND a key is present.
// Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_LIVE=1 node --test test/integration/d7-cohort.live.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Gate } from 'bareguard';
import { createEventLog } from '../../src/event-log.mjs';
import { readEventLog, renderRun } from '../../src/observer.mjs';
import { runClose } from '../../src/close.mjs';
import { runRequest } from '../../src/pipeline.mjs';
import { authorSuiteViaRecurse, makeProvider, AUTHOR_PERSONA, AUTHOR_PERSONA_AGENTIC } from '../../src/author.mjs';
import { task1 } from '../fixtures/d7/filenamify/task.mjs';
import { task2 } from '../fixtures/d7/semver/task.mjs';
import { task3 } from '../fixtures/d7/echo/task.mjs';

const LIVE = process.env.RELAYFACT_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const skip = LIVE ? false : 'set RELAYFACT_LIVE=1 and ANTHROPIC_API_KEY';
const MODELS = { haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-5' };
const MAX_COST = Number(process.env.RELAYFACT_MAX_COST_USD ?? 1.0);

// Per-tier close shape: predicate = `node --test <suite>` over source; agentic = `node <harness>` (deploy+probe).
function tierConfig(task) {
  if (task.tier === 'agentic') {
    return { suiteName: 'suite.mjs', closeCmd: (n) => ['node', n], persona: AUTHOR_PERSONA_AGENTIC, noun: 'exercise harness' };
  }
  return { suiteName: 'suite.test.mjs', closeCmd: (n) => ['node', '--test', n], persona: AUTHOR_PERSONA, noun: 'test suite' };
}

async function spentOf(gate) {
  try { return (await gate?.haltContext?.())?.spent?.costUsd ?? 0; } catch { return 0; }
}

/** Run one cohort arm (a task × a model) through the real pipe; return the result + a compact record. */
async function runArm(task, modelKey) {
  const dir = mkdtempSync(join(tmpdir(), `d7-${task.id}-${modelKey}-`));
  const cfg = tierConfig(task);
  const suitePath = join(dir, cfg.suiteName);
  const implPath = join(dir, task.implName);
  const log = createEventLog(join(dir, 'run.jsonl'));
  const provider = makeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODELS[modelKey] });

  // Gate #1 — the AUTHOR writes ONLY the close (suite/harness), never the impl.
  const authorGate = new Gate({
    budget: { maxCostUsd: MAX_COST }, limits: { maxTurns: 24, maxDepth: 0, maxChildren: 1 },
    fs: { writeScope: [suitePath], readScope: [] }, bash: { allow: [] },
    audit: { path: join(dir, 'audit-author.jsonl') }, humanChannel: async () => ({ decision: 'deny' }),
  });
  await authorGate.init();

  // relayfact's deterministic leaf close for the AUTHOR loop: the close must EXIST and a correct impl (the
  // held-back reference) must PASS it (the in-loop over-constraint guard — NOT a model judge, R-S8).
  const sensor = async () => {
    if (!existsSync(suitePath)) return { status: 'needs_revision', pass: false, score: null, critique: `No close yet — write ${cfg.suiteName}.`, suggestions: [] };
    writeFileSync(implPath, task.oracle.reference);
    const v = runClose(cfg.closeCmd(cfg.suiteName), { cwd: dir });
    return v.pass
      ? { status: 'satisfied', pass: true, score: null, critique: '', suggestions: [] }
      : { status: 'needs_revision', pass: false, score: null, critique: `A correct implementation must pass your close but it did NOT — you may be over-constraining. Output:\n${(v.output || '').slice(0, 1200)}`, suggestions: [] };
  };
  const authorSuite = () => authorSuiteViaRecurse({ prose: task.request, target: suitePath, provider, gate: authorGate, sensor, persona: cfg.persona, artifactNoun: cfg.noun });

  // Gate #2 — the WORKER writes ONLY the impl; the close is NOT writable (cannot be gamed green).
  const workerGate = new Gate({
    budget: { maxCostUsd: MAX_COST }, limits: { maxTurns: 24, maxDepth: 0, maxChildren: 1 },
    fs: { writeScope: [implPath], readScope: [] }, bash: { allow: [] },
    audit: { path: join(dir, 'audit-worker.jsonl') }, humanChannel: async () => ({ decision: 'deny' }),
  });
  await workerGate.init();

  const r = await runRequest({
    request: task.request, workdir: dir, target: implPath, oracle: task.oracle, goldSuite: task.goldSuite,
    authorSuite, provider, gate: workerGate, log, tier: task.tier, criteriaMap: task.criteriaMap,
    suiteName: cfg.suiteName, implName: task.implName,
  });

  const events = readEventLog(join(dir, 'run.jsonl'));
  const cost = (await spentOf(authorGate)) + (await spentOf(workerGate));
  const compiled = events.find((e) => e.type === 'close.compiled');
  const record = {
    task: task.id, model: modelKey, outcome: r.outcome, delivered: r.delivered,
    goldPass: r.gold?.pass ?? null, split: r.split?.groundedOfTotal ?? null,
    closeVerdict: compiled?.verdict ?? null, iterations: r.worker?.iterations ?? null,
    blocker: r.escalation?.blocker ?? null, decisionReady: r.decisionReady ?? null, costUsd: Number(cost.toFixed(4)),
  };
  console.error('\n' + renderRun(events));
  console.error(`[d7] ${JSON.stringify(record)}`);
  rmSync(dir, { recursive: true, force: true });
  return r;
}

/**
 * A cohort arm PASSES iff it reaches a TRUTHFUL terminal state:
 *   delivered ⇒ the independent GOLD is GREEN (no fit-to-pass), OR
 *   not delivered ⇒ a DECISION-READY escalation (a genuine, actionable stop).
 * The hard tripwire: a delivered artifact whose GOLD is RED is NEVER allowed.
 */
function assertTruthfulTerminal(r) {
  assert.equal(!(r.delivered && r.gold && r.gold.pass === false), true, 'HARD FAIL: delivered an artifact whose independent GOLD is RED (fit-to-pass)');
  if (r.delivered) assert.equal(r.gold?.pass, true, 'delivered ⇒ GOLD must be green');
  else assert.equal(r.decisionReady, true, 'not delivered ⇒ the escalation must be decision-ready');
}

test('D7 arm — filenamify reserved-name-with-extension (real-repo bug) · haiku', { skip }, async () => {
  assertTruthfulTerminal(await runArm(task1, 'haiku'));
});
test('D7 arm — semver §11 precedence · haiku', { skip }, async () => {
  assertTruthfulTerminal(await runArm(task2, 'haiku'));
});
test('D7 arm — semver §11 precedence · sonnet (model-modulation datapoint)', { skip }, async () => {
  assertTruthfulTerminal(await runArm(task2, 'sonnet'));
});
test('D7 arm — /echo service (AGENTIC tier, deploy+probe, one rubric residue) · haiku', { skip }, async () => {
  assertTruthfulTerminal(await runArm(task3, 'haiku'));
});
