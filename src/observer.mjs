// observer.mjs — the observer CONTRACT (PRD §7): a PURE LISTENER over the persisted event stream.
//
// The §7 invariant, non-negotiable: an observer reads only the persisted artifacts of a run (the JSONL
// event log; later, the sibling bareguard audit) and NEVER imports the engine or the spine (event-log.mjs).
// It has zero control-flow coupling — it cannot change what a run does. This module therefore imports ONLY
// `node:fs`; the structural test in test/observer-contract.test.js asserts that and FAILS if it ever grows
// an engine/spine import.
//
// Step 1 graduates the READER core (round-trip the log, tolerate a corrupt line — the poc/observer.mjs
// discipline). The rich facet analyzer + renderer graduate in a later build step; the contract is here.

import { readFileSync } from 'node:fs';

/**
 * Read an event log back into memory, in file (= seq) order.
 *
 * A partial/corrupt trailing line (e.g. a run killed mid-append) is SKIPPED, not thrown — the microscope
 * must survive reading a crashed run's log. This mirrors the poc/observer.mjs readJsonl discipline.
 *
 * @param {string} path - the JSONL event log written by createEventLog.
 * @returns {object[]} parsed events, in the order they were appended.
 */
export function readEventLog(path) {
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* skip a partial/corrupt line — don't crash the listener */ }
  }
  return out;
}

/**
 * Render a pipeline run (pipeline.mjs's event vocabulary) as a compact human-readable timeline. PURE over the
 * persisted events — it derives the story ONLY from what the run emitted; it cannot fabricate a stage that
 * never ran (the §7 discipline). Unknown event types are surfaced verbatim rather than silently dropped, so a
 * facet the renderer doesn't understand is never mistaken for "didn't happen".
 *
 * @param {object[]} events - as returned by readEventLog.
 * @returns {string}
 */
export function renderRun(events) {
  const L = [];
  const first = events.find((e) => e.type === 'run.start');
  L.push(`━━ relayfact run ━━ ${events.length} events`);
  if (first) L.push(`  request: ${JSON.stringify(first.request)}`);
  for (const e of events) {
    switch (e.type) {
      case 'run.start': break; // header above
      case 'preflight':
        L.push(`① pre-flight → ${e.verdict}${e.reason ? ` (${e.reason})` : ''}${e.questions?.length ? ` [${e.questions.length} q]` : ''}`);
        break;
      case 'close.compiled':
        L.push(`② compile close → ${e.verdict} ok=${e.ok} suiteBytes=${e.suiteBytes}${e.validity ? ` (stubCatch=${e.validity.stubCatch} refPasses=${e.validity.referencePasses} mutantsKilled=${e.validity.mutantsKilled})` : ''}`);
        break;
      case 'receipts':
        L.push(`   ↳ receipts: iterations=${e.iterations} incomplete=${e.incomplete}`);
        break;
      case 'worker.done':
        L.push(`③ worker → ${e.outcome} delivered=${e.delivered} finalClose.pass=${e.finalClosePass} iters=${e.iterations}`);
        break;
      case 'gold.checked':
        L.push(`④ GOLD arbiter → ${e.pass ? 'GREEN' : 'RED'} (exit=${e.exitCode})`);
        break;
      case 'run.deliver':
        L.push(`✅ DELIVER ${e.target}${e.goldChecked ? ' (GOLD-checked)' : ''} grounded=${e.split?.groundedOfTotal ?? '?'}`);
        break;
      case 'run.escalate':
        L.push(`🛑 ESCALATE blocker=${e.escalation?.blocker} decisionReady=${e.decisionReady}${e.why ? ` why=${e.why}` : ''}`);
        if (e.escalation?.decisionNeeded) L.push(`   Q: ${e.escalation.decisionNeeded.question}`);
        break;
      case 'run.end':
        L.push(`── end: ${e.outcome}${e.blocker ? ` (${e.blocker})` : ''}`);
        break;
      default:
        L.push(`? ${e.type} ${JSON.stringify({ ...e, type: undefined, seq: undefined, ts: undefined })}`);
    }
  }
  return L.join('\n');
}
