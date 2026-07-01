#!/usr/bin/env node
// probe-14 — F11's untested hypothesis, tested with the RIGHT primitive (v3).
//
// F11 origin (probe-02): the v1 `refine` primitive + a bareguard budget cap. Each refine iteration seeds a
// FRESH Loop that makes an LLM call (spends) before the cap re-trips; the Loop CATCHES the HaltError and
// returns normally, so refine keeps iterating and cost CLIMBS ($0.0021→0.0047→0.0073). probe-02 worked
// around it with a manual `halted` latch that threw from `attempt`. The open question BA-6 documented but
// nobody ran: does `{decision:'terminate'}` remove the need for that latch — gate.terminate() sets
// terminated=TRUE PERMANENTLY, so later iterations should short-circuit and STOP the spend.
//
// v1/v2 of this probe were wrong (single Loop finished in 1 round; refineLeaf never routed the cap to the
// humanChannel). This v3 uses `refine` exactly like probe-02, NO latch, and measures total cost + iterations.
//   EXPECT deny      → runs all maxIterations, cost ~= N * one-attempt (the F11 problem, unlatched).
//   EXPECT terminate → gate.terminated sticks; later iterations halt with little/no spend → cost STRICTLY
//                      LESS than deny, terminated=true. If not, F11's clean-halt hypothesis is refuted.
//
// Run:  ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-14-terminate-halt.mjs

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { createWriteStream, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { Loop, refine, wireGate } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');

const __dir = dirname(fileURLToPath(import.meta.url));
const scratch = process.env.CLAUDE_SCRATCH || '/tmp/claude-1000/-home-hamr-PycharmProjects-relayfact/4a5ee5f3-5cc2-4bba-99b9-5129b50bbcfd/scratchpad';
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.0008); // ~1 haiku round; trips after iter 0
const MAX_ITER = Number(process.env.RELAYFACT_MAX_ITER ?? 4);
const logPath = join(__dir, 'run-probe14.jsonl');
const out = createWriteStream(logPath);
let seq = 0;
const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', cyn: '\x1b[36m', mag: '\x1b[35m', ylw: '\x1b[33m', rst: '\x1b[0m' };
function emit(type, payload = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  out.write(JSON.stringify(ev) + '\n');
  const col = { 'arm.result': C.cyn, human: C.ylw, verdict: C.mag, 'run.error': C.red }[type] || '';
  console.error(`${col}● ${type}${C.rst} ${C.dim}${Object.keys(payload).map((k) => `${k}=${typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]}`).join(' ')}${C.rst}`);
}

const target = join(scratch, 'p14-target.js');
const editTool = {
  name: 'edit_file', description: 'Overwrite the target file. Returns {ok}.',
  parameters: { type: 'object', properties: { contents: { type: 'string' } }, required: ['contents'] },
  execute: async ({ contents }) => { writeFileSync(target, String(contents ?? '')); return { ok: true }; },
};
const actionTranslator = (name, args, ctx) => name === 'edit_file' ? { type: 'write', path: target, args, _ctx: ctx } : { type: name, args, _ctx: ctx };

function auditSum(path) {
  let cost = 0, llm = 0, terminated = false;
  try {
    for (const ln of readFileSync(path, 'utf8').trim().split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(ln); } catch { continue; }
      const a = r.action || r; const t = a.type ?? r.type;
      if (t === 'llm') { llm++; cost += r.result?.costUsd ?? 0; }
      if ((a.rule ?? r.rule) === 'gate.terminated' || r.phase === 'terminate') terminated = true;
    }
  } catch { /* */ }
  return { cost, llm, terminated };
}

async function runArm(decision) {
  writeFileSync(target, 'export function noop(){}\n');
  const auditPath = join(__dir, `run-probe14-${decision}-audit.jsonl`);
  rmSync(auditPath, { force: true });
  let humanEvents = 0;
  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD }, limits: { maxTurns: 40 },
    fs: { writeScope: [target] }, bash: { allow: [] }, audit: { path: auditPath },
    humanChannel: async (event) => { humanEvents++; emit('human', { arm: decision, n: humanEvents, kind: event.kind, rule: event.rule, decision }); return { decision }; },
  });
  await gate.init();
  const { policy, onLlmResult, onToolResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });

  // attempt: a FRESH Loop each iteration (fresh-feedback), exactly the probe-02/F11 shape. NO manual latch.
  const attempt = async ({ iteration, critique }) => {
    const loop = new Loop({ provider, policy, onLlmResult, onToolResult, onError: () => {} });
    const goal = `Edit the target file with edit_file (write any small valid JS). ${critique ? 'Feedback: ' + critique : ''}`;
    try { return await loop.run([{ role: 'user', content: goal }], [editTool]); }
    catch { return { text: '' }; } // Loop normally catches HaltError itself; guard anyway
  };
  // evaluate: NEVER passes and is NOT terminal ('unmet'), so refine wants all MAX_ITER iterations.
  const evaluate = async () => ({ pass: false, status: 'unmet', critique: 'not there yet; rewrite and retry.' });

  let threw = null, iterations = 0;
  try { const o = await refine({ attempt, evaluate, contract: 'edit the file', maxIterations: MAX_ITER }); iterations = o.iterations; }
  catch (e) { threw = e?.constructor?.name || 'Error'; }
  const a = auditSum(auditPath);
  emit('arm.result', { arm: decision, iterations, wantedIters: MAX_ITER, llmCalls: a.llm, cost: Number(a.cost.toFixed(6)), humanEvents, gateTerminated: a.terminated, threw });
  return { decision, iterations, llm: a.llm, cost: a.cost, terminated: a.terminated, humanEvents };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY' }); out.end(() => { process.exitCode = 2; }); return; }
  emit('run.start', { model: MODEL, maxCostUsd: MAX_COST_USD, maxIter: MAX_ITER, note: 'v1 refine primitive (probe-02 shape); NO latch; deny vs terminate' });
  const deny = await runArm('deny');
  const term = await runArm('terminate');

  const stuck = term.terminated === true;                 // gate.terminated became the halting rule (a clean stick-SIGNAL)
  const selfStopped = term.llm < deny.llm;                 // did it actually PREVENT the per-iteration spend?
  if (deny.humanEvents === 0) emit('verdict', { F11: 'INCONCLUSIVE', msg: `humanChannel never fired — the budget cap didn't route through it in this wiring` });
  else if (stuck && selfStopped) emit('verdict', { F11: 'CONFIRMED', msg: `terminate self-halted: ${term.llm} calls/$${term.cost.toFixed(6)} vs deny ${deny.llm} calls/$${deny.cost.toFixed(6)} — no latch needed` });
  else if (stuck && !selfStopped) emit('verdict', { F11: 'PARTIAL — sticks but does NOT self-stop', msg: `terminate STICKS (halts 2..N are rule=gate.terminated, a clean unambiguous stop-signal) BUT does not reduce spend under refine: ${term.llm} calls vs deny ${deny.llm} (${term.cost.toFixed(6)} vs ${deny.cost.toFixed(6)}). refine seeds a fresh Loop per iteration that makes its first LLM call BEFORE the gate is consulted. So the CALLER must still break refine on gate.terminated (probe-02's latch) — terminate makes that stop-condition unambiguous, but is not self-executing under refine.` });
  else emit('verdict', { F11: 'REFUTED', msg: `terminate neither stuck nor stopped spend (terminated=${term.terminated}, ${term.llm} vs ${deny.llm} calls)` });
  // Honest exit: the ONLY clean pass is real self-stopping. "sticks but doesn't self-stop" is a real finding, exit 1.
  out.end(() => { process.exitCode = stuck && selfStopped ? 0 : 1; });
}
main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); out.end(() => { process.exitCode = 1; }); });
