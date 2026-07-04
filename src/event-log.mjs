// event-log.mjs — the event-stream spine (PRD §7).
//
// The ONE place a run's events are written. Every event is stamped `{ ...payload, type, seq, ts }` and
// appended to a JSONL file; `seq` is a monotonic in-process counter (single-process doctrine — no
// cross-process sequencing needed). Every UI/observer is a PURE LISTENER that reads the persisted file and
// NEVER imports this module (see observer.mjs — the §7 invariant, structurally tested).
//
// Graduation note vs `poc/`: the probes wrapped bare-agent's `JsonlTransport`. An append-only JSONL log is
// stdlib in <100 lines, so per AGENT_RULES' dependency hierarchy (vanilla → stdlib → external only when
// stdlib can't) the spine is stdlib `node:fs` — which also DECOUPLES the narration substrate from the
// engine, exactly what §7 requires. relayfact still builds no engine primitive here; it owns only the
// seq/ts/type stamping (a thin composition, not a lib).

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Create an append-only event log at `path`.
 *
 * @param {string} path - JSONL file the events are appended to (parent dirs created).
 * @param {object} [opts]
 * @param {() => string} [opts.clock] - injectable timestamp source (ISO string). Injected so callers/tests
 *   are deterministic; defaults to wall-clock ISO.
 * @returns {{ emit(type: string, payload?: object): object, close(): void, path: string, count: number }}
 */
export function createEventLog(path, { clock = () => new Date().toISOString() } = {}) {
  if (typeof path !== 'string' || !path) throw new Error('event log path must be a non-empty string');
  mkdirSync(dirname(path), { recursive: true });
  let seq = 0;
  let closed = false;

  function emit(type, payload = {}) {
    if (closed) throw new Error('cannot emit on a closed event log');
    if (typeof type !== 'string' || !type) throw new Error('event type must be a non-empty string');
    if (payload === null || typeof payload !== 'object') throw new Error('event payload must be an object');
    // Spine fields are stamped LAST so a stray payload key (type/seq/ts) can NEVER clobber the spine's
    // own record — the sequencing is the spine's to own, not the caller's (a hardening over the POC emit).
    const ev = { ...payload, type, seq: seq++, ts: clock() };
    appendFileSync(path, JSON.stringify(ev) + '\n');
    return ev;
  }

  return {
    emit,
    close() { closed = true; },
    get path() { return path; },
    get count() { return seq; },
  };
}
