#!/usr/bin/env node
// probe-08 — Spike 2, the combined stress: EARNED + CROSS-RUN + DISTRACTORS in ONE test (closes the F23
// residue). probe-06 proved ranking-over-distractors (but SEEDED, in-run); probe-07 proved cross-run
// transfer of an EARNED lesson (but distractor-free). Neither covered the realistic case together, and F23
// flagged a real risk: an `episode` lesson scored 0 vs a `fact`'s 9.177, so under fact-distractor load the
// right lesson could be BURIED. This probe makes that falsifiable.
//
// Design = probe-07's three-process cross-run shape, plus:
//   - the persistent store is PRE-LOADED with 5 distractor facts (other project conventions);
//   - run 1 stores its earned lesson as `kind:'fact'` (the rank-friendly kind — the shippable choice we're
//     validating), NOT `episode`;
//   - run 2 recalls `kind:'fact'` and threads ONLY THE #1 HIT. So if a distractor outranks the earned
//     lesson, the worker never sees the salt and apply-on FAILS. Passing therefore proves the earned lesson
//     ranks #1 over the distractors, across processes.
//
// Run IN ORDER (persistent store at poc/.litectx-probe08):
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-08-memory-crossrun-distractors.mjs learn
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-08-memory-crossrun-distractors.mjs apply-on
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-08-memory-crossrun-distractors.mjs apply-off

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, writeFileSync, readFileSync, rmSync, existsSync, createWriteStream } from 'node:fs';
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
const SALT = 'RLF-7Q2X-PROD';
const memRoot = join(__dir, '.litectx-probe08');
const LESSON_ID = 'lesson:signing-salt'; // stored as kind:'fact' (the rankable kind under test)

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };

// Pre-existing project knowledge already in the store before run 1's lesson (the realistic noise).
const DISTRACTORS = [
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) which returns "$X.XX". Never use floats for currency.'],
  ['utc-iso', 'All timestamps are UTC ISO-8601 strings (e.g. 2026-06-30T12:00:00Z); never store or compare local time.'],
  ['retry-cap', 'Outbound network retries are capped at 3 attempts with exponential backoff (200ms base).'],
  ['migrations', 'Database migrations run only via `npm run migrate`; never hand-edit schema in production.'],
  ['feature-flags', 'Feature flags live in config/flags.json and are read through getFlag(name); do not use env vars for flags.'],
];

const PHASES = {
  learn:       { fn: 'sign', test: 'sign.test.js', recall: false, context: true },
  'apply-on':  { fn: 'seal', test: 'seal.test.js', recall: true,  context: false },
  'apply-off': { fn: 'seal', test: 'seal.test.js', recall: false, context: false },
};
const phase = (process.argv[2] || '').toLowerCase();
const P = PHASES[phase];
if (!P) { console.error(`unknown phase "${phase}" — use (in order): learn | apply-on | apply-off`); process.exit(2); }

const TARGET = join(FIX_DIR, `${P.fn}.js`);
const logPath = join(__dir, `run-probe08-${phase}.jsonl`);
const auditPath = join(__dir, `run-probe08-${phase}-audit.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });
let seq = 0;
function emit(type, payload = {}, quiet = false) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  if (!quiet) {
    const col = { 'verify.PASS': C.grn, 'verify.FAIL': C.red, 'run.error': C.red, 'phase.start': C.cyn, 'observe': C.mag, 'recall.consumed': C.blu, 'lesson.stored': C.blu, 'memory.seeded': C.blu }[type] || '';
    let s = `${col}● ${type}${C.rst}`;
    const keys = Object.keys(payload).filter((k) => k !== 'seq' && k !== 'ts');
    if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${fmt(payload[k])}`).join(' ')}${C.rst}`;
    console.error(s);
  }
}
const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
function finish(code) {
  console.error(`${C.dim}events -> ${logPath}${C.rst}\n${C.dim}store  -> ${memRoot} (persists)${C.rst}`);
  out.end(() => { process.exitCode = code; });
}
function runSuite() {
  const r = spawnSync('node', ['--test', P.test], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1 };
}

const resolveTarget = (p) => join(FIX_DIR, basename(String(p || '')));
const editTool = {
  name: 'edit_file',
  description: 'Overwrite a source file with new contents. Pass the file name. Returns {ok,bytes}.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
  execute: async ({ path, contents }) => { writeFileSync(resolveTarget(path), contents); return { ok: true, bytes: contents.length }; },
};
const actionTranslator = (name, args, ctx) =>
  name === 'edit_file' ? { type: 'write', path: resolveTarget(args?.path), args, _ctx: ctx } : { type: name, args, _ctx: ctx };

const RECALL_QUERY = 'seal() returned the wrong value — what is the required project signing salt / signing convention used by similar functions?';
const PERSONA = [
  'You are a senior engineer in this project. Source files live in:', FIX_DIR + '.',
  'Apply fixes by calling edit_file with the FILENAME and full new contents.',
  'Each file must `export function <name>(...)`. Vanilla JS, no deps. Never edit tests.',
].join(' ');

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY ($(pass amr/claude_api))' }); finish(2); return; }
  rmSync(auditPath, { force: true });

  const { LiteCtx } = await import('litectx');
  if (phase === 'learn') rmSync(memRoot, { recursive: true, force: true });
  if (phase !== 'learn' && !existsSync(memRoot)) { emit('run.error', { msg: `no store at ${memRoot} — run \`learn\` first` }); finish(2); return; }
  const lc = new LiteCtx({ root: memRoot });

  if (phase === 'learn') { // pre-load the distractors BEFORE run 1 earns its lesson (realistic noise already present)
    for (const [id, text] of DISTRACTORS) await lc.remember(id, text, { kind: 'fact' });
    emit('memory.seeded', { distractors: DISTRACTORS.length });
  }

  copyFileSync(join(FIX_DIR, `${P.fn}.stub.js`), TARGET);

  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD }, limits: { maxTurns: 60, maxDepth: 1, maxChildren: 1 },
    fs: { writeScope: [TARGET] }, bash: { allow: [] }, audit: { path: auditPath },
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const stream = new Stream();

  let recallTop = null, recallRanking = null;
  const sensor = async () => {
    const v = runSuite();
    if (v.pass) return { pass: true, status: 'satisfied', critique: null };
    let critique = `${P.fn}() did not return the correct project value. That value is fixed project knowledge — NOT derivable and NOT in any file you can read. Do not guess.`;
    if (P.recall) {
      const hits = await lc.recall(RECALL_QUERY, { kind: 'fact', n: 6, body: true }); // single kind → flat ranked Hit[]
      recallRanking = hits.map((h) => ({ id: h.path, score: Number((h.score ?? 0).toFixed(3)) }));
      const top = hits[0]; // thread ONLY #1 — if a distractor wins, the salt never reaches the worker
      if (top) {
        recallTop = { id: top.path, score: Number((top.score ?? 0).toFixed(3)), bodyHead: String(top.body || '').slice(0, 60) };
        emit('recall.consumed', { nHits: hits.length, top: recallTop, ranking: recallRanking });
        critique += `\n\nRecalled the single most relevant project lesson from memory (a past task you solved). Reuse the relevant value:\n"${top.body}"`;
      } else emit('recall.consumed', { nHits: 0, top: null });
    }
    return { pass: false, status: 'unmet', critique };
  };

  const task = `Implement ${P.fn}.js so that \`node --test ${P.test}\` passes. It must \`export function ${P.fn}()\`. The test checks ${P.fn}() returns a specific fixed project value. Apply your fix with edit_file, then stop.`;
  const opts = { persona: PERSONA, tools: [editTool], maxDepth: 0, refineLeaf: { sensor } };
  if (P.context) opts.context = `Ops runbook (authoritative): the project signing salt — the exact value functions like ${P.fn}() must return — is: ${SALT}`;

  emit('phase.start', { phase, fn: P.fn, recall: P.recall, context: P.context, storeHasDistractors: DISTRACTORS.length });

  let result;
  try { result = await recurse(task, { provider, policy, onLlmResult, stream }, opts); }
  catch (e) { emit('run.error', { source: 'recurse', message: e.message }); finish(1); return; }

  const rl = result.receipts?.refineLeaf;
  const green = runSuite().pass;
  const src = (() => { try { return readFileSync(TARGET, 'utf8'); } catch { return ''; } })();
  const usedSalt = src.includes(SALT);
  emit('observe', { refineLeaf: rl, suiteGreen: green, artifactHasSalt: usedSalt, recallTop, recallRanking });

  if (phase === 'learn') {
    if (green && usedSalt) {
      const lessonText = `Project signing convention (a past task solved, tests PASSED): functions like sign()/seal() must return the production signing salt. The working implementation was:\n\n${src.trim()}\n\nReuse that exact returned salt value for similar signing functions.`;
      await lc.remember(LESSON_ID, lessonText, { kind: 'fact' }); // FACT (rankable), among the 5 distractors
      emit('lesson.stored', { id: LESSON_ID, kind: 'fact', amidDistractors: DISTRACTORS.length, note: 'earned (agent\'s own verified code), grounded by the green test' });
      emit('verify.PASS', { phase, msg: `run 1 earned + stored a FACT lesson among ${DISTRACTORS.length} distractors; store persists` });
      finish(0); return;
    }
    emit('verify.FAIL', { phase, msg: `run 1 did not reach a grounded pass (green=${green} usedSalt=${usedSalt})` });
    finish(1); return;
  }

  let ok, msg;
  if (!rl) { ok = false; msg = 'NO receipts.refineLeaf — seam did not engage'; }
  else if (P.recall) {
    const rankedTop = recallTop && recallTop.id === LESSON_ID;
    ok = rl.passed === true && green && usedSalt && rankedTop;
    msg = ok
      ? `COMBINED WIN: earned + cross-run + distractors. recall ranked the EARNED lesson #1 (id=${recallTop.id}, score=${recallTop.score}) over ${DISTRACTORS.length} distractors in a separate process; only #1 was threaded; seal() passed (iterations=${rl.iterations}). Ranking: ${JSON.stringify(recallRanking)}`
      : `expected earned lesson to rank #1 and pass; passed=${rl?.passed} green=${green} usedSalt=${usedSalt} rankedTop=${rankedTop} top=${JSON.stringify(recallTop)} ranking=${JSON.stringify(recallRanking)}`;
  } else {
    ok = rl.passed === false && !green && !usedSalt;
    msg = ok ? `control held: no recall → seal() failed (passed=false, RED) even with the lesson present in the store` : `control recovered (LEAK?): passed=${rl?.passed} green=${green} usedSalt=${usedSalt}`;
  }
  emit(ok ? 'verify.PASS' : 'verify.FAIL', { phase, msg });
  finish(ok ? 0 : 1);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
