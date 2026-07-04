// escalation.mjs — the come-back (G3, PRD §5): when the loop STOPS, the human gets ONE decision-ready report,
// never a raw `{incomplete}`. Fully deterministic (no tokens). Graduated from poc/probe-17 (F38).
//
// A `run.escalate` artifact = { goal, blocker(which §5 trigger), whatWasTried[], decisionNeeded{question,
// options}, receipts, costSpent }. `isDecisionReady` is the CONTROL THAT CAN FAIL: it rejects a bare
// {incomplete}, a <2-option report, and an attempt-bearing stop with an empty/gapless whatWasTried — so a
// "come-back" that a human cannot act on is caught, not shipped.

/** The §5 stop-classes → the concrete question + options a human is asked. */
export const DECISION = {
  'close-exhausted':    { question: 'The worker could not make the grounded test pass within its attempt budget. How should I proceed?',
                          options: ['raise the attempt/temperature budget', 'refine the spec/close', 'take it from here manually', 'drop this task'] },
  'budget-cap':         { question: 'The cost cap tripped before the work closed. Raise the budget or stop?',
                          options: ['raise the budget and continue', 'stop here', 'narrow the scope'] },
  'governance-deny':    { question: 'The gate repeatedly denied a required action (policy/write-scope). Widen the policy or stop?',
                          options: ['widen the write-scope/policy', 'do this step manually', 'drop this task'] },
  'rubric-uncertain':   { question: 'The grounded test is green but a judgment call (matches intent?) is unresolved. Confirm or revise?',
                          options: ['confirm — accept as-is', 'revise the requirement', 'pin the criterion in the spec and re-run'] },
  'preflight-declined': { question: 'Before spending, this request did not look actionable. Clarify it, or drop it?',
                          options: ['answer the clarifying questions', 'rephrase the request', 'drop this request'] },
  'close-untrustworthy':{ question: 'The self-authored grounded close could not be trusted (it did not ground the work safely). Refine the spec, or supply the test yourself?',
                          options: ['refine/clarify the spec so a trustworthy close can be authored', 'provide the acceptance test yourself', 'drop this task'] },
  'gold-mismatch':      { question: 'The delivered code passes its own authored close but FAILS the independent GOLD check (a fit-to-pass gap). How should I proceed?',
                          options: ['strengthen the spec/close and re-run', 'take it from here manually', 'drop this task'] },
};

// Stops that came from REAL execution must show what was tried; a pre-flight decline legitimately has none
// (it stopped at 0 spend, before any attempt). close-untrustworthy follows the AUTHOR attempt; gold-mismatch
// follows a full worker delivery — both are attempt-bearing.
export const ATTEMPT_BEARING = ['close-exhausted', 'budget-cap', 'governance-deny', 'rubric-uncertain', 'close-untrustworthy', 'gold-mismatch'];

/**
 * Assemble a decision-ready escalation artifact.
 * @param {{ goal: string, blocker: string, whatWasTried?: object[], receipts?: any[], costSpent?: number, detail?: string|null }} a
 */
export function buildEscalation({ goal, blocker, whatWasTried = [], receipts = [], costSpent = 0, detail = null }) {
  const d = DECISION[blocker];
  const decisionNeeded = d ? { question: detail ? `${d.question} (${detail})` : d.question, options: d.options } : null;
  return { goal, blocker, whatWasTried, decisionNeeded, receipts, costSpent };
}

/**
 * The control that can fail: is this artifact something a human can act on WITHOUT reading the raw log?
 * @returns {{ ok: boolean, why?: string }}
 */
export function isDecisionReady(a) {
  if (!a || typeof a !== 'object') return { ok: false, why: 'not an object' };
  if (!String(a.goal || '').trim()) return { ok: false, why: 'no goal' };
  if (!(a.blocker in DECISION)) return { ok: false, why: `unknown blocker: ${a.blocker}` };
  if (!a.decisionNeeded || !String(a.decisionNeeded.question || '').trim()) return { ok: false, why: 'no decision question' };
  if (!Array.isArray(a.decisionNeeded.options) || a.decisionNeeded.options.length < 2) return { ok: false, why: 'need >=2 options' };
  if (typeof a.costSpent !== 'number') return { ok: false, why: 'no costSpent' };
  if (!Array.isArray(a.receipts)) return { ok: false, why: 'no receipts' };
  if (!Array.isArray(a.whatWasTried)) return { ok: false, why: 'no whatWasTried' };
  if (ATTEMPT_BEARING.includes(a.blocker)) {
    if (a.whatWasTried.length < 1) return { ok: false, why: 'attempt-bearing stop with empty whatWasTried' };
    if (!a.whatWasTried.every((w) => 'verdict' in w && String(w.gap || '').trim())) return { ok: false, why: 'an attempt is missing its verdict/gap' };
  }
  return { ok: true };
}
