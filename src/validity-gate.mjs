// validity-gate.mjs — the G1 honesty machinery: is a self-authored close TRUSTWORTHY before we run on it?
//
// The R-S8 trap relocates one level up when the agent writes its own test suite: a weak/rigged suite closes
// green on wrong code and grounds nothing. G1 (probe-15, F33) proved two deterministic guards catch the two
// failure modes; this is their shipped `src/` form. Pure over an INJECTED suite-runner so the logic is
// unit-testable without spawning — the real runner is close.mjs's runClose against each impl file.
//
//   over-constraint (agent invents assertions prose never specified) → the REFERENCE gate catches it:
//       a known-correct impl MUST pass the suite. If it doesn't, the suite is wrong, not the impl. (SAFE mode.)
//   fit-to-pass    (suite green on wrong code)                        → the STUB + MUTANT gates catch it:
//       green on a no-op stub is rejected; the suite must KILL subtle mutants of the reference.
//   the mode the reference gate CANNOT see (own-suite-green + independent-GOLD-red) is guarded separately by
//       arbitrate() below — the standing GOLD arbiter (descope D5, permanent, not a one-time spike).

/** @typedef {{ pass: boolean }} VerdictLike */

/**
 * Validate a self-authored suite before trusting it as the grounded close.
 *
 * @param {object} args
 * @param {(implRef: any) => VerdictLike} args.runSuiteAgainst - runs the suite against one impl → a Verdict.
 * @param {any} args.referenceImpl - a hidden known-correct impl (the "a correct impl MUST pass" guard).
 * @param {any} args.stubImpl - a no-op stub (the "must not be green on nothing" guard).
 * @param {any[]} args.mutants - subtle wrong variants of the reference (the real teeth — must be killed).
 * @param {number} [args.minKill] - mutants that must die. Default 4 (of the canonical k=5: 1 no-op + 4 subtle).
 * @returns {{ passes: boolean, stubCatch: boolean, referencePasses: boolean, mutantsKilled: number, mutantTotal: number, killRate: number, reasons: string[] }}
 */
export function validateSuite({ runSuiteAgainst, referenceImpl, stubImpl, mutants = [], minKill = 4 }) {
  if (typeof runSuiteAgainst !== 'function') throw new Error('runSuiteAgainst must be a function');
  const reasons = [];

  const stubCatch = runSuiteAgainst(stubImpl).pass === false;            // stub must FAIL the suite
  if (!stubCatch) reasons.push('suite is green against a no-op stub (grounds nothing)');

  const referencePasses = runSuiteAgainst(referenceImpl).pass === true;  // reference must PASS the suite
  if (!referencePasses) reasons.push('a known-correct impl does NOT pass the suite (over-constrained)');

  const mutantTotal = mutants.length;
  let mutantsKilled = 0;
  for (const m of mutants) if (runSuiteAgainst(m).pass === false) mutantsKilled++;  // a killed mutant = suite caught it
  const killRate = mutantTotal ? mutantsKilled / mutantTotal : 0;
  if (mutantsKilled < minKill) reasons.push(`suite killed only ${mutantsKilled}/${mutantTotal} mutants (need ≥${minKill})`);

  const passes = stubCatch && referencePasses && mutantsKilled >= minKill;
  return { passes, stubCatch, referencePasses, mutantsKilled, mutantTotal, killRate, reasons };
}

/**
 * Count the grounded/rubric split of a criteria→eval map (the §1 secondary-goal number — REPORTED, not gated).
 * Grounded = predicate|agentic (deterministic/exercised); residue = rubric|none (the HITL boundary).
 *
 * @param {{criterion: string, eval: 'predicate'|'agentic'|'rubric'|'none'}[]} criteriaMap
 * @returns {{ N: number, M: number, grounded: string[], residue: string[] }}
 */
export function countGrounded(criteriaMap = []) {
  const grounded = [], residue = [];
  for (const c of criteriaMap) (['predicate', 'agentic'].includes(c.eval) ? grounded : residue).push(c.criterion);
  return { N: grounded.length, M: criteriaMap.length, grounded, residue };
}

/**
 * The standing GOLD arbiter (descope D5). Given the produced artifact's own-close verdict and an INDEPENDENT
 * hidden GOLD verdict (fresh values the prose never listed), decide whether to deliver — and flag the one
 * mode no other guard can see: own-suite-green while GOLD is red = FIT-TO-PASS. That is never delivered.
 *
 * @param {{ ownClose: VerdictLike, gold: VerdictLike }} args
 * @returns {{ deliver: boolean, fitToPass: boolean, escalate: boolean, reason: string }}
 */
export function arbitrate({ ownClose, gold }) {
  if (ownClose.pass && gold.pass) return { deliver: true, fitToPass: false, escalate: false, reason: 'own close green AND independent GOLD green' };
  if (ownClose.pass && !gold.pass) return { deliver: false, fitToPass: true, escalate: true, reason: 'FIT-TO-PASS: own suite green but independent GOLD red — the unsafe mode; never deliver' };
  return { deliver: false, fitToPass: false, escalate: true, reason: 'own close not green — keep refining or escalate' };
}
