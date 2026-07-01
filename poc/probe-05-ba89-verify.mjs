#!/usr/bin/env node
// probe-05 — verify-shipped-vs-spec for BA-8 (leaf-refine seam) + BA-9 (working-context thread).
// Both shipped in bare-agent@0.23.0 (commit efc09fe). This probe RUNS the shipped code and OBSERVES
// behavior — it does not assert from source. Prove-don't-assert: every claim has a control arm that FAILS.
//
// ── BA-8 — recurse({ refineLeaf: { sensor, ... } }) ───────────────────────────────────────────────
// Spec/recipe (UPSTREAM-FIXES.md, maintainer note 2026-06-30): a DEFINITE leaf (!canSpawn) with a caller
// sensor runs as a bounded generate→sense→regenerate loop at ESCALATING temperature; the GAP (verdict.critique)
// is fed forward; honest non-recovery reports receipts.refineLeaf.passed===false (never a faked pass).
//   maxDepth:0 ⇒ canSpawn=false (recurse.js:420) ⇒ the top node IS the refining leaf.
//   ba8-recover : sensor REJECTS attempt 0 with a critique demanding the token "BANANA" — a word the TASK
//                 never mentions. It passes ONLY if the result contains BANANA. So a pass is only reachable
//                 if the critique was actually threaded into the retry's window AND the worker acted on it.
//                 EXPECT iterations===2, passed===true, temperatures===[0.2,0.7], result contains BANANA.
//                 ⇒ proves the gap-feedback path end-to-end. If the seam were a no-op single pass, the worker
//                 would never see "BANANA" → iterations===1, passed===false ⇒ REFUTED.
//   ba8-never   : sensor ALWAYS returns pass:false (status 'unmet', not terminal 'failed'). EXPECT
//                 iterations===maxIterations(3), passed===false ⇒ proves honest non-recovery is reported, not
//                 faked green, and that `passed` is not hardwired true (the can-fail control for the recover arm).
//
// ── BA-9 — recurse({ context: '<abs dir>' }) ──────────────────────────────────────────────────────
// Spec/recipe: a read-only working-context string is prepended to the worker's task so a sliced worker can
// LOCATE its artifact (F19: the Planner strips abs paths/cwd from child subtasks). A scoped read tool + an
// UNGUESSABLE temp dir make this falsifiable:
//   ba9-context   : opts.context = the abs dir. EXPECT the leaf reads <dir>/secret.txt first try and reports
//                   the random token; audit shows a read of the ABSOLUTE path.
//   ba9-nocontext : NO opts.context, and the persona does NOT name the dir. EXPECT the worker guesses a bare
//                   path → gate read DENIED → token NOT recovered (reproduces F19/probe-04). The can-fail control:
//                   if this arm recovers the token, context threading doesn't matter / the test is rigged.
//
// Run (key never in tree — injected at runtime):
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-05-ba89-verify.mjs ba8-recover
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-05-ba89-verify.mjs ba8-never
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-05-ba89-verify.mjs ba9-context
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-05-ba89-verify.mjs ba9-nocontext

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const { recurse, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const MODEL = 'claude-haiku-4-5-20251001';                       // small on purpose (same as probe-04)
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 1.0);

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', rst: '\x1b[0m' };

const MODES = {
  'ba8-recover':   { seam: 'BA-8' },
  'ba8-never':     { seam: 'BA-8' },
  'ba9-context':   { seam: 'BA-9' },
  'ba9-nocontext': { seam: 'BA-9' },
};
const mode = (process.argv[2] || '').toLowerCase();
if (!MODES[mode]) { console.error(`unknown mode "${mode}" — use: ${Object.keys(MODES).join(' | ')}`); process.exit(2); }

const logPath = join(__dir, `run-probe05-${mode}.jsonl`);
const auditPath = join(__dir, `run-probe05-${mode}-audit.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });
let seq = 0;
function emit(type, payload = {}, quiet = false) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  if (!quiet) {
    const col = { 'verify.PASS': C.grn, 'verify.FAIL': C.red, 'run.error': C.red, 'arm.start': C.cyn, 'observe': C.mag }[type] || '';
    let s = `${col}● ${type}${C.rst}`;
    const keys = Object.keys(payload).filter((k) => k !== 'seq' && k !== 'ts');
    if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${fmt(payload[k])}`).join(' ')}${C.rst}`;
    console.error(s);
  }
}
const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));

function finish(code) {
  console.error(`${C.dim}events -> ${logPath}${C.rst}`);
  console.error(`${C.dim}audit  -> ${auditPath}${C.rst}`);
  out.end(() => { process.exitCode = code; });
}

// Pull the read actions (resolved paths) + deny count out of the bareguard audit — ground truth for BA-9.
function auditReads(path) {
  const reads = []; let denies = 0; let cost = 0;
  try {
    for (const ln of readFileSync(path, 'utf8').trim().split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(ln); } catch { continue; }
      const a = r.action || r; const t = a.type ?? r.type;
      if (t === 'read' && a.path) reads.push(a.path);
      if (t === 'llm') cost += r.result?.costUsd ?? 0;
      if ((a.decision ?? r.decision) === 'deny') denies++;
    }
  } catch { /* may not exist */ }
  return { reads, denies, cost };
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY ($(pass amr/claude_api))' }); finish(2); return; }
  rmSync(auditPath, { force: true });
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const stream = new Stream();

  if (MODES[mode].seam === 'BA-8') return runBA8(provider, stream);
  return runBA9(provider, stream, key);
}

// ── BA-8 ──────────────────────────────────────────────────────────────────────────────────────────
async function runBA8(provider, stream) {
  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 80, maxDepth: 1, maxChildren: 1 },
    audit: { path: auditPath },
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate);

  // The deterministic sensor — relayfact's executable close, scripted to make the SEAM observable.
  let calls = 0;
  const TOKEN = 'BANANA';
  const sensor = (result, sctx) => {
    calls++;
    const text = String(result ?? '');
    if (mode === 'ba8-never') {
      // honest non-recovery: never satisfiable. 'unmet' (NOT terminal 'failed') so refine keeps retrying.
      return { pass: false, status: 'unmet', critique: `still wrong (deterministic always-fail control), call ${calls}` };
    }
    // ba8-recover: pass ONLY if the result carries a token the TASK never mentioned — provable gap-feedback.
    const has = text.toUpperCase().includes(TOKEN);
    emit('observe', { kind: 'sensor', call: calls, iteration: sctx?.context === undefined ? '(no ctx)' : 'ctx', hasToken: has }, true);
    return has
      ? { pass: true, status: 'satisfied', critique: null }
      : { pass: false, status: 'unmet', critique: `Your answer MUST contain the exact word ${TOKEN} in capital letters. It did not.` };
  };

  const task = 'Reply with a short, friendly one-line greeting.'; // deliberately does NOT mention the token
  emit('arm.start', { mode, seam: 'BA-8', maxDepth: 0, note: mode === 'ba8-recover' ? 'critique demands BANANA (gap-feedback proof)' : 'sensor always fails (honest non-recovery)' });

  let result;
  try {
    result = await recurse(task, { provider, policy, onLlmResult, stream }, {
      maxDepth: 0,                                   // ⇒ canSpawn=false ⇒ the top node is the refining leaf
      refineLeaf: { sensor },                        // default temperatures [0.2,0.7,1.0], maxIterations=3
    });
  } catch (e) { emit('run.error', { source: 'recurse', message: e.message }); finish(1); return; }

  const rl = result.receipts?.refineLeaf;
  const text = String(result.result ?? result.best ?? '');
  const { cost } = auditReads(auditPath);
  emit('observe', { refineLeaf: rl, sensorCalls: calls, resultHasToken: text.toUpperCase().includes(TOKEN), costUsd: Number(cost.toFixed(4)) });

  let ok, msg;
  if (!rl) { ok = false; msg = 'NO receipts.refineLeaf — the seam did NOT engage (refineLeaf absent or canSpawn=true)'; }
  else if (mode === 'ba8-recover') {
    const recovered = rl.passed === true && rl.iterations > 1 && text.toUpperCase().includes(TOKEN);
    const escalated = Array.isArray(rl.temperatures) && rl.temperatures.length === rl.iterations
      && rl.temperatures[0] < rl.temperatures[rl.temperatures.length - 1 || 0] || rl.iterations === 1;
    ok = recovered && rl.temperatures?.[0] === 0.2 && rl.temperatures?.[1] === 0.7;
    msg = ok
      ? `recovered via gap-feedback: iterations=${rl.iterations}>1, passed=true, temps escalated ${JSON.stringify(rl.temperatures)}, result carries the critique-only token`
      : `expected recover (iters>1, passed=true, token present, temps [0.2,0.7,...]); got ${JSON.stringify(rl)} tokenInResult=${text.toUpperCase().includes(TOKEN)}`;
    void escalated;
  } else { // ba8-never
    ok = rl.passed === false && rl.iterations === 3;
    msg = ok
      ? `honest non-recovery: iterations=${rl.iterations}(=maxIterations), passed=false — never faked green`
      : `expected non-recovery (iters=3, passed=false); got ${JSON.stringify(rl)}`;
  }
  emit(ok ? 'verify.PASS' : 'verify.FAIL', { seam: 'BA-8', mode, msg });
  finish(ok ? 0 : 1);
}

// ── BA-9 ──────────────────────────────────────────────────────────────────────────────────────────
async function runBA9(provider, stream, _key) {
  // unguessable working dir + a secret token only readable by following the abs path.
  const workDir = mkdtempSync(join(tmpdir(), 'relayfact-ba9-'));
  const token = `TK-${Buffer.from(String(seq) + workDir).toString('base64').slice(0, 10).replace(/[^a-zA-Z0-9]/g, 'x')}-${process.pid}`;
  const secretPath = join(workDir, 'secret.txt');
  writeFileSync(secretPath, `The deployment token is ${token}\n`);

  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 60, maxDepth: 1, maxChildren: 1 },
    fs: { readScope: [workDir] },                  // ONLY the abs work dir is readable — guessing elsewhere = deny
    audit: { path: auditPath },
  });
  await gate.init();

  // relayfact's gated read tool (action.type 'read'); the gate checks the path against readScope.
  const readTool = {
    name: 'read_file',
    description: 'Read a UTF-8 text file by absolute path. Returns {contents}.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    execute: async ({ path }) => ({ contents: readFileSync(resolve(path), 'utf8') }),
  };
  const actionTranslator = (name, args, ctx) =>
    name === 'read_file' ? { type: 'read', path: resolve(String(args?.path || '')), args, _ctx: ctx }
                         : { type: name, args, _ctx: ctx };
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });

  // persona deliberately does NOT contain the dir (so BA-9 context is the ONLY path channel under test).
  const persona = 'You are a senior engineer. Use read_file to read the secret file, then state the token.';
  const task = 'Read the file secret.txt and reply with ONLY the deployment token it contains.';
  const withCtx = mode === 'ba9-context';
  emit('arm.start', { mode, seam: 'BA-9', context: withCtx ? workDir : '(none)', secretPath });

  const opts = { persona, tools: [readTool], maxDepth: 0 };
  if (withCtx) opts.context = `Working directory (all files live here, use absolute paths): ${workDir}`;

  let result;
  try {
    result = await recurse(task, { provider, policy, onLlmResult, stream }, opts);
  } catch (e) { emit('run.error', { source: 'recurse', message: e.message }); rmSync(workDir, { recursive: true, force: true }); finish(1); return; }

  const text = String(result.result ?? result.best ?? '');
  const { reads, denies, cost } = auditReads(auditPath);
  const readAbs = reads.includes(secretPath);
  const recovered = text.includes(token);
  emit('observe', { recoveredToken: recovered, readAbsPath: readAbs, reads: reads.length, denies, costUsd: Number(cost.toFixed(4)) });

  let ok, msg;
  if (withCtx) {
    ok = recovered && readAbs;
    msg = ok ? `context threaded: leaf read the ABS path ${secretPath} and reported the token`
             : `expected recover via threaded context; recoveredToken=${recovered} readAbsPath=${readAbs} reads=${JSON.stringify(reads)}`;
  } else {
    ok = !recovered; // can-fail control: WITHOUT context the worker must NOT be able to locate/read the file
    msg = ok ? `no-context control FAILED to recover (as expected): denies=${denies}, never read the abs path — reproduces F19`
             : `LEAK/RIG: recovered the token with NO context threaded — BA-9 test is not isolating the context channel`;
  }
  rmSync(workDir, { recursive: true, force: true });
  emit(ok ? 'verify.PASS' : 'verify.FAIL', { seam: 'BA-9', mode, msg });
  finish(ok ? 0 : 1);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
