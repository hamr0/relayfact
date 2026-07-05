// memory.mjs — close-driven recall widening over a BOUNDED candidate set (PRD-v3 D3 / F26/F27/F29).
//
// The one memory thing relayfact OWNS: the widening POLICY, the candidate FRAMING, and the BOUND. litectx
// owns the store + BM25 ranking (consumed, not built). The doctrine this encodes, learned the hard way (the
// probe-06/07/08 fit-to-pass retraction, then F26/F27/F29):
//
//   Retrieval ranks on SIMILARITY, not CORRECTNESS — a length-matched, same-vocabulary WRONG "twin" can
//   outrank the right rule (verified: F26), so a rank-trusting top-k STARVES the worker of the right note
//   (F27). Ranking can NEVER be the correctness discriminator. The fix follows the thesis — *recall proposes,
//   the executable close disposes*:
//     FIX-1 (retrieval): don't trust rank. Let the GROUNDED CLOSE drive recall — on each FAILED close, WIDEN
//                        the candidate window (base → cap), framed "unverified candidates; the test decides".
//                        The close, not the ranking, selects which memory applies.
//     FIX-2 (transfer):  store the lesson as an explicit RULE + example, NOT verbatim code / the literal
//                        answer — so recall surfaces a rule the worker must still APPLY, and the close (not
//                        the note) is what closes the loop. A note that contained the answer would be
//                        fit-to-pass; this module refuses to be that.
//
// THE BOUND (D3, non-negotiable): widening is capped at `cap` — a BOUNDED candidate set. Widening stays sound
// only for a bounded pool; beyond it, unbounded-store retrieval quality is an OPEN CAVEAT (F26/F27) relayfact
// does NOT claim to solve. This module lets the close reach *past* rank within the bound; it does not fix rank.

/**
 * Store a self-improvement lesson as a rule-framed litectx `fact` (kind:'fact' is BM25-rankable; `episode`
 * scores ~0 under distractor load — memory note, verified). The body MUST be a transferable RULE, never the
 * verbatim answer for the task at hand (FIX-2). This function cannot enforce "is a rule" semantically, but the
 * D3 tests assert the surfaced note does not contain a task's literal answer — the standing fit-to-pass guard.
 *
 * @param {object} lc - a litectx instance.
 * @param {{ name: string, rule: string }} lesson
 * @returns {Promise<string>} the stored note's name.
 */
export async function rememberLesson(lc, { name, rule }) {
  if (!name || typeof name !== 'string') throw new Error('a lesson needs a non-empty name');
  if (!rule || typeof rule !== 'string') throw new Error('a lesson needs a rule body');
  await lc.remember(name, rule, { kind: 'fact' });
  return name;
}

/**
 * Frame recalled notes as UNVERIFIED candidates the executable test arbitrates — the doctrine framing that
 * keeps the close (not the ranking, not the note) the discriminator. Empty in → empty out (no noise appended
 * when nothing was recalled).
 *
 * @param {{name: string, body: string}[]} candidates
 * @returns {string} text to append to a failing close's critique (or '' when there are none).
 */
export function frameCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  return '\n\nUnverified candidate notes from memory — the TEST decides which one is right; ignore any that '
    + "don't make the test pass:\n"
    + candidates.map((c, i) => `(${i + 1}) [${c.name}] ${c.body}`).join('\n');
}

/**
 * Compute the widened window size for a given failed-close attempt. Pure so the widening SCHEDULE is unit-
 * tested without a store: base on the first failure, growing by `base` each retry, hard-capped at `cap`.
 *
 * @param {number} attempt - 1-based failed-close count.
 * @param {{base?: number, cap?: number}} [opts]
 * @returns {number}
 */
export function windowFor(attempt, { base = 3, cap = 6 } = {}) {
  return Math.min(cap, base * Math.max(1, attempt | 0));
}

/**
 * Build a close-driven recall widener over a bounded candidate set. Returns a function called on each FAILED
 * close: it recalls up to `cap` candidates (the BOUND) and returns the first `windowFor(attempt)` of them,
 * already framed. The close drives `attempt`; the widener never exceeds `cap` (D3).
 *
 * @param {object} lc - a litectx instance.
 * @param {{base?: number, cap?: number}} [opts]
 * @returns {(query: string, attempt: number) => Promise<{window: number, candidates: {name,body}[], text: string, rankOf: (name:string)=>number}>}
 */
export function makeWidener(lc, { base = 3, cap = 6 } = {}) {
  return async function widen(query, attempt) {
    const window = windowFor(attempt, { base, cap });
    const hits = await lc.recall(query, { kind: 'fact', n: cap, body: true }); // bounded pull — never the whole store
    const ranked = hits.map((h) => ({ name: h.path, body: h.body }));
    const candidates = ranked.slice(0, window);
    return {
      window,
      candidates,
      text: frameCandidates(candidates),
      rankOf: (name) => ranked.findIndex((c) => c.name === name),
    };
  };
}
