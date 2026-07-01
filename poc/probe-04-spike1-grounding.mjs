#!/usr/bin/env node
// probe-04 — Spike 1: does the grounding seam survive DECOMPOSITION? (PRD §8.1 spike 1)
//
// The reconciled question (F13): recurse strips `contract`/`evaluate` on delegation, so relayfact's
// executable close runs ONLY on the top synthesized result — intermediate child nodes are graded by
// recurse's own default (rubric-or-null), NOT by relayfact's predicate. The doctrine survives ONLY IF
// a GLOBAL top-level predicate (the whole test suite) still catches a child whose slice is ungrounded.
//
// The test (prove-don't-assert; it can FAIL):
//   multi      three slices under one suite; the fc slice is UNSATISFIABLE by construction. Forced
//              fan-out (Family B) so the work really decomposes into child nodes. relayfact's
//              opts.evaluate = run the WHOLE suite. EXPECT: top verdict RED (recurse.failed / not pass),
//              exit 1 — the ungrounded slice is caught at the top, never faked green. If it goes GREEN,
//              the grounding doctrine is REFUTED.
//   multi-ok   same shape, fc satisfiable. EXPECT: top GREEN, exit 0 — proves the suite CAN pass and
//              that decompose→fan-out→global-close converges when every slice is grounded (the control).
//
// Doctrine wiring:
//   opts.synthesize = 'concat'  — lossless, NO LLM merge. A 'merge' reduce would be an LLM closing over
//                                 partials = the rubric-only synthesis §2 forbids. (For a file-editing
//                                 task the real artifact is on disk anyway; the close is the test run.)
//   ctx.stream                  — wired (F15/BA-5): worker Loops emit to it; we surface per-worker events.
//   gate fs.writeScope          — the 3 source files ONLY (never the tests) — the anti-cheat.
//
// Run:  ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-04-spike1-grounding.mjs multi
//       ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-04-spike1-grounding.mjs multi-ok

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, createWriteStream, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const require = createRequire(import.meta.url);
const { recurse, Evaluator, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { createShellTools } = require('bare-agent/tools');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));

// --- fixtures: three slices (ma/mb/mc), one suite. `multi` has an unsatisfiable fc; `multi-ok` doesn't.
const SLICES = [
  { target: 'ma.js', stub: 'ma.stub.js' },
  { target: 'mb.js', stub: 'mb.stub.js' },
  { target: 'mc.js', stub: 'mc.stub.js' },
];
// Specs inline per file (self-contained: the worker doesn't need to "read the test to understand" — that
// poor decomposition spun the budget). The predicate (the suite) still independently verifies; stating the
// spec is the PRD/contract's job, not cheating. multi's fc spec is the honest contradiction (unsatisfiable).
const FIXTURES = {
  multi:      { dir: join(__dir, 'fixtures', 'multi'),    test: 'multi.test.js',
                expect: 'red',   why: 'fc slice unsatisfiable — global predicate must catch it',
                specs: ['ma.js: fa(a,b) must return a + b  (fa(2,3) === 5)',
                        'mb.js: fb(s) must return s.toUpperCase()  (fb("hi") === "HI")',
                        'mc.js: fc(n) — the suite asserts fc(4) === true AND fc(4) === false (a CONTRADICTION; '
                          + 'no implementation can satisfy both — this slice is unsatisfiable by construction)'] },
  'multi-ok': { dir: join(__dir, 'fixtures', 'multi-ok'), test: 'multi-ok.test.js',
                expect: 'green', why: 'all slices satisfiable — control, must converge',
                specs: ['ma.js: fa(a,b) must return a + b  (fa(2,3) === 5)',
                        'mb.js: fb(s) must return s.toUpperCase()  (fb("hi") === "HI")',
                        'mc.js: fc(n) must return n * 2  (fc(4) === 8)'] },
};

const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 1.50); // 3 workers + planner + reduce; headroom
// maxDepth:1 = FLAT fan-out. Forced count:N + maxDepth>1 lets each worker RE-decompose (F18: a weak model
// over-decomposes trivial slices into a "read to understand" tree and exhausts maxTurns). Flat is the right
// config for known-parallel slices and still tests Spike 1 (children strip evaluate; top has the predicate).
const MAX_DEPTH = Number(process.env.RELAYFACT_MAX_DEPTH ?? 1);
const FANOUT = Number(process.env.RELAYFACT_FANOUT ?? 3);               // forced Family-B width (one per slice)
const MODEL = 'claude-haiku-4-5-20251001';

const mode = (process.argv[2] || 'multi').toLowerCase();
const fix = FIXTURES[mode];
if (!fix) { console.error(`unknown fixture "${mode}" — use: ${Object.keys(FIXTURES).join(' | ')}`); process.exit(2); }

const FIX_DIR = resolve(fix.dir);
const TARGETS = SLICES.map((s) => join(FIX_DIR, s.target));
const logPath = join(__dir, `run-probe04-${mode}.jsonl`);
const auditPath = join(__dir, `run-probe04-${mode}-audit.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });

function finish(code) {
  console.error(`\n${C.dim}events -> ${logPath}${C.rst}`);
  console.error(`${C.dim}audit  -> ${auditPath}${C.rst}`);
  out.end(() => { process.exitCode = code; });
}

let seq = 0;
const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };
function emit(type, payload = {}, quiet = false) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);                 // full record always persisted to JSONL
  if (!quiet) console.error(line(ev)); // quiet=true: keep it out of the noisy console (still in the log)
}
function line(ev) {
  const color = {
    'run.start': C.cyn, 'worker.ev': C.mag, 'verify.ran': ev.pass ? C.grn : C.red,
    'recurse.done': C.grn, 'recurse.failed': C.red, 'recurse.incomplete': C.red,
    'spike.PASS': C.grn, 'spike.FAIL': C.red, 'run.error': C.red,
  }[ev.type] || '';
  let s = `${color}● ${ev.type}${C.rst}`;
  if (ev.type === 'run.error') s += ` ${C.dim}[${ev.source}] ${ev.message}${C.rst}`;
  if (ev.type === 'worker.ev') s += ` ${C.dim}${ev.kind}${ev.detail ? ' ' + ev.detail : ''}${C.rst}`;
  if (ev.type === 'verify.ran') s += ` ${ev.pass ? 'PASS' : 'FAIL'} ${C.dim}(exit ${ev.exitCode})${C.rst}`;
  const tail = (ev) => `${C.dim}nodes=${ev.nodes}, acts=${ev.acts}, $${(ev.cost ?? 0).toFixed(4)} (audit)${C.rst}`;
  if (ev.type === 'recurse.done') s += ` verdict=${ev.status} ${tail(ev)}`;
  if (ev.type === 'recurse.failed') s += ` verdict=${ev.status} ${tail(ev)}`;
  if (ev.type === 'recurse.incomplete') s += ` ${ev.reason} ${tail(ev)}`;
  if (ev.type === 'spike.PASS') s += ` ${C.grn}${ev.msg}${C.rst}`;
  if (ev.type === 'spike.FAIL') s += ` ${C.red}${ev.msg}${C.rst}`;
  return s;
}

// --- the GLOBAL predicate: run the WHOLE suite (the one selected test file), exit code = truth ---
function runSuite() {
  const r = spawnSync('node', ['--test', fix.test], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1, output: (r.stdout || '') + (r.stderr || '') };
}

// Small-model workers often pass a bare/mangled filename ('mb.js', '/mb.js') instead of the absolute path
// (observed: a write to '/mb.js' denied by writeScope). Resolve to FIX_DIR/<basename>. The gate still checks
// this RESOLVED path against writeScope (the 3 source files), so the anti-cheat HOLDS — 'multi.test.js'
// resolves under FIX_DIR but is NOT in writeScope → still denied. Legitimate adapter glue (relayfact owns
// edit_file + the translator), and the gate remains the real guard. Logged as a worker-quality finding.
const resolveTarget = (p) => join(FIX_DIR, basename(String(p || '')));

// --- relayfact's write tool (gated action.type 'write'); shared across all workers ---
const editTool = {
  name: 'edit_file',
  description: 'Overwrite a source file with new contents. Pass the file name from the task. Returns {ok,bytes}.',
  parameters: { type: 'object', properties: {
    path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
  execute: async ({ path, contents }) => { const t = resolveTarget(path); writeFileSync(t, contents); return { ok: true, bytes: contents.length, path: t }; },
};
function actionTranslator(name, args, ctx) {
  if (name === 'shell_read' || name === 'shell_grep') return { type: 'read', path: args?.path, args, _ctx: ctx };
  if (name === 'shell_run') return { type: 'bash', cmd: (args?.argv || []).join(' '), args, _ctx: ctx };
  if (name === 'edit_file') return { type: 'write', path: resolveTarget(args?.path), args, _ctx: ctx }; // gate sees the RESOLVED path
  return { type: name, args, _ctx: ctx };
}

// The persona is the ONE channel that carries down to every worker (F12) — unlike the contract, which
// children strip (F13). recurse's Planner also strips the directory/path context from child subtasks
// (a child gets "Fix ma.js", not its absolute path), so the worker would otherwise not know where the
// file is. Putting the working dir + "write directly, don't read" here gives every child what it needs.
const PERSONA = [
  'You are a senior software engineer. The spec tells you EXACTLY what each function must do — you do NOT',
  `need to read anything. All source files live in the directory: ${FIX_DIR}`,
  'Apply your fix by calling edit_file with just the FILENAME (e.g. "ma.js") and the full new file contents.',
  'CRITICAL: each file must EXPORT its function — write it as `export function <name>(...) { ... }` (the tests',
  'import it by name; a missing `export` breaks the whole suite). Vanilla JS, no deps, smallest change that',
  'meets the spec. Never edit test files. One edit_file per slice, then stop.',
].join(' ');

function buildTask() {
  return `Fix the three source files so that \`node --test ${fix.test}\` passes in the fixture directory.\n\n`
    + `Fixture directory (cwd for shell_run): ${FIX_DIR}\n`
    + `Each file exports one function; here is exactly what each must do (you do NOT need to read the test):\n`
    + fix.specs.map((s, i) => `  - ${TARGETS[i]}\n      ${s}`).join('\n')
    + `\n\nEdit ONLY these three files with edit_file; do not modify the test. The three slices are `
    + `independent — split one worker per file. Apply the fix with edit_file, then you are done with your slice.`;
}

// Ground-truth rollup from the bareguard audit (F15: observe via audit + receipts, not Loop callbacks).
function summarizeAudit(path) {
  const sum = { cost: 0, read: 0, bash: 0, write: 0, llm: 0, deny: 0 };
  try {
    for (const ln of readFileSync(path, 'utf8').trim().split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(ln); } catch { continue; }
      const a = r.action || r; const t = a.type ?? r.type;
      if (t === 'llm') { sum.llm++; sum.cost += r.result?.costUsd ?? 0; }
      else if (t === 'read') sum.read++; else if (t === 'bash') sum.bash++; else if (t === 'write') sum.write++;
      if ((a.decision ?? r.decision) === 'deny') sum.deny++;
    }
  } catch { /* may not exist on early exit */ }
  return sum;
}
const actStr = (a) => `r${a.read}/b${a.bash}/w${a.write}${a.deny ? `/deny${a.deny}` : ''}`;

// Pretty-print the RC-10 receipts tree — the per-node grounding picture (top = relayfact's predicate;
// children = recurse's default verdict, rubric-or-null, since they strip evaluate).
function printTree(node, depth = 0) {
  if (!node) return;
  const pad = '  '.repeat(depth);
  const v = node.verdict ? `${node.verdict.status}${node.verdict.pass != null ? `/pass=${node.verdict.pass}` : ''}` : 'null';
  console.error(`${C.dim}${pad}• d${node.depth ?? depth} "${(node.task || '').slice(0, 54)}" verdict=${v}${node.incomplete ? ' INCOMPLETE' : ''}${C.rst}`);
  for (const c of node.spawned || []) printTree(c, depth + 1);
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(`${C.red}probe-04 needs ANTHROPIC_API_KEY.${C.rst}`);
    console.error(`${C.dim}Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-04-spike1-grounding.mjs ${mode}${C.rst}`);
    finish(2); return;
  }

  // gate: cost cap + read scope (fixture dir) + write scope (the 3 SOURCE files only — never the test).
  rmSync(auditPath, { force: true });
  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 200, maxDepth: MAX_DEPTH + 1, maxChildren: FANOUT + 1 },
    fs: { readScope: [FIX_DIR], writeScope: TARGETS },
    bash: { allow: ['node'] },
    audit: { path: auditPath },
    humanChannel: async (event) => { emit('worker.ev', { kind: `gate:${event.kind}`, detail: event.rule }); return { decision: 'deny' }; },
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });

  // ctx.stream (F15/BA-5): surface worker tool activity. Best-effort — re-emit recognizable events.
  const stream = new Stream();
  let workerToolCalls = 0;
  stream.subscribe((ev) => {
    const t = ev?.type || ev?.event || '';
    if (/tool_call/i.test(t)) workerToolCalls++;
    // worker tool chatter → JSONL only (quiet); it's high-volume. Headline counts come from the audit.
    if (/tool/i.test(t)) emit('worker.ev', { kind: t, detail: ev.name || ev.tool || '' }, true);
  });

  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const { tools: shell } = createShellTools();
  // Minimal worker toolset: edit_file ONLY. No shell_run (workers don't run tests — the TOP global predicate
  // is the authoritative close) and no shell_read (small-model workers thrashed on guessed read paths —
  // `.`/`~`/`/tmp` — since the Planner stripped the dir from the subtask; the persona now carries the dir).
  const handleTools = [editTool];
  void shell; // createShellTools kept for parity / future spikes; not wired here

  // the executable close — the GLOBAL predicate over the whole suite (runs on the synthesized result).
  const ev = new Evaluator();
  const evaluate = async (_result, { contract, task }) => {
    const v = runSuite();
    emit('verify.ran', { pass: v.pass, exitCode: v.exitCode });
    return ev.evaluate(task || buildTask(), v, { predicate: (x) => x.pass, contract: contract || fix.test });
  };

  for (const s of SLICES) copyFileSync(join(FIX_DIR, s.stub), join(FIX_DIR, s.target)); // all slices start red
  emit('run.start', { mode, expect: fix.expect, why: fix.why, model: MODEL, fixtureDir: FIX_DIR, maxDepth: MAX_DEPTH, fanout: FANOUT });

  const ctx = { provider, policy, onLlmResult, stream };
  const opts = {
    persona: PERSONA,
    tools: handleTools,
    evaluate,                 // top close = global predicate
    contract: `\`node --test ${fix.test}\` passes`,
    synthesize: 'concat',     // NO LLM merge — doctrine (rubric-only synthesis forbidden, §2)
    maxDepth: MAX_DEPTH,
    count: FANOUT,            // Family B: force fan-out into FANOUT workers so the work decomposes
  };

  let result;
  try {
    result = await recurse(buildTask(), ctx, opts);
  } catch (e) {
    emit('run.error', { source: 'recurse', message: e.message });
    finish(1); return;
  }

  const a = summarizeAudit(auditPath);
  const nodes = 1 + (result.receipts?.spawned?.length ?? 0);
  const common = { nodes, cost: a.cost, acts: actStr(a) };
  const pass = !!result.verdict?.pass && !result.incomplete;
  const status = result.verdict?.status ?? (result.incomplete ? 'incomplete' : (pass ? 'satisfied' : 'unknown'));
  if (result.incomplete) emit('recurse.incomplete', { reason: 'guard exhausted', ...common });
  else if (pass) emit('recurse.done', { status, ...common });
  else emit('recurse.failed', { status, ...common });

  // the RC-10 receipts tree — top node graded by relayfact's predicate; children by recurse's default.
  console.error(`${C.dim}--- RC-10 receipts (top=relayfact predicate, children=recurse default) ---${C.rst}`);
  printTree(result.receipts);

  // THE SPIKE ASSERTION: outcome must match the fixture's grounding expectation.
  const wantGreen = fix.expect === 'green';
  const ok = wantGreen ? pass : !pass; // unsatisfiable slice MUST NOT close green
  if (ok && wantGreen) emit('spike.PASS', { msg: 'all slices grounded → global close GREEN (converged)' });
  else if (ok && !wantGreen) emit('spike.PASS', { msg: 'ungrounded slice CAUGHT by the global top predicate — not faked green' });
  else if (!ok && !wantGreen) emit('spike.FAIL', { msg: 'DOCTRINE REFUTED: ungrounded slice closed GREEN at the top' });
  else emit('spike.FAIL', { msg: 'control did NOT converge — grounded slices failed to close green' });

  finish(ok ? 0 : 1);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
