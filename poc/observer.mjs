#!/usr/bin/env node
// observer.mjs — G4: the recurse-run microscope, as ONE reusable pure listener.
//
// PRD §7 invariant: the observer NEVER imports the engine and never touches control flow. It reads only the
// PERSISTED artifacts of a run — the event stream `run-*.jsonl` (relayfact's app events) and the sibling
// bareguard audit `*-audit.jsonl` — and renders the context-engineering picture from them.
//
// HONESTY CONSTRAINT (the thing that makes this not paper over): the RC-10 receipts *tree* and the worker
// Stream (loop:tool_call, …) are RETURN-VALUE / console only in the current probes — they are NOT in the
// jsonl. So this observer renders the spawn tree it can HONESTLY reconstruct from the audit lineage
// (run_id/parent_run_id/spawn_depth) plus the grounded-coverage summary the run itself reported
// (`boundary.map`), and for any facet a given run did not expose it says so — it does NOT invent a
// per-node verdict tree that was never persisted. (probe-18 asserts exactly this "declare absent, don't
// fabricate" behavior.) Going forward, probes G1–G3 can emit a `receipts` event to persist the real tree;
// when present the observer renders it (see analyze().tree.source === 'receipts').
//
// Run:  node poc/observer.mjs poc/run-probe13.jsonl
//       node poc/observer.mjs poc/run-probe12-depth.jsonl
// Reuse: import { loadRun, analyze, render } from './observer.mjs'

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', bold: '\x1b[1m', rst: '\x1b[0m' };

function readJsonl(path) {
  const out = [];
  for (const ln of readFileSync(path, 'utf8').split('\n')) {
    const s = ln.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* skip a partial/corrupt line, don't crash the microscope */ }
  }
  return out;
}

// Given a run log path, load its events + every sibling audit that shares the base name. probe-13 writes
// per-fn/per-arm audits (run-probe13-<fn>-<arm>-audit.jsonl); probe-12 writes one (run-probe12-<mode>-audit.jsonl).
export function loadRun(runLogPath) {
  if (!existsSync(runLogPath)) throw new Error(`run log not found: ${runLogPath}`);
  const dir = dirname(runLogPath);
  const base = basename(runLogPath).replace(/\.jsonl$/, '');        // e.g. run-probe12-depth
  const events = readJsonl(runLogPath);

  // Assign each audit to its OWNER log by LONGEST-matching base, so `run-probe12-depth` does not swallow
  // `run-probe12-depth-ok`'s audit (a plain startsWith prefix match cross-contaminates sibling modes).
  const all = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  const logBases = all.filter((f) => !f.includes('audit')).map((f) => f.replace(/\.jsonl$/, ''));
  const owns = (auditFile) => {
    const stem = auditFile.replace(/-audit\.jsonl$/, '').replace(/\.jsonl$/, '');
    let best = null;
    for (const b of logBases) if (stem === b || stem.startsWith(b + '-')) if (!best || b.length > best.length) best = b;
    return best;
  };
  const auditFiles = all.filter((f) => f.includes('audit') && owns(f) === base);
  const audits = [];
  for (const f of auditFiles) audits.push(...readJsonl(join(dir, f)));
  return { events, audits, auditFiles, runLogPath };
}

const evOfType = (events, ...types) => events.filter((e) => types.includes(e.type));

// Pull the facets a run exposed. Each facet carries { present } so render() and probe-18 can tell
// "this run did not show X" apart from "X went wrong". No facet is ever fabricated when absent.
export function analyze(events, audits = []) {
  const facets = {};

  // ---- HEADER: run identity ----
  const start = evOfType(events, 'run.start')[0];
  const entity = evOfType(events, 'entity')[0];
  const summary = evOfType(events, 'summary')[0];
  const model = start?.model || summary?.model || events.find((e) => e.model)?.model || null;
  facets.header = {
    present: !!(start || entity || summary),
    model,
    mode: start?.mode ?? null,
    expect: start?.expect ?? null,
    family: start?.family ?? null,
    events: events.length,
    auditRecords: audits.length,
  };

  // ---- GROUNDED CLOSE: relayfact's executable verification, every time it ran ----
  const verifies = evOfType(events, 'verify.ran');
  facets.close = {
    present: verifies.length > 0,
    calls: verifies.length,
    verdicts: verifies.map((v) => ({ pass: v.pass, exitCode: v.exitCode, groundedCalls: v.groundedCalls })),
  };

  // ---- MEMORY: recall candidates, close-driven widening, whether the right note was in the slate ----
  const recalls = evOfType(events, 'recall');
  facets.memory = {
    present: recalls.length > 0,
    events: recalls.map((r) => ({ fn: r.fn, arm: r.arm, attempt: r.attempt, window: r.window, rightRank: r.rightRank, rightInSlate: r.rightInSlate })),
    widened: recalls.length > 1 && recalls.some((r, i) => i > 0 && r.window > recalls[i - 1].window),
  };

  // ---- TREE / GROUNDING BOUNDARY: only what the run actually REPORTED about grounding ----
  // Honesty split: the grounding boundary (per-node verdict / grounded-coverage / residue) is a
  // relayfact-REPORTED fact (boundary.map today, a persisted `receipts` event later). The audit's spawn
  // lineage is a DIFFERENT signal (bareguard-derived) and lives under the gate facet — it is NOT a
  // grounding boundary, so a run with lineage but no boundary.map has this facet honestly ABSENT.
  const bmap = evOfType(events, 'boundary.map')[0];
  const receiptEvents = evOfType(events, 'receipts'); // probes persist the RC-10 tree here (F32 carry-forward)
  const receiptNodes = receiptEvents.flatMap((r) => (r.nodes || []).map((n) => ({ ...n, phase: n.phase ?? r.phase })));
  facets.tree = {
    present: !!bmap || receiptNodes.length > 0,
    source: bmap ? 'boundary.map (run-reported)' : (receiptNodes.length ? 'receipts event (run-persisted RC-10 tree)' : null),
    groundedCoverage: bmap?.groundedCoverage ?? null,
    ungroundedResidue: bmap?.ungroundedResidue ?? null,
    residueByDepth: bmap?.residueByDepth ?? null,
    maxDepthReached: bmap?.maxDepthReached ?? null,
    nodes: receiptNodes.length ? receiptNodes : null,
  };

  // ---- GATE: enforcement activity from the audit ----
  const actionType = {};
  const decisions = {};
  const rulesFired = {};
  const runIds = new Map(); // run_id -> spawn_depth, the real (audit-derived) spawn shape
  let cost = 0, halts = 0, denies = 0;
  for (const a of audits) {
    const t = a.action?.type ?? a.type ?? '?';
    actionType[t] = (actionType[t] || 0) + 1;
    const d = a.decision ?? a.action?.decision ?? null;
    if (d) { decisions[d] = (decisions[d] || 0) + 1; if (d === 'deny') denies++; }
    // A halt is a genuine STOP — a deny/terminate decision or a halt-level severity. `severity:'action'`
    // is the ROUTINE per-action record level, NOT a halt (counting it would invent alarm — the inverse
    // paper-over). Only real stop signals count.
    if (d === 'terminate' || ['halt', 'critical', 'fatal'].includes(a.severity)) halts++;
    if (a.rule) rulesFired[a.rule] = (rulesFired[a.rule] || 0) + 1;
    cost += a.result?.costUsd ?? 0;
    const id = a.run_id ?? null;
    if (id != null && !runIds.has(id)) runIds.set(id, a.spawn_depth ?? 0);
  }
  const spawnDepthHist = {};
  for (const depth of runIds.values()) spawnDepthHist[depth] = (spawnDepthHist[depth] || 0) + 1;
  facets.gate = {
    present: audits.length > 0,
    actionType, decisions, rulesFired,
    denies, halts,
    costUsd: Number(cost.toFixed(4)),
    llmCalls: actionType.llm || 0,
    writes: actionType.write || 0,
    spawnRuns: runIds.size,
    spawnDepthHist: Object.keys(spawnDepthHist).length ? spawnDepthHist : null,
  };

  // ---- TERMINAL: how the run ended (deliver / fail / incomplete / escalate) ----
  const done = evOfType(events, 'recurse.done')[0];
  const failed = evOfType(events, 'recurse.failed')[0];
  const incomplete = evOfType(events, 'recurse.incomplete')[0];
  const escalate = evOfType(events, 'run.escalate')[0];        // G3 escalation artifact
  const spike = evOfType(events, 'spike.PASS', 'spike.FAIL', 'g1.PASS', 'g1.FAIL', 'g2.PASS', 'g2.FAIL')[0]; // probe verdicts
  const armPass = evOfType(events, 'arm.PASS');
  const armFail = evOfType(events, 'arm.FAIL');
  let outcome = null;
  if (escalate) outcome = 'escalate';
  else if (done) outcome = 'deliver';
  else if (incomplete) outcome = 'incomplete';
  else if (failed) outcome = 'fail';
  else if (summary) outcome = 'summary';
  else if (spike) outcome = /PASS/.test(spike.type) ? 'deliver' : 'fail'; // a probe verdict is a terminal too
  facets.terminal = {
    present: !!(done || failed || incomplete || escalate || spike || summary || armPass.length || armFail.length),
    outcome,
    escalation: escalate ? { goal: escalate.goal, blocker: escalate.blocker, decisionNeeded: escalate.decisionNeeded, costSpent: escalate.costSpent } : null,
    spike: spike ? { type: spike.type, msg: spike.msg || (spike.failModes ? `honest=${JSON.stringify(spike.honest)} failModes=${JSON.stringify(spike.failModes)}` : spike.reading || '') } : null,
    rates: summary ? { naiveRate: summary.naiveRate, fixedRate: summary.fixedRate } : null,
    arms: (armPass.length || armFail.length) ? { pass: armPass.length, fail: armFail.length } : null,
    status: done?.status ?? failed?.status ?? incomplete?.reason ?? null,
  };

  return facets;
}

const yn = (b) => (b ? `${C.grn}yes${C.rst}` : `${C.dim}— (not exposed by this run)${C.rst}`);

export function render(facets, { runLogPath } = {}) {
  const L = [];
  const h = facets.header;
  L.push(`${C.bold}${C.cyn}━━ recurse-run microscope ━━${C.rst}${runLogPath ? ` ${C.dim}${basename(runLogPath)}${C.rst}` : ''}`);
  L.push(`  model=${h.model ?? '?'}${h.mode ? ` mode=${h.mode} expect=${h.expect}` : ''}${h.family ? ` family=${h.family}` : ''}  ${C.dim}(${h.events} events, ${h.auditRecords} audit records)${C.rst}`);

  // grounded close
  L.push(`\n${C.bold}① grounded close${C.rst} (relayfact's executable verification) ${facets.close.present ? '' : yn(false)}`);
  if (facets.close.present) {
    L.push(`  ran ${C.bold}${facets.close.calls}${C.rst}× ${C.dim}(F13: expect once, at the top)${C.rst}`);
    for (const v of facets.close.verdicts) L.push(`    ${v.pass ? C.grn + 'PASS' : C.red + 'FAIL'}${C.rst} exit=${v.exitCode} groundedCalls=${v.groundedCalls}`);
  }

  // memory
  L.push(`\n${C.bold}② memory${C.rst} (recall candidates · close-driven widening) ${facets.memory.present ? '' : yn(false)}`);
  if (facets.memory.present) {
    if (facets.memory.widened) L.push(`  ${C.blu}widened${C.rst} across attempts ${C.dim}(the close driving recall, not trusting rank)${C.rst}`);
    for (const r of facets.memory.events)
      L.push(`    ${C.dim}[${r.arm}/${r.fn} a${r.attempt}]${C.rst} window=${r.window} rightRank=${r.rightRank} rightInSlate=${r.rightInSlate ? C.grn + 'yes' + C.rst : C.red + 'no' + C.rst}`);
  }

  // tree / boundary
  L.push(`\n${C.bold}③ tree / grounding boundary${C.rst} ${facets.tree.present ? `${C.dim}[${facets.tree.source}]${C.rst}` : yn(false)}`);
  if (facets.tree.present) {
    if (facets.tree.groundedCoverage) L.push(`  grounded coverage ${C.grn}${facets.tree.groundedCoverage}${C.rst} · ungrounded residue ${C.ylw}${facets.tree.ungroundedResidue}${C.rst} ${C.dim}(verdict=null descendants)${C.rst}`);
    if (facets.tree.maxDepthReached != null) L.push(`  max depth reached: ${facets.tree.maxDepthReached}`);
    if (facets.tree.residueByDepth) L.push(`  ${C.dim}residue by depth: ${JSON.stringify(facets.tree.residueByDepth)}${C.rst}`);
    if (facets.tree.nodes) for (const n of facets.tree.nodes) L.push(`  ${C.dim}• ${n.phase ? `[${n.phase}] ` : ''}d${n.depth ?? 0} "${n.task ?? ''}" verdict=${n.verdict}${n.iterations != null ? ` iters=${n.iterations}` : ''}${C.rst}`);
  }

  // gate
  L.push(`\n${C.bold}④ gate${C.rst} (bareguard enforcement) ${facets.gate.present ? '' : yn(false)}`);
  if (facets.gate.present) {
    L.push(`  cost=$${facets.gate.costUsd}  llm=${facets.gate.llmCalls}  writes=${facets.gate.writes}  ${facets.gate.denies ? C.red : C.dim}denies=${facets.gate.denies}${C.rst}  ${facets.gate.halts ? C.red : C.dim}halts=${facets.gate.halts}${C.rst}`);
    const rules = Object.keys(facets.gate.rulesFired);
    if (rules.length) L.push(`  ${C.dim}rules fired: ${JSON.stringify(facets.gate.rulesFired)}${C.rst}`);
    L.push(`  ${C.dim}actions: ${JSON.stringify(facets.gate.actionType)}${C.rst}`);
    if (facets.gate.spawnDepthHist) L.push(`  ${C.dim}spawn shape (audit lineage): ${facets.gate.spawnRuns} run(s), by depth ${JSON.stringify(facets.gate.spawnDepthHist)}${C.rst}`);
  }

  // terminal
  L.push(`\n${C.bold}⑤ terminal${C.rst} (how it came back) ${facets.terminal.present ? '' : yn(false)}`);
  if (facets.terminal.present) {
    const oc = facets.terminal.outcome;
    const col = { deliver: C.grn, escalate: C.ylw, incomplete: C.red, fail: C.red, summary: C.mag }[oc] || '';
    L.push(`  outcome: ${col}${oc}${C.rst}${facets.terminal.status ? ` ${C.dim}(${facets.terminal.status})${C.rst}` : ''}`);
    if (facets.terminal.escalation) {
      const e = facets.terminal.escalation;
      L.push(`  ${C.ylw}escalation:${C.rst} goal=${JSON.stringify(e.goal)} blocker=${JSON.stringify(e.blocker)}`);
      L.push(`    decisionNeeded=${JSON.stringify(e.decisionNeeded)} costSpent=${e.costSpent}`);
    }
    if (facets.terminal.spike) L.push(`  ${facets.terminal.spike.type === 'spike.PASS' ? C.grn : C.red}${facets.terminal.spike.type}${C.rst}: ${facets.terminal.spike.msg}`);
    if (facets.terminal.rates) L.push(`  rates: naive=${facets.terminal.rates.naiveRate} fixed=${facets.terminal.rates.fixedRate}`);
    if (facets.terminal.arms) L.push(`  arms: ${facets.terminal.arms.pass} pass / ${facets.terminal.arms.fail} fail`);
  }

  return L.join('\n');
}

// CLI
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const path = process.argv[2];
  if (!path) { console.error('usage: node observer.mjs <run-*.jsonl>'); process.exit(2); }
  const { events, audits, auditFiles } = loadRun(path);
  const facets = analyze(events, audits);
  console.log(render(facets, { runLogPath: path }));
  if (auditFiles.length) console.log(`${C.dim}\n(audit: ${auditFiles.join(', ')})${C.rst}`);
}
