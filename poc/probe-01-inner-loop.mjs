#!/usr/bin/env node
// probe-01 — the inner loop, grounded.
//
// Proves the smallest end-to-end claim of the whole design: a refine() loop driven by
// EXECUTABLE verification (run the tests, read the exit code) can close on green AND can
// FAIL HONESTLY — before any LLM is in the picture. The LLM only swaps in for `attempt`.
//
// Everything load-bearing is consumed from bareagent, nothing reimplemented:
//   - refine()          the generate -> evaluate -> regenerate inner loop
//   - Evaluator         the predicate path (deterministic, no provider, no tokens)
//   - JsonlTransport    the append-only event log
//
// Modes:
//   fake  attempt deterministically writes the correct file  -> must reach loop.done
//   noop  attempt makes no change                            -> must reach loop.escalated
//   llm   attempt = a real bareagent Loop with edit/run tools (needs an API key; see FINDINGS F5)
//
// Run:  node probe-01.mjs fake   |   node probe-01.mjs noop

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeFileSync, copyFileSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { refine, Evaluator } = require('bare-agent');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dir, 'fixtures', 'sum');
const SUM = join(FIX, 'sum.js');
const BROKEN = join(FIX, 'sum.broken.js');
const CORRECT = 'export function sum(a, b) {\n  return a + b;\n}\n';
const GOAL = 'sum(a, b) must return a + b so that `node --test` passes in fixtures/sum';
const MAX_ITER = 3;

const mode = (process.argv[2] || 'fake').toLowerCase();
const logPath = join(__dir, `run-probe01-${mode}.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });

// Flush the append-only log before exiting. process.exit() would truncate the buffered
// stream and lose the events (the deliverable) — so end() the stream, then set exitCode
// and let the event loop drain naturally.
function finish(code) {
  console.error(`\n${C.dim}events -> ${logPath}${C.rst}`);
  out.end(() => { process.exitCode = code; });
}

// --- event stream: one append-only JSONL line per event, plus a colored console line ---
let seq = 0;
const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', rst: '\x1b[0m' };
function emit(type, payload = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  console.error(line(ev));
}
function line(ev) {
  const color = {
    'run.start': C.cyn, 'iteration.start': C.dim, 'edit.proposed': C.ylw,
    'verify.ran': ev.pass ? C.grn : C.red, 'loop.done': C.grn, 'loop.escalated': C.red,
  }[ev.type] || '';
  let s = `${color}● ${ev.type}${C.rst}`;
  if (ev.type === 'iteration.start') s += ` ${C.dim}#${ev.n}/${ev.max}${C.rst}`;
  if (ev.type === 'edit.proposed') s += ` ${C.dim}${ev.summary}${C.rst}`;
  if (ev.type === 'verify.ran') s += ` ${ev.pass ? 'PASS' : 'FAIL'} ${C.dim}(exit ${ev.exitCode})${C.rst}`;
  if (ev.type === 'loop.done') s += ` ${C.dim}after ${ev.iterations} iter${C.rst}`;
  if (ev.type === 'loop.escalated') s += ` ${ev.reason} ${C.dim}after ${ev.iterations} iter${C.rst}`;
  return s;
}

// --- the executable gate: run the fixture's tests, exit code is truth ---
function runTests() {
  const r = spawnSync('node', ['--test'], { cwd: FIX, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1, output: (r.stdout || '') + (r.stderr || '') };
}

// --- attempt strategies (the only thing the LLM eventually replaces) ---
async function fakeAttempt({ iteration }) {
  writeFileSync(SUM, CORRECT);
  emit('edit.proposed', { iteration, summary: 'wrote correct sum.js (fake)' });
  return { wrote: 'sum.js' };
}
async function noopAttempt({ iteration }) {
  emit('edit.proposed', { iteration, summary: 'no-op (deliberately makes no change)' });
  return { wrote: null };
}

// --- evaluate: predicate path. No provider, no tokens. pass -> satisfied; fail -> needs_revision (retry). ---
const ev = new Evaluator();
async function evaluate(result, { iteration }) {
  const v = runTests();
  emit('verify.ran', { iteration, pass: v.pass, exitCode: v.exitCode, tail: v.output.trim().split('\n').slice(-4).join(' / ') });
  return ev.evaluate(GOAL, v, { predicate: (r) => r.pass, contract: GOAL });
}

async function main() {
  if (mode === 'llm') {
    const key = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
    if (!key) {
      console.error(`${C.red}llm mode needs ANTHROPIC_API_KEY (or OPENAI_API_KEY).${C.rst}`);
      console.error(`${C.dim}FINDINGS F5: CLIPipe can't drive a tool loop, so no key-free path exercises`);
      console.error(`bareagent's Loop + bareguard's gate. Run \`fake\` or \`noop\` to validate the harness.${C.rst}`);
      finish(2); return;
    }
    console.error('llm attempt lands in probe-02 (bareagent Loop + shell tools + bareguard gate).');
    finish(2); return;
  }

  const attempt = mode === 'noop' ? noopAttempt : fakeAttempt;
  copyFileSync(BROKEN, SUM); // always start red
  emit('run.start', { mode, goal: GOAL, maxIter: MAX_ITER, log: logPath });

  const wrapped = async (ctx) => {
    emit('iteration.start', { n: ctx.iteration + 1, max: MAX_ITER });
    return attempt(ctx);
  };

  const outcome = await refine({ attempt: wrapped, evaluate, contract: GOAL, maxIterations: MAX_ITER });

  if (outcome.verdict?.pass) emit('loop.done', { iterations: outcome.iterations });
  else emit('loop.escalated', { reason: 'maxIterations', iterations: outcome.iterations });

  finish(outcome.verdict?.pass ? 0 : 1);
}

main().catch((e) => { console.error(e); finish(1); });
