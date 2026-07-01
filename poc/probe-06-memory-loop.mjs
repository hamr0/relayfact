#!/usr/bin/env node
// probe-06 — Spike 2: memory-as-self-improvement (error-keyed recall flips fail→pass at the leaf).
// PRD §8.1 spike 2 (reframed 2026-06-30). The riskiest assumption of the whole memory loop, tested first:
//
//   Does an error-keyed litectx `recall`, threaded into a leaf on failure, flip a FAIL to a PASS on a task
//   the model genuinely CANNOT do blind — and does it earn it by RANKING the right lesson over distractors
//   (litectx's real job, proven in probe-02), not a trivial key lookup?
//
// The seam under test is the now-verified BA-8 `refineLeaf` (probe-05/F21): a definite leaf runs as a
// bounded sense→regenerate loop. relayfact owns the deterministic `sensor` (its executable close); on a
// failed attempt the GAP is fed forward (built-in) and — ON arm only — relayfact enriches that GAP with an
// error-keyed `recall` from litectx. bareagent stays litectx-agnostic: the recall handle is relayfact's.
//
// WHY IT'S AIRTIGHT (prove-don't-assert; the control MUST be able to fail):
//   - The required value `RLF-7Q2X-PROD` is ARBITRARY project knowledge — not derivable, not in any file
//     the worker can read. The worker's ONLY tool is `edit_file` (no read tool — as in probe-04), so it
//     cannot read sign.test.js to cheat. The value lives in exactly two places: the unreadable test, and
//     the litectx store.
//   - The sensor reports fail WITHOUT leaking the expected value (a real test failure hands you "wrong",
//     not the domain secret), so the OFF arm cannot rediscover it from the gap either.
//   ⇒  recall-off : the value is reachable NOWHERE the worker can see → EXPECT passed=false (honest
//                   non-recovery). If this arm passes, the task was guessable / the test is rigged.
//   ⇒  recall-on  : on failure relayfact recalls keyed by the error; litectx must RANK the signing lesson
//                   over 5 distractor facts; the lesson is threaded into the retry → EXPECT passed=true,
//                   iterations>1, and the recalled top hit IS the signing fact (logged with its score).
//
// HONEST SCOPE (benches-prd doctrine — don't overclaim): this probe SEEDS the lesson (simulating a prior
// run's stored memory) to isolate RETRIEVAL value in a single run. It proves the mechanism — recall+gap
// flips the outcome. The fuller "earned across two runs" test (run 1 fails→distills→remembers; run 2, a
// FRESH window, recalls) is the documented follow-up; this is the riskiest-assumption POC that gates it.
//
// Run (key never in tree):
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-06-memory-loop.mjs recall-on
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-06-memory-loop.mjs recall-off

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, writeFileSync, readFileSync, rmSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const require = createRequire(import.meta.url);
const { recurse, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 1.0);
const FIX_DIR = resolve(join(__dir, 'fixtures', 'recall'));
const TARGET = join(FIX_DIR, 'sign.js');
const TEST = 'sign.test.js';
const SALT = 'RLF-7Q2X-PROD'; // the arbitrary value — only used by the SEED + the assertions, NEVER shown to the worker.

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };

const MODES = { 'recall-on': { recall: true }, 'recall-off': { recall: false } };
const mode = (process.argv[2] || '').toLowerCase();
if (!MODES[mode]) { console.error(`unknown mode "${mode}" — use: ${Object.keys(MODES).join(' | ')}`); process.exit(2); }
const RECALL_ON = MODES[mode].recall;

const logPath = join(__dir, `run-probe06-${mode}.jsonl`);
const auditPath = join(__dir, `run-probe06-${mode}-audit.jsonl`);
const memRoot = join(__dir, `.litectx-probe06-${mode}`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });
let seq = 0;
function emit(type, payload = {}, quiet = false) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  if (!quiet) {
    const col = { 'verify.PASS': C.grn, 'verify.FAIL': C.red, 'run.error': C.red, 'arm.start': C.cyn, 'observe': C.mag, 'recall.consumed': C.blu, 'memory.seeded': C.blu }[type] || '';
    let s = `${col}● ${type}${C.rst}`;
    const keys = Object.keys(payload).filter((k) => k !== 'seq' && k !== 'ts');
    if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${fmt(payload[k])}`).join(' ')}${C.rst}`;
    console.error(s);
  }
}
const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
function finish(code) {
  console.error(`${C.dim}events -> ${logPath}${C.rst}\n${C.dim}audit  -> ${auditPath}${C.rst}`);
  out.end(() => { process.exitCode = code; });
}

// The GLOBAL deterministic close — run the suite, exit code = truth. relayfact owns it.
function runSuite() {
  const r = spawnSync('node', ['--test', TEST], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1 };
}

// relayfact's gated write tool (the ONLY worker tool — no read tool, so the test can't be read).
const resolveTarget = (p) => join(FIX_DIR, basename(String(p || '')));
const editTool = {
  name: 'edit_file',
  description: 'Overwrite a source file with new contents. Pass the file name (e.g. "sign.js"). Returns {ok,bytes}.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
  execute: async ({ path, contents }) => { writeFileSync(resolveTarget(path), contents); return { ok: true, bytes: contents.length }; },
};
const actionTranslator = (name, args, ctx) =>
  name === 'edit_file' ? { type: 'write', path: resolveTarget(args?.path), args, _ctx: ctx } : { type: name, args, _ctx: ctx };

// The seeded memory: ONE real signing lesson + 5 distractors. recall must RANK the signing one for a
// signing error (litectx's job, proven in probe-02). This simulates a lesson a prior run already stored.
const SIGNING_LESSON = `Project signing convention: the function sign() MUST return the production signing salt EXACTLY: ${SALT}. This salt is fixed project knowledge (defined in the ops runbook); it is never derivable from code and must be reproduced verbatim.`;
const DISTRACTORS = [
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) which returns "$X.XX". Never use floats for currency.'],
  ['utc-iso', 'All timestamps are UTC ISO-8601 strings (e.g. 2026-06-30T12:00:00Z); never store or compare local time.'],
  ['retry-cap', 'Outbound network retries are capped at 3 attempts with exponential backoff (200ms base).'],
  ['migrations', 'Database migrations run only via `npm run migrate`; never hand-edit schema in production.'],
  ['feature-flags', 'Feature flags live in config/flags.json and are read through getFlag(name); do not use env vars for flags.'],
];
// The error-keyed query relayfact issues on a signing failure (key = the failure's domain, NOT the answer).
const RECALL_QUERY = 'sign() returned the wrong value — what is the required signing salt / signing convention for this project?';

async function seedMemory() {
  rmSync(memRoot, { recursive: true, force: true });
  const { LiteCtx } = await import('litectx');
  const lc = new LiteCtx({ root: memRoot });
  for (const [id, text] of DISTRACTORS) await lc.remember(id, text, { kind: 'fact' });
  await lc.remember('signing-salt', SIGNING_LESSON, { kind: 'fact' }); // the relevant one, added among distractors
  emit('memory.seeded', { facts: DISTRACTORS.length + 1, relevant: 1, distractors: DISTRACTORS.length });
  return lc;
}

const PERSONA = [
  'You are a senior engineer working in this project. All source files live in:', FIX_DIR + '.',
  'Apply fixes by calling edit_file with the FILENAME (e.g. "sign.js") and the full new file contents.',
  'Each file must EXPORT its function: `export function <name>(...) { ... }`. Vanilla JS, no deps. Never edit tests.',
].join(' ');
const TASK = `Implement sign.js so that \`node --test ${TEST}\` passes. The file must \`export function sign()\`. `
  + `The test checks that sign() returns a specific fixed project value. Apply your fix with edit_file, then stop.`;

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY ($(pass amr/claude_api))' }); finish(2); return; }
  rmSync(auditPath, { force: true });
  copyFileSync(join(FIX_DIR, 'sign.stub.js'), TARGET); // start red

  const lc = await seedMemory();

  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 60, maxDepth: 1, maxChildren: 1 },
    fs: { writeScope: [TARGET] },     // worker may write ONLY sign.js (never the test); no read scope/tool
    bash: { allow: [] },
    audit: { path: auditPath },
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const stream = new Stream();

  // relayfact's sensor = the executable close, error-keyed recall enrichment on failure (ON arm only).
  let recallTop = null;
  const sensor = async (_result, _sctx) => {
    const v = runSuite();
    emit('observe', { kind: 'sensor', pass: v.pass, exitCode: v.exitCode }, true);
    if (v.pass) return { pass: true, status: 'satisfied', critique: null };
    // FAIL — generic gap, NEVER leak the expected value (it isn't in the worker's reachable world).
    let critique = 'sign() did not return the correct project value. That value is fixed project knowledge — '
      + 'it is NOT derivable and NOT in any file you can read. Do not guess.';
    if (RECALL_ON) {
      const hits = await lc.recall(RECALL_QUERY, { kind: 'fact', body: true, n: 3 });
      const top = hits[0];
      if (top) {
        recallTop = { id: top.path, score: Number((top.score ?? 0).toFixed(3)), bodyHead: String(top.body || '').slice(0, 60) }; // litectx exposes the memory id as hit.path (unified unit pointer)
        emit('recall.consumed', { query: 'signing-error', nHits: hits.length, top: recallTop });
        critique += `\n\nRecalled project lesson from memory (apply it verbatim):\n"${top.body}"`;
      } else {
        emit('recall.consumed', { query: 'signing-error', nHits: 0, top: null });
      }
    }
    return { pass: false, status: 'unmet', critique };
  };

  emit('arm.start', { mode, recall: RECALL_ON, seam: 'BA-8 refineLeaf', note: RECALL_ON ? 'gap enriched with error-keyed recall' : 'gap only (no memory) — control that must fail' });

  let result;
  try {
    result = await recurse(TASK, { provider, policy, onLlmResult, stream }, {
      persona: PERSONA, tools: [editTool], maxDepth: 0, refineLeaf: { sensor }, // default temps [0.2,0.7,1.0]
    });
  } catch (e) { emit('run.error', { source: 'recurse', message: e.message }); finish(1); return; }

  const rl = result.receipts?.refineLeaf;
  const finalGreen = runSuite().pass;                 // independent re-check of the artifact on disk
  const onDisk = (() => { try { return readFileSync(TARGET, 'utf8'); } catch { return ''; } })();
  const usedSalt = onDisk.includes(SALT);
  emit('observe', { refineLeaf: rl, finalSuiteGreen: finalGreen, artifactHasSalt: usedSalt, recallTop });

  let ok, msg;
  if (!rl) { ok = false; msg = 'NO receipts.refineLeaf — the seam did not engage'; }
  else if (RECALL_ON) {
    const rankedRight = recallTop && recallTop.id === 'signing-salt';
    ok = rl.passed === true && finalGreen && usedSalt && rankedRight;
    msg = ok
      ? `recall flipped fail→pass: iterations=${rl.iterations}>1, passed=true, suite GREEN, artifact carries the salt; recall RANKED the signing lesson top (id=${recallTop.id}, score=${recallTop.score}) over ${DISTRACTORS.length} distractors`
      : `expected recall-driven pass; passed=${rl.passed} green=${finalGreen} usedSalt=${usedSalt} rankedRight=${rankedRight} recallTop=${JSON.stringify(recallTop)}`;
  } else {
    ok = rl.passed === false && !finalGreen && !usedSalt;
    msg = ok
      ? `honest non-recovery WITHOUT memory: iterations=${rl.iterations}, passed=false, suite RED, never produced the unguessable salt — the control CAN fail (task isn't guessable, test isn't leaked)`
      : `control unexpectedly recovered (RIG?): passed=${rl.passed} green=${finalGreen} usedSalt=${usedSalt} — the value leaked somewhere`;
  }
  emit(ok ? 'verify.PASS' : 'verify.FAIL', { seam: 'BA-8+litectx', mode, msg });
  rmSync(memRoot, { recursive: true, force: true });
  finish(ok ? 0 : 1);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
