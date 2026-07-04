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
