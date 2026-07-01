#!/usr/bin/env node
// probe-07 — Spike 2, the CROSS-RUN earned-lesson A/B (the durable-lift test probe-06 gated).
// PRD §8.1 spike 2 follow-up. Where probe-06 SEEDED the lesson (isolating retrieval in one run), this
// proves the bigger claim: a lesson the agent EARNS in run 1 — and that is stored only because a grounded
// test confirmed it — transfers to a DIFFERENT problem in a SEPARATE run/process, and flips fail→pass.
//
// THREE phases, run as SEPARATE PROCESSES sharing ONE persistent litectx store dir (a real cross-session
// test, per benches-prd: cross-session persistence is the qualified win — not one-process make-believe):
//
//   learn      run 1. Implement sign(). The salt is provided THIS run via BA-9 `opts.context` (a runbook
//              line) — the worker has no read tool, so context is its only source. On the GROUNDED pass
//              (node --test green) relayfact stores the agent's OWN WORKING CODE as a `fact` lesson (not a
//              hand-authored answer — the verified artifact). Store PERSISTS after exit. Wipes the store first.
//   apply-on   run 2, fresh process. Implement seal() (a DIFFERENT function, same salt convention). NO
//              runbook context this run. On failure relayfact recalls keyed off the seal error → gets run 1's
//              lesson → threads it into the retry. EXPECT pass — the salt came only from the recalled lesson.
//   apply-off  run 2 control, fresh process. Same, but NO recall. EXPECT fail — without memory the cross-run
//              knowledge is gone. The control that must be able to fail (proves it's memory, not leakage).
//
// Embeddings are OFF (default) → recall ranks by full-text relevance (BM25), so run 2's seal-failure query
// must share VOCABULARY with run 1's signing lesson (both are signing/salt-themed). Embeddings would let a
// differently-worded future problem match by meaning — the documented upgrade, not needed here.
//
// Run IN ORDER (the store persists between them — do not reorder):
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-07-memory-crossrun.mjs learn
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-07-memory-crossrun.mjs apply-on
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-07-memory-crossrun.mjs apply-off

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
const SALT = 'RLF-7Q2X-PROD'; // only in: the runbook context (learn), the unreadable tests, and the stored lesson.
const memRoot = join(__dir, '.litectx-probe07'); // PERSISTENT across the three invocations (the whole point).
const LESSON_ID = 'episode:signing-salt-solved';

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };

const PHASES = {
  learn:       { fn: 'sign', test: 'sign.test.js', recall: false, context: true },
  'apply-on':  { fn: 'seal', test: 'seal.test.js', recall: true,  context: false },
  'apply-off': { fn: 'seal', test: 'seal.test.js', recall: false, context: false },
};
const phase = (process.argv[2] || '').toLowerCase();
const P = PHASES[phase];
if (!P) { console.error(`unknown phase "${phase}" — use (in order): learn | apply-on | apply-off`); process.exit(2); }

const TARGET = join(FIX_DIR, `${P.fn}.js`);
const logPath = join(__dir, `run-probe07-${phase}.jsonl`);
const auditPath = join(__dir, `run-probe07-${phase}-audit.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });
let seq = 0;
function emit(type, payload = {}, quiet = false) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  if (!quiet) {
    const col = { 'verify.PASS': C.grn, 'verify.FAIL': C.red, 'run.error': C.red, 'phase.start': C.cyn, 'observe': C.mag, 'recall.consumed': C.blu, 'lesson.stored': C.blu }[type] || '';
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

// run-2 error-keyed recall query — built from the seal failure, shares vocab with the signing lesson.
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
  if (phase === 'learn') rmSync(memRoot, { recursive: true, force: true }); // run 1 starts the store clean
  if (phase !== 'learn' && !existsSync(memRoot)) {
    emit('run.error', { msg: `no persistent store at ${memRoot} — run \`learn\` first` }); finish(2); return;
  }
  const lc = new LiteCtx({ root: memRoot });

  copyFileSync(join(FIX_DIR, `${P.fn}.stub.js`), TARGET); // start this phase's target red

  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 60, maxDepth: 1, maxChildren: 1 },
    fs: { writeScope: [TARGET] }, bash: { allow: [] }, audit: { path: auditPath },
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const stream = new Stream();

  let recallTop = null;
  const sensor = async () => {
    const v = runSuite();
    if (v.pass) return { pass: true, status: 'satisfied', critique: null };
    let critique = `${P.fn}() did not return the correct project value. That value is fixed project knowledge — `
      + 'NOT derivable and NOT in any file you can read. Do not guess.';
    if (P.recall) {
      const hits = await lc.recall(RECALL_QUERY, { kind: ['fact', 'episode'], n: 3, body: true });
      const flat = Array.isArray(hits) ? hits : Object.values(hits).flat();
      flat.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const top = flat[0];
      if (top) {
        recallTop = { id: top.path, score: Number((top.score ?? 0).toFixed(3)), bodyHead: String(top.body || '').slice(0, 70) };
        emit('recall.consumed', { query: `${P.fn}-error`, nHits: flat.length, top: recallTop });
        critique += `\n\nRecalled from memory — a PAST task you solved (its tests passed). Reuse the relevant value:\n"${top.body}"`;
      } else emit('recall.consumed', { query: `${P.fn}-error`, nHits: 0, top: null });
    }
    return { pass: false, status: 'unmet', critique };
  };

  const task = `Implement ${P.fn}.js so that \`node --test ${P.test}\` passes. It must \`export function ${P.fn}()\`. `
    + `The test checks ${P.fn}() returns a specific fixed project value. Apply your fix with edit_file, then stop.`;
  const opts = { persona: PERSONA, tools: [editTool], maxDepth: 0, refineLeaf: { sensor } };
  // BA-9: run 1 (learn) gets the salt via the runbook context — its only source. Run 2 gets NO context.
  if (P.context) opts.context = `Ops runbook (authoritative): the project signing salt — the exact value functions like ${P.fn}() must return — is: ${SALT}`;

  emit('phase.start', { phase, fn: P.fn, recall: P.recall, context: P.context, store: memRoot });

  let result;
  try { result = await recurse(task, { provider, policy, onLlmResult, stream }, opts); }
  catch (e) { emit('run.error', { source: 'recurse', message: e.message }); finish(1); return; }

  const rl = result.receipts?.refineLeaf;
  const green = runSuite().pass;
  const src = (() => { try { return readFileSync(TARGET, 'utf8'); } catch { return ''; } })();
  const usedSalt = src.includes(SALT);
  emit('observe', { refineLeaf: rl, suiteGreen: green, artifactHasSalt: usedSalt, recallTop });

  // LEARN: only on a GROUNDED pass, store the agent's OWN working code as the lesson (earned, not authored).
  if (phase === 'learn') {
    if (green && usedSalt) {
      const lessonText = `A past signing task was solved and its tests PASSED. The working implementation was:\n\n`
        + `${src.trim()}\n\nThe project signing salt is the literal value returned above; reuse it for similar signing functions.`;
      await lc.remember(LESSON_ID, lessonText, { kind: 'episode' });
      emit('lesson.stored', { id: LESSON_ID, kind: 'episode', bytes: lessonText.length, note: 'agent\'s own verified code — grounded by the green test' });
      emit('verify.PASS', { phase, msg: `run 1 learned + stored a grounded lesson (sign() passed via runbook context); store persists at ${memRoot}` });
      finish(0); return;
    }
    emit('verify.FAIL', { phase, msg: `run 1 did not reach a grounded pass (green=${green} usedSalt=${usedSalt}) — nothing trustworthy to store` });
    finish(1); return;
  }

  // APPLY: the A/B on run 2.
  let ok, msg;
  if (!rl) { ok = false; msg = 'NO receipts.refineLeaf — seam did not engage'; }
  else if (P.recall) {
    ok = rl.passed === true && green && usedSalt && !!recallTop;
    msg = ok
      ? `CROSS-RUN WIN: seal() passed using a lesson EARNED in run 1 and recalled in a separate process (iterations=${rl.iterations}, recalled id=${recallTop.id} score=${recallTop.score}). The salt crossed runs only through litectx.`
      : `expected cross-run recall pass; passed=${rl?.passed} green=${green} usedSalt=${usedSalt} recallTop=${JSON.stringify(recallTop)}`;
  } else {
    ok = rl.passed === false && !green && !usedSalt;
    msg = ok
      ? `control held: WITHOUT recall the run-1 knowledge is gone — seal() failed (iterations=${rl.iterations}, passed=false, RED). Proves the win was memory, not leakage.`
      : `control unexpectedly recovered (LEAK?): passed=${rl?.passed} green=${green} usedSalt=${usedSalt}`;
  }
  emit(ok ? 'verify.PASS' : 'verify.FAIL', { phase, msg });
  finish(ok ? 0 : 1);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
