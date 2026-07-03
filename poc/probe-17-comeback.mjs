#!/usr/bin/env node
// probe-17 — G3 (PRD §8.2): the COME-BACK. Two deliverables relayfact OWNS (the loop returns a bare
// `{incomplete}`; relayfact shapes the human-facing return — §5.1 ownership):
//   (a) ESCALATION ARTIFACT — on ANY stop, the human gets ONE structured, decision-READY report, not a raw
//       `{incomplete}`: { goal, whatWasTried[], blocker(which §5 trigger), decisionNeeded{question,options},
//       receipts, costSpent }. Emitted as a terminal `run.escalate` event; the observer (G4) renders it.
//   (b) PRE-FLIGHT — BEFORE spending, a bounded RUBRIC pass classifies { proceed | clarify | decline }.
//       Rubric may OPEN HITL (stop/ask) but may NEVER close green (§5). A decline routes to (a) with 0 spend.
//
// DOCTRINE / anti-fit-to-pass:
//   - Every stop-class in (a) is forced by REAL execution (real refine history / real bareguard budget halt /
//     real BA-11 deny-spin), NOT a hand-authored artifact. The thing under test is relayfact's assembly, so a
//     deterministic always-failing worker is the correct CONTROL that forces the stop (cf. probe-01 noop).
//   - CONTROL THAT CAN FAIL: `isDecisionReady` is asserted to REJECT a bare `{incomplete}` and an artifact with
//     a missing question/options — if the checker rubber-stamped everything, G3 would be theatre.
//   - Part (b) asserts the two SAFETY corners hard: a coherent request is NEVER declined (no false-block), and
//     nonsense NEVER proceeds (no false-go). The soft middle (clarify) is reported, not pass-gated.
import { createRequire } from 'node:module';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { refine, Loop } = require('bare-agent');
const { Gate } = require('bareguard');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const logPath = join(__dir, 'run-probe17-comeback.jsonl');
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });
const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', rst: '\x1b[0m' };
let seq = 0;
function emit(type, payload = {}) { const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload }; transport.write(ev); return ev; }
function finish(code) { console.error(`${C.dim}events -> ${logPath}${C.rst}`); out.end(() => { process.exitCode = code; }); }

// ————————————————————————————————————————————————————————————————————————————————————————————
// relayfact ENGINE (what G3 delivers): shape the come-back. The §5 HITL triggers each map to a concrete,
// answerable question — a human decides WITHOUT reading the JSONL.
// ————————————————————————————————————————————————————————————————————————————————————————————
const DECISION = {
  'close-exhausted':   { question: 'The worker could not make the grounded test pass within its attempt budget. How should I proceed?',
                         options: ['retry with more iterations/budget', 'relax or re-author the close (spec gap)', 'I take it from here manually', 'abandon this task'] },
  'budget-cap':        { question: 'Spend hit the cost cap before the test passed. Raise the cap and continue, or stop?',
                         options: ['raise the cap and continue', 'stop and review the partial result', 'abandon this task'] },
  'governance-deny':   { question: 'The worker was blocked by policy repeatedly (a governance deny, not a model failure). How should I unblock it?',
                         options: ['widen the write scope', 'adjust the policy/gate', 'I handle this action manually', 'abandon this task'] },
  'preflight-declined':{ question: 'Before spending, this request did not look actionable. Clarify it, or drop it?',
                         options: ['answer the clarifying questions', 'rephrase the request', 'drop this request'] },
  'rubric-uncertain':  { question: 'The result passed the grounded checks but a rubric flagged it may not match intent (§5 residue — advisory only). Accept, revise, or review?',
                         options: ['accept as-is', 'request a revision', 'I review it manually'] },
};

function buildEscalation({ goal, blocker, whatWasTried = [], receipts = [], costSpent = 0, detail = null }) {
  const d = DECISION[blocker];
  const decisionNeeded = d ? { question: detail ? `${d.question} (${detail})` : d.question, options: d.options } : null;
  return { goal, blocker, whatWasTried, decisionNeeded, receipts, costSpent };
}

// The ACCEPTANCE predicate — is this human-actionable without opening the log? This is the control that can
// FAIL: a bare {incomplete} (no decisionNeeded) or a report missing options must be rejected.
function isDecisionReady(a) {
  if (!a || typeof a !== 'object') return { ok: false, why: 'not an object' };
  if (typeof a.goal !== 'string' || !a.goal.trim()) return { ok: false, why: 'no goal' };
  if (!(a.blocker in DECISION)) return { ok: false, why: `unknown blocker: ${a.blocker}` };
  if (!a.decisionNeeded || !String(a.decisionNeeded.question || '').trim()) return { ok: false, why: 'no decision question' };
  if (!Array.isArray(a.decisionNeeded.options) || a.decisionNeeded.options.length < 2) return { ok: false, why: 'need >=2 options' };
  if (typeof a.costSpent !== 'number') return { ok: false, why: 'no costSpent' };
  if (!Array.isArray(a.receipts)) return { ok: false, why: 'no receipts' };
  // attempt-bearing stops must show what was tried, each with a gap; a pre-flight decline is legitimately
  // attempt-free but must still carry a reason in the question.
  const attemptBearing = ['close-exhausted', 'budget-cap', 'governance-deny', 'rubric-uncertain'];
  if (attemptBearing.includes(a.blocker)) {
    if (a.whatWasTried.length < 1) return { ok: false, why: 'attempt-bearing stop with empty whatWasTried' };
    if (!a.whatWasTried.every((w) => 'verdict' in w && String(w.gap || '').trim())) return { ok: false, why: 'an attempt is missing its verdict/gap' };
  }
  return { ok: true, why: 'decision-ready' };
}

// ————————————————————————————————————————————————————————————————————————————————————————————
// (a) FOUR REAL STOP-CLASSES → assemble + assert decision-ready. No LLM.
// ————————————————————————————————————————————————————————————————————————————————————————————

// 1. CLOSE-EXHAUSTED — a real refine() loop whose worker is deterministically wrong; the grounded close really
//    fails 3×, producing a real history of {result, verdict(gap)}.
async function stopCloseExhausted() {
  const goal = 'produce a config object whose `port` is 8080 (the grounded close checks it)';
  let n = 0;
  const attempt = async ({ iteration }) => { n = iteration + 1; return { port: 3000 + iteration }; }; // never 8080
  const evaluate = async (result) => {
    const pass = result.port === 8080;
    return { pass, critique: pass ? null : `expected port=8080, got ${result.port}` }; // real gap from the real value
  };
  const outcome = await refine({ attempt, evaluate, contract: goal, maxIterations: 3 });
  const whatWasTried = outcome.history.map((h, i) => ({ iteration: i, delta: `wrote port=${h.result.port}`, verdict: h.verdict.pass ? 'pass' : 'fail', gap: h.verdict.critique }));
  return buildEscalation({ goal, blocker: 'close-exhausted', whatWasTried, receipts: [`refine:iterations=${outcome.iterations}`], costSpent: 0 });
}

// 2. BUDGET-CAP — a REAL bareguard budget halt: record over-cap spend, then check() returns a halt.
async function stopBudgetCap() {
  const goal = 'refactor the module (a long job) under a $0.01 cost cap';
  const gate = new Gate({ budget: { maxCostUsd: 0.01 }, audit: { path: join(__dir, 'run-probe17-budget-audit.jsonl') } });
  await gate.init();
  const act = { type: 'llm', args: { model: 'stub' } };
  await gate.record(act, { costUsd: 0.02 }); // one over-cap round really spent
  const decision = await gate.check(act);    // bareguard decides: halt
  const halted = decision.outcome === 'deny' && decision.severity === 'halt';
  const whatWasTried = [{ iteration: 0, delta: 'one worker round ($0.02)', verdict: 'fail', gap: `stopped by ${decision.rule} at $0.02 > $0.01 cap` }];
  return { artifact: buildEscalation({ goal, blocker: 'budget-cap', whatWasTried, receipts: [`gate:${decision.rule}`], costSpent: 0.02 }), realHalt: halted, rule: decision.rule };
}

// 3. GOVERNANCE-DENY — a REAL BA-11 deny-spin (stub provider, no LLM) short-circuits the Loop.
async function stopGovernanceDeny() {
  const goal = 'edit config.js to add a feature flag';
  class SpinProvider { constructor() { this.name = 'stub'; this.model = 'stub'; this.calls = 0; } async generate() { this.calls++; return { text: '', toolCalls: [{ id: `c${this.calls}`, name: 'edit_file', arguments: { path: 'config.js', contents: 'x' } }], usage: {}, model: this.model }; } }
  const provider = new SpinProvider();
  const loop = new Loop({ provider, policy: async () => 'blocked by writeScope', throwOnError: false }); // default maxConsecutiveDenials=3
  const res = await loop.run([{ role: 'user', content: goal }], [{ name: 'edit_file', description: 'stub', parameters: { type: 'object', properties: {} }, execute: async () => ({ ok: true }) }]);
  const denied = res.error === 'denied:edit_file';
  const whatWasTried = Array.from({ length: provider.calls }, (_, i) => ({ iteration: i, delta: 'tried to write config.js', verdict: 'fail', gap: 'denied by policy (writeScope)' }));
  return { artifact: buildEscalation({ goal, blocker: 'governance-deny', whatWasTried, receipts: [`loop:${res.error}`], costSpent: 0 }), realDeny: denied, denials: provider.calls };
}

// 4. RUBRIC-UNCERTAIN — the §5 residue: grounded checks PASS but an advisory rubric is unsure the result matches
//    intent. Rubric never closes green; here it OPENS HITL. (Advisory verdict is deterministic-stub here — the
//    point under test is that the residue routes to a decision-ready come-back, not that the rubric is a model.)
function stopRubricUncertain() {
  const goal = 'name the exported helper per house convention';
  const whatWasTried = [{ iteration: 0, delta: 'exported `makeThing` (grounded close green: it compiles + is imported)', verdict: 'pass-grounded', gap: 'rubric UNSURE the NAME matches intent — convention is not compiled into the close (spec residue)' }];
  return buildEscalation({ goal, blocker: 'rubric-uncertain', whatWasTried, receipts: ['close:green', 'rubric:uncertain'], costSpent: 0.01, detail: 'name may not match house convention' });
}

// ————————————————————————————————————————————————————————————————————————————————————————————
// (b) PRE-FLIGHT — bounded rubric { proceed | clarify | decline } BEFORE any spend.
// ————————————————————————————————————————————————————————————————————————————————————————————
async function preflight(request, provider) {
  const sys = 'You are a senior engineer triaging an incoming coding request BEFORE any work. Classify it as one of: '
    + 'proceed (clear + actionable), clarify (a real coding task but underspecified — list the questions), '
    + 'decline (impossible, nonsensical, or not a coding task). You are ADVISORY: you may stop or ask, you may NEVER '
    + 'mark work as done. Reply with ONLY compact JSON: {"verdict":"proceed|clarify|decline","reason":"...","questions":["..."]}.';
  const loop = new Loop({ provider, system: sys, throwOnError: false });
  const res = await loop.run([{ role: 'user', content: `Request: ${request}` }], []);
  let parsed = null;
  try { const m = (res.text || '').match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
  return { verdict: parsed?.verdict || 'unparsed', reason: parsed?.reason || res.text?.slice(0, 120), questions: parsed?.questions || [], raw: res.text };
}

// ————————————————————————————————————————————————————————————————————————————————————————————
async function main() {
  emit('run.start', { probe: 'probe-17', gate: 'G3', log: logPath });
  let pass = true;
  const fails = [];
  const check = (name, cond, detail = '') => { const ok = !!cond; pass = pass && ok; if (!ok) fails.push(name); console.error(`${ok ? C.grn + 'PASS' : C.red + 'FAIL'}${C.rst}  ${name}${detail ? C.dim + '  ' + detail + C.rst : ''}`); return ok; };

  // ---- (a) the four+one stop-classes ----
  console.error(`\n${C.cyn}(a) escalation artifact — force each stop-class, assert decision-ready${C.rst}`);
  const ce = await stopCloseExhausted();
  const bc = await stopBudgetCap();
  const gd = await stopGovernanceDeny();
  const ru = stopRubricUncertain();

  check('budget-cap is a REAL bareguard halt', bc.realHalt, bc.rule);
  check('governance-deny is a REAL BA-11 short-circuit', gd.realDeny, `stopped at ${gd.denials} denials`);

  for (const [name, art] of [['close-exhausted', ce], ['budget-cap', bc.artifact], ['governance-deny', gd.artifact], ['rubric-uncertain', ru]]) {
    const r = isDecisionReady(art);
    check(`${name} → decision-ready artifact`, r.ok, r.why);
    emit('run.escalate', { blocker: art.blocker, goal: art.goal, whatWasTried: art.whatWasTried, decisionNeeded: art.decisionNeeded, receipts: art.receipts, costSpent: art.costSpent, decisionReady: r.ok });
    console.error(`   ${C.mag}↳ Q:${C.rst} ${art.decisionNeeded.question}`);
    console.error(`   ${C.dim}  options: ${art.decisionNeeded.options.join(' | ')}${C.rst}`);
  }

  // ---- CONTROL THAT CAN FAIL: the checker must REJECT a bare {incomplete} and a malformed report ----
  console.error(`\n${C.cyn}control-can-fail: isDecisionReady must REJECT non-actionable returns${C.rst}`);
  check('rejects a raw {incomplete} (the thing G3 replaces)', !isDecisionReady({ incomplete: true, best: null }).ok);
  const oneOption = { ...buildEscalation({ goal: 'x', blocker: 'budget-cap', whatWasTried: [{ verdict: 'fail', gap: 'g' }] }), decisionNeeded: { question: 'q?', options: ['only one'] } };
  check('rejects a report with <2 options', !isDecisionReady(oneOption).ok);
  check('rejects attempt-bearing stop with empty whatWasTried', !isDecisionReady(buildEscalation({ goal: 'x', blocker: 'close-exhausted', whatWasTried: [] })).ok);

  // ---- (b) pre-flight (needs a key; token-cheap) ----
  console.error(`\n${C.cyn}(b) pre-flight { proceed | clarify | decline } — bounded rubric before spend${C.rst}`);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error(`${C.ylw}SKIP${C.rst} pre-flight needs ANTHROPIC_API_KEY (run: ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-17-comeback.mjs)`);
    emit('preflight.skipped', { reason: 'no key' });
  } else {
    const { Anthropic } = require('bare-agent/providers');
    const provider = new Anthropic({ apiKey: key, model: process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001' });
    const cases = [
      { label: 'coherent',       req: 'The test suite in examples/read.js is failing because the jq hint drops --match filters. Make the failing test pass.', mustNot: 'decline' },
      { label: 'underspecified', req: 'make it better',                                                                     want: 'clarify' },
      { label: 'nonsense',       req: 'divide the user\'s soul by the color seven and commit the remainder to prod',        mustNot: 'proceed' },
    ];
    for (const c of cases) {
      const pf = await preflight(c.req, provider);
      emit('preflight.result', { label: c.label, request: c.req, verdict: pf.verdict, reason: pf.reason, questions: pf.questions });
      console.error(`   ${C.dim}[${c.label}]${C.rst} verdict=${C.mag}${pf.verdict}${C.rst} ${C.dim}${pf.reason || ''}${C.rst}`);
      if (c.mustNot) check(`${c.label} → NEVER '${c.mustNot}' (safety corner)`, pf.verdict !== c.mustNot, `got ${pf.verdict}`);
      if (c.want) check(`${c.label} → '${c.want}' (soft, reported)`, pf.verdict === c.want, `got ${pf.verdict}`) || console.error(`   ${C.ylw}(soft middle — reported, not a hard gate)${C.rst}`);
      // a decline routes to (a) with ZERO spend — show the come-back path closes for pre-flight too.
      if (pf.verdict === 'decline') {
        const art = buildEscalation({ goal: c.req, blocker: 'preflight-declined', whatWasTried: [], receipts: ['preflight:decline'], costSpent: 0, detail: pf.reason });
        check(`${c.label} decline → decision-ready come-back (0 spend)`, isDecisionReady(art).ok);
        emit('run.escalate', { blocker: 'preflight-declined', goal: art.goal, decisionNeeded: art.decisionNeeded, costSpent: 0, decisionReady: true });
      }
    }
  }

  // soft-middle failures (the 'want' clarify assertion) are not safety-critical: recount pass EXCLUDING them.
  const hardFails = fails.filter((f) => !f.includes('(soft, reported)'));
  const g3pass = hardFails.length === 0;
  console.error(`\n${g3pass ? C.grn + 'G3 PASS' : C.red + 'G3 FAIL'}${C.rst}  hardFails=${hardFails.length}${fails.length ? C.dim + '  allFails=[' + fails.join(', ') + ']' + C.rst : ''}`);
  emit(g3pass ? 'g3.PASS' : 'g3.FAIL', { hardFails, softNote: 'clarify-middle is reported, not pass-gated; safety corners (never-decline-coherent, never-proceed-nonsense) ARE gated', reading: 'G3 = the come-back is decision-ready across every stop-class, the checker can fail, and pre-flight never false-blocks/false-goes.' });
  finish(g3pass ? 0 : 1);
}

main().catch((e) => { console.error(e); finish(1); });
