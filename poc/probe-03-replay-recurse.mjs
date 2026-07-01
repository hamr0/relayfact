#!/usr/bin/env node
// probe-03 — replay-through-recurse (PRD §8.1, Step 1: the cheap reconciliation).
//
// probe-02 proved the WORKER + grounded close + gate via bareagent `refine` (the depth-0 base case).
// recurse() shipped (bareagent v0.21.1), so this probe re-runs the SAME fixtures THROUGH the real
// `recurse(task, ctx, opts)` at maxDepth:1 — verify-shipped-vs-POC, NOT a fresh validation. The point is
// to confirm the seam holds end-to-end and to surface any behavioral delta vs refine.
//
//   recurse / Loop / Evaluator / wireGate / Memory   bareagent (recurse BUILDS the worker Loop now)
//   Gate                                             bareguard (the leash — caps are ITS job)
//   LiteCtx / liteCtxAsStore                         litectx (mounted as the Store — seed+recall, PRD §3)
//
// What relayfact supplies into recurse (the reconciled ownership, PRD §5.1):
//   opts.persona    the senior-dev stance (shipped seam, F12) — augments recurse's decomposition policy
//   opts.tools      edit_file (F6/F8) + shell_read + shell_run — the worker's handles
//   opts.evaluate   the EXECUTABLE close (the doctrine anchor) — runs the tests, exit code = truth.
//                   Honored over recurse's default rubric (recurse.js:870) and run on the SYNTHESIZED
//                   result. Because children strip evaluate (F13), this is a GLOBAL predicate (the whole
//                   `node --test` run), which is exactly why it stays grounded at the top.
//   ctx             { provider, policy, onLlmResult } — the bareguard leash, threaded to the worker.
//
// Reconciliation points this probe checks (PRD §8.1 / findings F11–F14):
//   * green→green:   sum / csv close green via the worker's INTERNAL tool rounds (recurse does NOT
//                    re-prompt on a failed verdict the way refine does — single-pass + terminal verify).
//   * honest-fail:   stuck (unsatisfiable) → out.verdict.pass === false (graded red, never faked green).
//   * clean halt:    a tiny budget cap → out.incomplete === true, returned cleanly (the F11-IMPROVES test —
//                    recurse wraps synthesis+verify in a HaltError guard, so the probe-02 latch-and-throw
//                    workaround should be UNNECESSARY here). No latch is wired below on purpose.
//
// Knobs (env):
//   RELAYFACT_MAX_COST_USD   gate budget cap (default 0.50). Set tiny (e.g. 0.002) to watch recurse return
//                            { incomplete } cleanly instead of spending on.
//   RELAYFACT_MAX_DEPTH      recurse maxDepth (default 1 — flat; Step 1 is the reconciliation).
//
// Run:  ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-03-replay-recurse.mjs csv
//       ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_MAX_COST_USD=0.002 \
//             node poc/probe-03-replay-recurse.mjs csv      # clean-halt demo

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, createWriteStream, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { recurse, Evaluator, wireGate, Memory } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { createShellTools } = require('bare-agent/tools');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));

// --- fixtures (same as probe-02; exit code = truth) ---
const FIXTURES = {
  sum: {
    dir: join(__dir, 'fixtures', 'sum'),
    target: 'sum.js', stub: 'sum.broken.js',
    goal: 'sum(a, b) must return a + b so that `node --test` passes in the fixture directory.',
    query: 'how to add two numbers in JavaScript',
  },
  csv: {
    dir: join(__dir, 'fixtures', 'csv'),
    target: 'csv.js', stub: 'csv.stub.js',
    goal: 'parseCSVLine(line) must pass every case in csv.test.js (quoted fields, embedded commas, '
        + 'doubled-quote escapes, preserved spaces, empty fields) so that `node --test` passes.',
    query: 'how should a CSV parser handle double quotes inside a quoted field',
  },
  stuck: {
    dir: join(__dir, 'fixtures', 'stuck'),
    target: 'classify.js', stub: 'classify.stub.js',
    goal: 'classify(n) must make `node --test` pass in the fixture directory.',
    query: 'classifying a number as even or odd',
  },
};

// Same mixed memory as probe-02: one relevant fact + two distractors, so a recall must RANK (PRD §8 d).
const SEED_FACTS = [
  { text: 'CSV gotcha: inside a double-quoted field a doubled quote ("") is ONE literal ". Track an '
        + 'in-quotes flag; a quote toggles it unless the next char is also a quote (then emit one ").',
    meta: { tag: 'lesson', topic: 'csv' } },
  { text: 'Style: prefer const over let; avoid mutable module-level state in pure functions.',
    meta: { tag: 'lesson', topic: 'style' } },
  { text: 'Testing: node --test exit code is the source of truth; never trust a self-reported pass.',
    meta: { tag: 'lesson', topic: 'testing' } },
];

const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.50);
const MAX_DEPTH = Number(process.env.RELAYFACT_MAX_DEPTH ?? 1);
const MODEL = 'claude-haiku-4-5-20251001'; // small model on purpose: difficulty must be REAL

const mode = (process.argv[2] || 'sum').toLowerCase();
const fix = FIXTURES[mode];
if (!fix) { console.error(`unknown fixture "${mode}" — use: ${Object.keys(FIXTURES).join(' | ')}`); process.exit(2); }

const FIX_DIR = resolve(fix.dir);
const TARGET = join(FIX_DIR, fix.target);
const STUB = join(FIX_DIR, fix.stub);
const logPath = join(__dir, `run-probe03-${mode}.jsonl`);
const auditPath = join(__dir, `run-probe03-${mode}-audit.jsonl`);
const memRoot = join(__dir, `.litectx-probe03-${mode}`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });

function finish(code) {
  console.error(`\n${C.dim}events -> ${logPath}${C.rst}`);
  console.error(`${C.dim}audit  -> ${auditPath}${C.rst}`);
  out.end(() => { process.exitCode = code; });
}

// --- event stream: append-only JSONL + a colored console line (same spine as probe-02) ---
let seq = 0;
const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };
function emit(type, payload = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  console.error(line(ev));
}
function line(ev) {
  const color = {
    'run.start': C.cyn, 'memory.seeded': C.blu, 'recall.consumed': C.blu,
    'tool.call': C.mag, 'gate.deny': C.red, 'gate.ask': C.red, 'gate.halt': C.red,
    'verify.ran': ev.pass ? C.grn : C.red, 'recurse.done': C.grn,
    'recurse.failed': C.red, 'recurse.incomplete': C.red, 'run.error': C.red,
  }[ev.type] || '';
  let s = `${color}● ${ev.type}${C.rst}`;
  if (ev.type === 'run.error') s += ` ${C.dim}[${ev.source}] ${ev.message}${C.rst}`;
  if (ev.type === 'memory.seeded') s += ` ${C.dim}${ev.count} facts -> litectx${C.rst}`;
  if (ev.type === 'recall.consumed') s += ` ${C.dim}q="${ev.query}" top@${(ev.top?.score ?? 0).toFixed(3)}: "${(ev.top?.content || '').slice(0, 56)}…"${C.rst}`;
  if (ev.type === 'tool.call') s += ` ${C.dim}${ev.name} ${JSON.stringify(ev.args).slice(0, 80)}${C.rst}`;
  if (ev.type === 'gate.halt') s += ` ${ev.rule || ''} ${C.dim}${ev.reason || 'budget halt'}${C.rst}`;
  if (ev.type === 'gate.ask') s += ` ${ev.kind}/${ev.rule}`;
  if (ev.type === 'verify.ran') s += ` ${ev.pass ? 'PASS' : 'FAIL'} ${C.dim}(exit ${ev.exitCode})${C.rst}`;
  const tail = (ev) => `${C.dim}nodes=${ev.nodes}, acts=${ev.acts}, $${(ev.cost ?? 0).toFixed(4)} (audit)${C.rst}`;
  if (ev.type === 'recurse.done') s += ` verdict=${ev.status} ${tail(ev)}`;
  if (ev.type === 'recurse.failed') s += ` verdict=${ev.status} ${C.dim}"${(ev.critique || '').slice(0, 50)}"${C.rst} ${tail(ev)}`;
  if (ev.type === 'recurse.incomplete') s += ` ${ev.reason} ${tail(ev)}`;
  return s;
}

// Ground-truth rollup from the bareguard AUDIT (not the receipts — F15: recurse exposes no caller
// tool-call hook, so the audit + RC-10 receipts ARE the observability substrate). Sums LLM cost and
// counts governed actions by type, including any denies.
function summarizeAudit(path) {
  const sum = { cost: 0, read: 0, bash: 0, write: 0, llm: 0, deny: 0 };
  try {
    const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
    for (const ln of lines) {
      let r; try { r = JSON.parse(ln); } catch { continue; }
      const a = r.action || r; // audit records nest the action under `action`
      const t = a.type ?? r.type;
      if (t === 'llm') { sum.llm++; sum.cost += r.result?.costUsd ?? 0; } // cost is at record.result.costUsd
      else if (t === 'read') sum.read++;
      else if (t === 'bash') sum.bash++;
      else if (t === 'write') sum.write++;
      if ((a.decision ?? r.decision) === 'deny') sum.deny++;
    }
  } catch { /* audit may not exist on an early exit */ }
  return sum;
}
const actStr = (a) => `r${a.read}/b${a.bash}/w${a.write}${a.deny ? `/deny${a.deny}` : ''}`;

// --- executable close path: run the fixture's tests, exit code is truth (no model here) ---
function runTests() {
  const r = spawnSync('node', ['--test'], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1, output: (r.stdout || '') + (r.stderr || '') };
}

// --- relayfact's one supplied write tool: gated `action.type:'write'` (FINDINGS F6/F8) ---
const editTool = {
  name: 'edit_file',
  description: 'Overwrite a source file with new contents. Use the absolute path given in the task. '
    + 'Returns {ok, bytes}. This is how you apply a fix — there is no shell redirection.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path of the file to overwrite (use the one in the task).' },
      contents: { type: 'string', description: 'The full new file contents.' },
    },
    required: ['path', 'contents'],
  },
  execute: async ({ path, contents }) => { writeFileSync(path, contents); return { ok: true, bytes: contents.length, path }; },
};

// --- map each tool call to the action shape bareguard's primitives read (FINDINGS F7) ---
function actionTranslator(name, args, ctx) {
  if (name === 'shell_read' || name === 'shell_grep') return { type: 'read', path: args?.path, args, _ctx: ctx };
  if (name === 'shell_run') return { type: 'bash', cmd: (args?.argv || []).join(' '), args, _ctx: ctx };
  if (name === 'edit_file') return { type: 'write', path: args?.path, args, _ctx: ctx };
  return { type: name, args, _ctx: ctx };
}

// The senior-dev STANCE only (opts.persona). recurse PREPENDS this ahead of its own decomposition policy
// (which it owns), so this describes the stance + how to use the tools — NOT how to decompose.
const PERSONA = [
  'You are a senior software engineer fixing a failing codebase.',
  'Work in the smallest change that makes the tests pass. Read before you write. Never edit the tests.',
  'Tools: shell_read (read a file), shell_run (run an argv command — run the tests with',
  'argv ["node","--test"] and the fixture directory as cwd), edit_file (overwrite the source file at the',
  'absolute path given). Prefer vanilla JavaScript, no dependencies. Iterate read→edit→run until the tests',
  'pass, then stop. There is no second prompt — fix it within this turn.',
].join(' ');

// recurse passes `task` as the worker's goal. No per-iteration feedback (recurse does not re-prompt), so
// everything the worker needs is here upfront, including the recalled note.
function buildTask(recalled) {
  let m = `Goal: ${fix.goal}\n\n`
    + `Fixture directory (use as cwd for shell_run): ${FIX_DIR}\n`
    + `Source file to fix (edit ONLY this, with edit_file, at this absolute path): ${TARGET}\n`
    + `Tests live beside it; do not modify them.`;
  if (recalled) {
    m += `\n\nRelevant note retrieved from memory (may or may not apply — judge for yourself):\n`
      + `“${recalled.content}”`;
  }
  return m;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(`${C.red}probe-03 needs ANTHROPIC_API_KEY.${C.rst}`);
    console.error(`${C.dim}Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-03-replay-recurse.mjs ${mode}${C.rst}`);
    finish(2); return;
  }

  // 1) litectx mounted as the bareagent Store (PRD §3), seeded + recalled — same as probe-02. (The recurse
  //    ctx.litectx={recall} HANDLE socket is Spike 2's concern, not Step 1; here we inject the note into task.)
  let recalled = null, lc = null;
  try {
    const { LiteCtx, liteCtxAsStore } = await import('litectx');
    rmSync(memRoot, { recursive: true, force: true });
    lc = new LiteCtx({ root: memRoot });
    if (typeof lc.ready === 'function') await lc.ready();
    const memory = new Memory({ store: liteCtxAsStore(lc) });
    for (const f of SEED_FACTS) await memory.store(f.text, f.meta);
    emit('memory.seeded', { count: SEED_FACTS.length, root: memRoot });
    const hits = await memory.search(fix.query);
    if (hits && hits.length) {
      recalled = hits[0];
      emit('recall.consumed', { query: fix.query, nHits: hits.length, top: { score: hits[0].score, content: hits[0].content } });
    }
  } catch (e) {
    emit('run.error', { source: 'memory', message: e.message });
  }

  // 2) bareguard Gate: cost cap + read scope (fixture dir) + write scope (the ONE target file only, so the
  //    worker cannot rewrite the tests) + bash allowlist (just `node`). NOTE: no halt-latch here — recurse
  //    is expected to return { incomplete } cleanly on a cap (the F11-improves test).
  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 60, maxDepth: MAX_DEPTH + 1, maxChildren: 4 }, // bareguard is the real total-work bound
    fs: { readScope: [FIX_DIR], writeScope: [TARGET] },
    bash: { allow: ['node'] },
    audit: { path: auditPath },
    humanChannel: async (event) => {
      if (event.kind === 'halt') emit('gate.halt', { rule: event.rule, reason: event.reason });
      else emit('gate.ask', { kind: event.kind, rule: event.rule });
      return { decision: 'deny' };
    },
  });
  rmSync(auditPath, { force: true }); // bareguard APPENDS to the audit; clear it so the rollup is THIS run only
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });

  // 3) provider + the worker's handle tools (recurse builds the worker Loop itself; we only supply tools).
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const { tools: shell } = createShellTools();
  const handleTools = [...shell.filter((t) => t.name === 'shell_read' || t.name === 'shell_run'), editTool];

  // 4) the EXECUTABLE close (the doctrine anchor). recurse calls this as (result, { contract, task }) on the
  //    SYNTHESIZED result; it ignores the worker's self-report and runs the tests — a GLOBAL predicate.
  const ev = new Evaluator();
  const evaluate = async (_result, { contract, task }) => {
    const v = runTests();
    emit('verify.ran', { pass: v.pass, exitCode: v.exitCode });
    return ev.evaluate(task || fix.goal, v, { predicate: (x) => x.pass, contract: contract || fix.goal });
  };

  copyFileSync(STUB, TARGET); // always start red
  emit('run.start', { mode, model: MODEL, goal: fix.goal, fixtureDir: FIX_DIR, maxDepth: MAX_DEPTH, maxCostUsd: MAX_COST_USD });

  // 5) THE RECONCILIATION: the same task, through the real recurse() at maxDepth:1.
  const ctx = { provider, policy, onLlmResult };
  const opts = {
    persona: PERSONA,           // F12 — the senior-dev stance, injected via the shipped seam
    tools: handleTools,         // the worker's handles (edit_file + shell)
    evaluate,                   // the executable close (honored over the default rubric; runs on synthesis)
    contract: fix.goal,         // definition-of-done; ensures verify always runs
    maxDepth: MAX_DEPTH,        // 1 = flat (Step 1 reconciliation)
  };

  let result;
  try {
    result = await recurse(buildTask(recalled), ctx, opts);
  } catch (e) {
    // recurse should NOT throw on a governed halt (it has its own HaltError guard) — a throw here is an
    // unexpected fault (e.g. provider rate limit). Label it honestly; never a faked success.
    emit('run.error', { source: 'recurse', message: e.message });
    if (lc && typeof lc.close === 'function') lc.close();
    finish(1); return;
  }

  // 6) read the outcome. Two distinct honest-fail signals (confirmed from source):
  //    incomplete === true  → a guard (budget/depth/calls) exhausted → returned cleanly (F11-improves).
  //    verdict.pass===false → the worker ran but did not meet the DoD → graded red, never faked green.
  const nodes = 1 + (result.receipts?.spawned?.length ?? 0);
  const a = summarizeAudit(auditPath);
  const common = { nodes, cost: a.cost, acts: actStr(a), audit: a };
  if (result.incomplete) {
    emit('recurse.incomplete', { reason: result.missingSlices?.length ? `missing: ${result.missingSlices.join(', ')}` : 'guard exhausted', ...common });
    if (lc && typeof lc.close === 'function') lc.close();
    finish(1); return;
  }
  const status = result.verdict?.status ?? (result.verdict?.pass ? 'satisfied' : 'unknown');
  if (result.verdict?.pass) emit('recurse.done', { status, ...common });
  else emit('recurse.failed', { status, critique: result.verdict?.critique, ...common });

  if (lc && typeof lc.close === 'function') lc.close();
  finish(result.verdict?.pass ? 0 : 1);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
