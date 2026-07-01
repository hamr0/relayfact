#!/usr/bin/env node
// probe-02 — the real attempt, gated, with memory.
//
// probe-01 proved the verify half with a FAKE attempt. probe-02 swaps the fake for the real thing:
// `attempt` is a bareagent Loop (senior-dev persona) that reads and edits real files through a
// bareguard Gate, with litectx mounted as the store; refine drives it until `node --test` passes
// or the iteration cap escalates. Everything load-bearing is consumed, not built:
//
//   refine / Loop / Evaluator / wireGate / Memory   bareagent
//   Gate                                            bareguard
//   LiteCtx / liteCtxAsStore                        litectx (mounted as the Store — PRD §3)
//   JsonlTransport                                  bareagent (event spine)
//
// The one tool relayfact supplies is `edit_file` (FINDINGS F6/F7/F8: no gated write tool ships).
//
// Fixtures (each a real failing task with a real verify command; exit code = truth):
//   sum    trivial smoke — proves the stack wires together (red -> green)
//   csv    a genuinely fiddly single-line CSV parser (real difficulty)
//   stuck  UNSATISFIABLE by construction — proves the loop fails HONESTLY with a real attempt
//
// Knobs (env):
//   RELAYFACT_MAX_COST_USD   gate budget cap (default 0.50). Set tiny (e.g. 0.0001) to watch the
//                            gate HALT mid-run and the loop escalate without faking success.
//
// Run:  ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-02-real-attempt.mjs csv
//       ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_MAX_COST_USD=0.0001 \
//             node poc/probe-02-real-attempt.mjs csv      # cost-cap halt demo

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeFileSync, copyFileSync, createWriteStream, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { Loop, refine, Evaluator, wireGate, Memory } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { createShellTools } = require('bare-agent/tools');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));

// --- fixtures ---
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

// A tiny, mixed memory: one fact genuinely relevant to the csv task plus two distractors, so a
// recall has to RANK, not just fetch. Proving litectx is mounted and a recall is consumed (PRD §8 d);
// whether it HELPS is a benches-prd question, deliberately out of scope here.
const SEED_FACTS = [
  { text: 'CSV gotcha: inside a double-quoted field a doubled quote ("") is ONE literal ". Track an '
        + 'in-quotes flag; a quote toggles it unless the next char is also a quote (then emit one ").',
    meta: { tag: 'lesson', topic: 'csv' } },
  { text: 'Style: prefer const over let; avoid mutable module-level state in pure functions.',
    meta: { tag: 'lesson', topic: 'style' } },
  { text: 'Testing: node --test exit code is the source of truth; never trust a self-reported pass.',
    meta: { tag: 'lesson', topic: 'testing' } },
];

const MAX_ITER = 3;
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.50);
const MODEL = 'claude-haiku-4-5-20251001'; // small model on purpose: difficulty must be REAL

const mode = (process.argv[2] || 'sum').toLowerCase();
const fix = FIXTURES[mode];
if (!fix) { console.error(`unknown fixture "${mode}" — use: ${Object.keys(FIXTURES).join(' | ')}`); process.exit(2); }

const FIX_DIR = resolve(fix.dir);
const TARGET = join(FIX_DIR, fix.target);
const STUB = join(FIX_DIR, fix.stub);
const logPath = join(__dir, `run-probe02-${mode}.jsonl`);
const auditPath = join(__dir, `run-probe02-${mode}-audit.jsonl`);
const memRoot = join(__dir, `.litectx-${mode}`); // litectx wants a { root } dir; db lives under it
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });

function finish(code) {
  console.error(`\n${C.dim}events -> ${logPath}${C.rst}`);
  console.error(`${C.dim}audit  -> ${auditPath}${C.rst}`);
  out.end(() => { process.exitCode = code; });
}

// --- event stream: append-only JSONL + a colored console line (the spine from probe-01) ---
let seq = 0;
const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };
function emit(type, payload = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  console.error(line(ev));
}
function line(ev) {
  const color = {
    'run.start': C.cyn, 'memory.seeded': C.blu, 'recall.consumed': C.blu, 'iteration.start': C.dim,
    'tool.call': C.mag, 'gate.deny': C.red, 'gate.ask': C.red, 'gate.halt': C.red,
    'attempt.done': C.ylw, 'verify.ran': ev.pass ? C.grn : C.red, 'loop.done': C.grn,
    'loop.escalated': C.red, 'loop.halted': C.red, 'run.error': C.red,
  }[ev.type] || '';
  let s = `${color}● ${ev.type}${C.rst}`;
  if (ev.type === 'run.error') s += ` ${C.dim}[${ev.source}] ${ev.message}${C.rst}`;
  if (ev.type === 'memory.seeded') s += ` ${C.dim}${ev.count} facts -> litectx${C.rst}`;
  if (ev.type === 'recall.consumed') s += ` ${C.dim}q="${ev.query}" top@${(ev.top?.score ?? 0).toFixed(3)}: "${(ev.top?.content || '').slice(0, 56)}…"${C.rst}`;
  if (ev.type === 'iteration.start') s += ` ${C.dim}#${ev.n}/${ev.max}${C.rst}`;
  if (ev.type === 'tool.call') s += ` ${C.dim}${ev.name} ${JSON.stringify(ev.args).slice(0, 80)}${C.rst}`;
  if (ev.type === 'gate.halt') s += ` ${ev.rule || ''} ${C.dim}${ev.reason || 'budget halt'}${C.rst}`;
  if (ev.type === 'gate.ask') s += ` ${ev.kind}/${ev.rule}`;
  if (ev.type === 'attempt.done') s += ` ${C.dim}cost=$${(ev.cost ?? 0).toFixed(4)} "${(ev.text || '').slice(0, 56)}"${C.rst}`;
  if (ev.type === 'verify.ran') s += ` ${ev.pass ? 'PASS' : 'FAIL'} ${C.dim}(exit ${ev.exitCode})${C.rst}`;
  if (ev.type === 'loop.done') s += ` ${C.dim}after ${ev.iterations} iter, $${(ev.cost ?? 0).toFixed(4)}${C.rst}`;
  if (ev.type === 'loop.escalated') s += ` ${ev.reason} ${C.dim}after ${ev.iterations} iter, $${(ev.cost ?? 0).toFixed(4)}${C.rst}`;
  if (ev.type === 'loop.halted') s += ` ${ev.reason} ${C.dim}at iter ${ev.iterations}, spent ~$${(ev.cost ?? 0).toFixed(4)} (exact in audit)${C.rst}`;
  return s;
}

// --- executable gate: run the fixture's tests, exit code is truth (no model in this path) ---
function runTests() {
  const r = spawnSync('node', ['--test'], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1, output: (r.stdout || '') + (r.stderr || '') };
}
let lastVerify = null;

// --- relayfact's one supplied tool: a gated file write (action.type 'write'; see FINDINGS F6/F8) ---
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

// --- map each tool call to the action shape bareguard's primitives actually read (FINDINGS F7) ---
function actionTranslator(name, args, ctx) {
  if (name === 'shell_read' || name === 'shell_grep') return { type: 'read', path: args?.path, args, _ctx: ctx };
  if (name === 'shell_run') return { type: 'bash', cmd: (args?.argv || []).join(' '), args, _ctx: ctx };
  if (name === 'edit_file') return { type: 'write', path: args?.path, args, _ctx: ctx };
  return { type: name, args, _ctx: ctx };
}

const PERSONA = [
  'You are a senior software engineer fixing a failing codebase.',
  'Work in the smallest change that makes the tests pass. Read before you write. Never edit the tests.',
  'You have three tools: shell_read (read a file), shell_run (run an argv command — to run the tests use',
  'argv ["node","--test"] with the fixture directory as cwd), and edit_file (overwrite the source file at',
  'the absolute path given). Prefer vanilla JavaScript, no dependencies. When the tests pass, stop.',
].join(' ');

function buildUserMessage(iteration, recalled) {
  let m = `Goal: ${fix.goal}\n\n`
    + `Fixture directory (use as cwd for shell_run): ${FIX_DIR}\n`
    + `Source file to fix (edit ONLY this, with edit_file, at this absolute path): ${TARGET}\n`
    + `Tests live beside it; do not modify them.`;
  if (iteration === 0 && recalled) {
    m += `\n\nRelevant note retrieved from memory (may or may not apply — judge for yourself):\n`
      + `“${recalled.content}”`;
  }
  if (iteration > 0 && lastVerify) {
    m += `\n\nYour previous attempt did NOT pass. Test output (tail):\n`
      + lastVerify.output.trim().split('\n').slice(-20).join('\n')
      + `\n\nDiagnose what is still wrong and fix it.`;
  }
  return m;
}

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(`${C.red}probe-02 needs ANTHROPIC_API_KEY.${C.rst}`);
    console.error(`${C.dim}Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-02-real-attempt.mjs ${mode}${C.rst}`);
    finish(2); return;
  }

  // 1) litectx mounted as the bareagent Store (PRD §3 one-line swap), then seeded + recalled.
  let recalled = null, lc = null;
  try {
    const { LiteCtx, liteCtxAsStore } = await import('litectx');
    rmSync(memRoot, { recursive: true, force: true }); // fresh store per run, like resetting the fixture to red
    lc = new LiteCtx({ root: memRoot });               // litectx 0.21: { root } required; db defaults under it
    if (typeof lc.ready === 'function') await lc.ready();
    const memory = new Memory({ store: liteCtxAsStore(lc) }); // ← the mount point (PRD §3 one-line swap)
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

  // 2) bareguard Gate: cost cap + turn cap + read scope (fixture dir) + write scope (the ONE target
  //    file only, so the agent cannot rewrite the tests) + bash allowlist (just `node`).
  let halted = null; // set when a bareguard cap (budget/turns) halts; turns the loop OFF promptly
  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 60 }, // safety net; the cost cap is the real budget control
    fs: { readScope: [FIX_DIR], writeScope: [TARGET] },
    bash: { allow: ['node'] },
    audit: { path: auditPath },
    humanChannel: async (event) => {
      if (event.kind === 'halt') {
        halted = { rule: event.rule, reason: event.reason };
        emit('gate.halt', { rule: event.rule, reason: event.reason });
      } else {
        emit('gate.ask', { kind: event.kind, rule: event.rule });
      }
      return { decision: 'deny' };
    },
  });
  await gate.init();
  const { policy, onLlmResult, onToolResult } = wireGate(gate, { actionTranslator });

  // 3) provider + tools. Small model on purpose. shell_read + shell_run from bareagent; edit_file is ours.
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const { tools: shell } = createShellTools();
  const tools = [...shell.filter((t) => t.name === 'shell_read' || t.name === 'shell_run'), editTool];

  let totalCost = 0, iterationsRun = 0;
  const loop = new Loop({
    provider, system: PERSONA, policy, onLlmResult, onToolResult,
    onToolCall: (name, args) => emit('tool.call', { name, args }),
    onError: (err, meta) => emit('run.error', { source: meta?.source, message: err.message }),
  });

  // 4) the inner loop: attempt = the gated Loop edits files; evaluate = run tests (predicate). refine().
  copyFileSync(STUB, TARGET); // always start red
  emit('run.start', { mode, model: MODEL, goal: fix.goal, fixtureDir: FIX_DIR, maxIter: MAX_ITER, maxCostUsd: MAX_COST_USD });

  // A bareguard cap routes through humanChannel and is denied per-action; the Loop returns normally
  // rather than throwing, so without this the loop would retry and keep spending — the opposite of
  // "halts cleanly". Once a halt is seen, stop promptly: throw so refine exits and we report loop.halted.
  const attempt = async ({ iteration }) => {
    iterationsRun = iteration + 1;
    emit('iteration.start', { n: iteration + 1, max: MAX_ITER });
    const r = await loop.run([{ role: 'user', content: buildUserMessage(iteration, recalled) }], tools);
    totalCost += r.cost || 0;
    emit('attempt.done', { iteration, cost: r.cost, text: r.text });
    if (halted) throw new Error(`bareguard cap: ${halted.rule}`);
    return r;
  };

  const ev = new Evaluator();
  const evaluate = async (result, { iteration }) => {
    const v = runTests();
    lastVerify = v;
    emit('verify.ran', { iteration, pass: v.pass, exitCode: v.exitCode });
    return ev.evaluate(fix.goal, v, { predicate: (x) => x.pass, contract: fix.goal });
  };

  let outcome;
  try {
    outcome = await refine({ attempt, evaluate, contract: fix.goal, maxIterations: MAX_ITER });
  } catch (e) {
    // Two distinct exits, both honest non-success (exit 1):
    //   halted  → a bareguard cap stopped us promptly (governance, intended).
    //   else    → an unexpected error (e.g. provider rate limit) — NOT a governance halt; label it so.
    if (halted) emit('loop.halted', { reason: `${halted.rule} (${halted.reason})`, iterations: iterationsRun, cost: totalCost });
    else emit('run.error', { source: 'attempt', message: e.message }), emit('loop.escalated', { reason: 'error', iterations: iterationsRun, cost: totalCost });
    if (lc && typeof lc.close === 'function') lc.close();
    finish(1); return;
  }

  if (outcome.verdict?.pass) emit('loop.done', { iterations: outcome.iterations, cost: totalCost });
  else emit('loop.escalated', { reason: 'maxIterations', iterations: outcome.iterations, cost: totalCost });

  if (lc && typeof lc.close === 'function') lc.close();
  finish(outcome.verdict?.pass ? 0 : 1);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
