#!/usr/bin/env node
// probe-12 — Spike 3: boundary-mapping AT DEPTH (PRD §8.1 spike 3, the secondary-goal measurement).
//
// Spike 1 (probe-04) proved the grounding seam at maxDepth:1 (FLAT fan-out): children strip evaluate, so
// only the TOP node carries relayfact's executable close, yet a GLOBAL top predicate still caught an
// ungrounded slice. Spike 3 asks the same question one level deeper, and MAPS the residue:
//   (1) Does the global top predicate's REACH extend to a fault nested at depth >= 2 (not just flat)?
//   (2) As the task decomposes into a tree, WHERE does the grounded close land vs where the verdict is
//       rubric-or-null (the "ungrounded residue")? How big does the residue get relative to the tree?
//
// This is the §0/§1 secondary goal, tree-structured: the self-healing ceiling = the rubric/HITL residue.
// The honest prediction (from F13): relayfact's grounded verdict covers EXACTLY ONE node (the root); every
// spawned descendant is verdict=null (no executable close ran there). The residue therefore GROWS with the
// tree — and is only HARMLESS because the root predicate is global (Spike 1). Spike 3 tests that at depth.
//
// Prove-don't-assert (can FAIL):
//   depth     one leaf (nInc) is UNSATISFIABLE by construction; fault sits below the root. EXPECT top RED
//             (caught) AND maxDepthReached >= 2 to claim depth-2 reach. A GREEN here REFUTES the doctrine.
//   depth-ok  all leaves satisfiable. Control: EXPECT top GREEN (converged).
//
// Run:  ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-12-spike3-depth.mjs depth
//       ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-12-spike3-depth.mjs depth-ok

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, createWriteStream, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const require = createRequire(import.meta.url);
const { recurse, Evaluator, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 2.0); // depth tree = more workers; gated below
const MAX_DEPTH = Number(process.env.RELAYFACT_MAX_DEPTH ?? 2);
const TOP_COUNT = Number(process.env.RELAYFACT_TOP_COUNT ?? 2); // push 2 module-groups at the top; let them re-split

const LEAVES = ['sUpper', 'sReverse', 'sTrim', 'nDouble', 'nSquare', 'nInc'];
const S = {
  sUpper: "sUpper(s) => s.toUpperCase()  (sUpper('hi')==='HI')",
  sReverse: "sReverse(s) => the string reversed  (sReverse('abc')==='cba')",
  sTrim: "sTrim(s) => s.trim()  (sTrim('  x  ')==='x')",
  nDouble: 'nDouble(n) => n * 2  (nDouble(4)===8)',
  nSquare: 'nSquare(n) => n * n  (nSquare(3)===9)',
};
const SPECS = {
  depth:      [S.sUpper, S.sReverse, S.sTrim, S.nDouble, S.nSquare, 'nInc(n) => n + 1  — NOTE: the suite asserts a contradiction for this one; it is unsatisfiable'],
  'depth-ok': [S.sUpper, S.sReverse, S.sTrim, S.nDouble, S.nSquare, 'nInc(n) => n + 1  (nInc(1)===2)'],
};
const EXPECT = { depth: 'red', 'depth-ok': 'green' };

const mode = (process.argv[2] || 'depth').toLowerCase();
if (!SPECS[mode]) { console.error(`unknown fixture "${mode}" — use: depth | depth-ok`); process.exit(2); }
const FIX_DIR = resolve(join(__dir, 'fixtures', mode));
const TEST = `${mode}.test.js`;
const TARGETS = LEAVES.map((fn) => join(FIX_DIR, `${fn}.js`));
const logPath = join(__dir, `run-probe12-${mode}.jsonl`);
const auditPath = join(__dir, `run-probe12-${mode}-audit.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };
let seq = 0;
function emit(type, payload = {}, quiet = false) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  if (!quiet) {
    const col = { 'verify.ran': payload.pass ? C.grn : C.red, 'recurse.done': C.grn, 'recurse.failed': C.red, 'recurse.incomplete': C.red, 'boundary.map': C.blu, 'spike.PASS': C.grn, 'spike.FAIL': C.red, 'run.error': C.red, 'run.start': C.cyn }[type] || '';
    const keys = Object.keys(payload);
    let s = `${col}● ${type}${C.rst}`;
    if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]}`).join(' ')}${C.rst}`;
    console.error(s);
  }
}
function finish(code) { console.error(`${C.dim}events -> ${logPath}${C.rst}`); out.end(() => { process.exitCode = code; }); }

function runSuite() {
  const r = spawnSync('node', ['--test', TEST], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1, output: ((r.stdout || '') + (r.stderr || '')).slice(0, 300) };
}

const resolveTarget = (p) => join(FIX_DIR, basename(String(p || '')));
const editTool = {
  name: 'edit_file',
  description: 'Overwrite a source file with new contents. Pass the file name. Returns {ok,bytes}.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
  execute: async ({ path, contents }) => { const t = resolveTarget(path); writeFileSync(t, contents); return { ok: true, bytes: contents.length }; },
};
const actionTranslator = (name, args, ctx) => name === 'edit_file'
  ? { type: 'write', path: resolveTarget(args?.path), args, _ctx: ctx }
  : { type: name, args, _ctx: ctx };

const PERSONA = [
  'You are a senior software engineer. The spec tells you EXACTLY what each function must do — you do NOT',
  `need to read anything. All source files live in: ${FIX_DIR}.`,
  'Apply each fix by calling edit_file with just the FILENAME (e.g. "sUpper.js") and the full new contents.',
  'CRITICAL: each file must `export function <name>(...) { ... }`. Vanilla JS, no deps. Never edit tests.',
].join(' ');

const buildTask = () =>
  `Build a toolkit of 6 functions so that \`node --test ${TEST}\` passes in ${FIX_DIR}. It is organized as TWO\n`
  + `modules — a "strings" module (sUpper, sReverse, sTrim) and a "numbers" module (nDouble, nSquare, nInc).\n`
  + `Delegate each module, then implement its functions (you do NOT need to read the test):\n`
  + LEAVES.map((fn, i) => `  - ${fn}.js: ${SPECS[mode][i]}`).join('\n')
  + `\n\nEdit ONLY these six files with edit_file; never the test.`;

// Recursive walk of the RC-10 receipts tree → flat node list with the grounding picture per node.
function walk(node, depth = 0, acc = []) {
  if (!node) return acc;
  const v = node.verdict;
  acc.push({
    depth: node.depth ?? depth,
    task: (node.task || '').replace(/\s+/g, ' ').slice(0, 48),
    verdict: v ? `${v.status ?? '?'}${v.pass != null ? `/pass=${v.pass}` : ''}` : 'null',
    grounded: !!(v && v.pass != null), // relayfact's executable close sets pass; recurse default leaves it null
    incomplete: !!node.incomplete,
    spawned: (node.spawned || []).length,
  });
  for (const c of node.spawned || []) walk(c, (node.depth ?? depth) + 1, acc);
  return acc;
}
function printTree(node, depth = 0) {
  if (!node) return;
  const v = node.verdict ? `${node.verdict.status}${node.verdict.pass != null ? `/pass=${node.verdict.pass}` : ''}` : 'null';
  const g = node.verdict && node.verdict.pass != null ? `${C.grn}[grounded]${C.rst}` : `${C.ylw}[ungrounded]${C.rst}`;
  console.error(`${C.dim}${'  '.repeat(depth)}• d${node.depth ?? depth} "${(node.task || '').replace(/\s+/g, ' ').slice(0, 46)}" verdict=${v}${C.rst} ${g}${node.incomplete ? ' INCOMPLETE' : ''}`);
  for (const c of node.spawned || []) printTree(c, depth + 1);
}
function summarizeAudit(path) {
  const s = { cost: 0, llm: 0, write: 0, deny: 0 };
  try {
    for (const ln of readFileSync(path, 'utf8').trim().split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(ln); } catch { continue; }
      const a = r.action || r; const t = a.type ?? r.type;
      if (t === 'llm') { s.llm++; s.cost += r.result?.costUsd ?? 0; }
      else if (t === 'write') s.write++;
      if ((a.decision ?? r.decision) === 'deny') s.deny++;
    }
  } catch { /* may not exist */ }
  return s;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY' }); finish(2); return; }
  rmSync(auditPath, { force: true });

  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 200, maxDepth: MAX_DEPTH + 1, maxChildren: 5 }, // gate the "cost open by design" tree
    fs: { readScope: [FIX_DIR], writeScope: TARGETS }, bash: { allow: [] },
    audit: { path: auditPath },
    humanChannel: async () => ({ decision: 'deny' }),
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const stream = new Stream();

  const evr = new Evaluator();
  let groundedCalls = 0;
  const evaluate = async (_result, { contract, task }) => {
    groundedCalls++; // count how many times relayfact's executable close actually runs (prediction: once, at top)
    const v = runSuite();
    emit('verify.ran', { pass: v.pass, exitCode: v.exitCode, groundedCalls });
    return evr.evaluate(task || buildTask(), v, { predicate: (x) => x.pass, contract: contract || TEST });
  };

  for (const fn of LEAVES) copyFileSync(join(FIX_DIR, `${fn}.stub.js`), join(FIX_DIR, `${fn}.js`)); // all red
  emit('run.start', { mode, expect: EXPECT[mode], model: MODEL, maxDepth: MAX_DEPTH, topCount: TOP_COUNT, leaves: LEAVES.length });

  const opts = { persona: PERSONA, tools: [editTool], evaluate, contract: `\`node --test ${TEST}\` passes`, synthesize: 'concat', maxDepth: MAX_DEPTH, count: TOP_COUNT };
  let result;
  try { result = await recurse(buildTask(), { provider, policy, onLlmResult, stream }, opts); }
  catch (e) { emit('run.error', { source: 'recurse', message: e.message }); finish(1); return; }

  const a = summarizeAudit(auditPath);
  const pass = !!result.verdict?.pass && !result.incomplete;
  const status = result.verdict?.status ?? (result.incomplete ? 'incomplete' : (pass ? 'satisfied' : 'unknown'));
  (result.incomplete ? () => emit('recurse.incomplete', { reason: 'guard exhausted', cost: Number(a.cost.toFixed(4)), llm: a.llm })
    : pass ? () => emit('recurse.done', { status, cost: Number(a.cost.toFixed(4)), llm: a.llm, writes: a.write })
    : () => emit('recurse.failed', { status, cost: Number(a.cost.toFixed(4)), llm: a.llm, writes: a.write }))();

  // ---- THE BOUNDARY MAP ----
  const nodes = walk(result.receipts);
  const total = nodes.length;
  const grounded = nodes.filter((n) => n.grounded).length;
  const ungrounded = total - grounded;
  const maxDepthReached = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const byDepth = {};
  for (const n of nodes) { byDepth[n.depth] = byDepth[n.depth] || { total: 0, grounded: 0 }; byDepth[n.depth].total++; if (n.grounded) byDepth[n.depth].grounded++; }
  console.error(`${C.dim}--- RC-10 receipts tree (grounded = relayfact's executable close ran here) ---${C.rst}`);
  printTree(result.receipts);
  emit('boundary.map', {
    totalNodes: total, maxDepthReached, groundedNodes: grounded, ungroundedResidue: ungrounded,
    groundedCoverage: `${grounded}/${total}`, residueByDepth: byDepth, groundedCloseCalls: groundedCalls,
    reading: 'prediction (F13): grounded close covers exactly the ROOT; every descendant is verdict=null (ungrounded). Residue = the tree minus the root — harmless ONLY because the root predicate is global.',
  });

  // ---- THE SPIKE ASSERTION ----
  // Two independent things: (A) DOCTRINE — did the global top predicate produce the right outcome (catch the
  // fault / converge the control) despite the ungrounded residue? (B) DEPTH — did the tree actually nest to
  // >=2? (A) is the load-bearing claim; (B) is the ambition. A held doctrine at depth 1 is NOT a failure —
  // it is an honest finding that this model won't nest, reported as such (no papering over).
  const wantGreen = EXPECT[mode] === 'green';
  const doctrineOk = wantGreen ? pass : !pass;
  const deep = maxDepthReached >= 2;
  emit('depth.note', {
    maxDepthReached, deep,
    finding: deep ? 'tree nested to depth >=2 — depth reach demonstrated'
      : 'tree stayed at depth 1: haiku + inline specs UNDER-decomposes (each module child did its functions in-worker, no grandchildren) despite maxDepth headroom — depth is MODEL-bounded, not mechanism-bounded (cf. F18 over-decomposition when workers must explore). Depth-2 reach UNPROVEN with this model.',
  });
  if (doctrineOk && wantGreen) emit('spike.PASS', { msg: `DOCTRINE HELD: control converged GREEN across a ${total}-node organic tree; grounded coverage ${grounded}/${total} (root only), ungrounded residue ${ungrounded}` });
  else if (doctrineOk && !wantGreen) emit('spike.PASS', { msg: `DOCTRINE HELD: fault owned by an UNGROUNDED child (depth ${maxDepthReached}) CAUGHT by the global top predicate; grounded coverage ${grounded}/${total} (root only), ungrounded residue ${ungrounded}` });
  else if (!doctrineOk && !wantGreen) emit('spike.FAIL', { msg: 'DOCTRINE REFUTED: unsatisfiable slice closed GREEN at the top' });
  else emit('spike.FAIL', { msg: 'control did NOT converge — grounded leaves failed to close green' });

  finish(doctrineOk ? 0 : 1); // depth is reported, not gated — the doctrine is the pass/fail
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
