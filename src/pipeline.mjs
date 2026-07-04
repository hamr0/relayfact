// pipeline.mjs — the assembled pipe (PRD-v3 §5 / §5.1 / G5-EXIT): a prose request + a repo go IN; a
// DELIVERED green artifact or a decision-ready `run.escalate` comes OUT — and every step is narrated to the
// append-only event log a pure-listener observer renders. This is the capstone that turns the four proven
// pieces into "the thing"; it builds no new engine — it only COMPOSES:
//
//   ① pre-flight (preflight.mjs)      — rubric may OPEN HITL {clarify|decline}, it may NEVER close green
//   ② compile the close (compile-close.mjs) — the worker self-authors a suite from prose; relayfact's
//                                       deterministic validity-gate decides TRUST before a line is implemented
//   ③ gated worker (worker.mjs)       — recurse() edits the impl through the bareguard leash; the SAME
//                                       grounded close is opts.evaluate (global top) AND refineLeaf.sensor
//   ④ deliver / escalate              — own-green is necessary; the INDEPENDENT GOLD (D5, the standing
//                                       arbiter the worker never sees) is the only guard against fit-to-pass
//
// The three token-spending stages are INJECTABLE (`deps`) so the whole control flow — every escalation
// branch and the D5 GOLD tripwire — is exercised token-free; the live e2e wiring is proven separately in
// test/integration/pipeline.live.test.js. Memory (litectx close-driven widening, D3) is deliberately NOT
// wired here — it is its own careful session (memory is where the probes got caught fit-to-pass).

import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runClose } from './close.mjs';
import { preflight as realPreflight } from './preflight.mjs';
import { compileClose as realCompileClose } from './compile-close.mjs';
import { implementAgainstClose as realImplement } from './worker.mjs';
import { buildEscalation, isDecisionReady } from './escalation.mjs';

/** Best-effort spend read from the bareguard gate (audit-derived); 0 when no gate (token-free tests). */
async function costOf(gate) {
  try { return (await gate?.haltContext?.())?.spent?.costUsd ?? 0; } catch { return 0; }
}

/** The per-task grounded/rubric split — the §1 secondary-goal number, REPORTED not gated (G5-EXIT). */
function criteriaSplit() {
  // One deterministic close (predicate, exit code = truth) grounds delivery; pre-flight is the one rubric,
  // and it can only OPEN a stop — it never counts toward "done". So a delivered task is 1/1 grounded.
  return { grounded: 1, rubric: 1, total: 1, groundedOfTotal: '1/1' };
}

/**
 * Run a prose request through the assembled pipe.
 *
 * @param {object} a
 * @param {string} a.request - the prose request (the ONLY thing pre-flight + the author see).
 * @param {string} a.workdir - scratch/repo dir the close and GOLD run in.
 * @param {string} a.target - absolute path the worker's edits are pinned to (the impl).
 * @param {{reference:string, stub:string, mutants:any[]}} a.oracle - relayfact-held validity truth (compile-close).
 * @param {{name:string, source:string}|null} [a.goldSuite] - the INDEPENDENT GOLD (D5). Written only AFTER the
 *   worker is done, so it is never visible to it. Omit only when a task has no hidden arbiter (claim shrinks).
 * @param {(x:{prose:string,workdir:string,suitePath:string,implPath:string})=>Promise<void>} [a.authorSuite]
 *   - the token-spending suite author (see author.mjs). Required unless deps.compileClose is injected.
 * @param {object} [a.provider] - a bareagent provider (pre-flight + author + worker). Omit when all deps faked.
 * @param {object} [a.gate] - an initialised bareguard Gate for the worker (write-scoped to `target`).
 * @param {{emit:Function}} a.log - the event log (event-log.mjs).
 * @param {string} [a.suiteName]
 * @param {string} [a.implName]
 * @param {{preflight?:Function, compileClose?:Function, implement?:Function}} [a.deps] - injectable seams.
 * @returns {Promise<{outcome:string, delivered:boolean, escalation?:object, decisionReady?:boolean, target?:string, split?:object, worker?:object, gold?:object|null}>}
 */
export async function runRequest({
  request, workdir, target, oracle, goldSuite = null, authorSuite,
  provider, gate, log, suiteName = 'suite.test.mjs', implName = 'impl.mjs', deps = {},
}) {
  const emit = (t, p) => log?.emit(t, p);
  const preflight = deps.preflight ?? realPreflight;
  const compileClose = deps.compileClose ?? realCompileClose;
  const implement = deps.implement ?? realImplement;
  const closeCommand = ['node', '--test', suiteName];

  // A come-back is only allowed OUT if a human can act on it without the raw log — assert, then narrate.
  const finishEscalate = (escalation) => {
    const chk = isDecisionReady(escalation);
    emit('run.escalate', { escalation, decisionReady: chk.ok, why: chk.why ?? null });
    emit('run.end', { outcome: 'escalated', blocker: escalation.blocker });
    return { outcome: 'escalated', delivered: false, escalation, decisionReady: chk.ok };
  };

  emit('run.start', { request, workdir, target });

  // ① PRE-FLIGHT — rubric opens HITL, never closes. Non-proceed ⇒ come back BEFORE spending (0 cost).
  const pf = await preflight(request, { provider });
  emit('preflight', { verdict: pf.verdict, reason: pf.reason, questions: pf.questions ?? [] });
  if (pf.verdict !== 'proceed') {
    return finishEscalate(buildEscalation({
      goal: request, blocker: 'preflight-declined', costSpent: 0,
      detail: pf.verdict === 'clarify' ? 'underspecified — questions attached' : (pf.reason || 'declined'),
    }));
  }

  // ② COMPILE THE CLOSE — the worker authors the suite from prose; relayfact's validity-gate decides TRUST.
  const compiled = await compileClose({ workdir, prose: request, oracle, authorSuite, suiteName, implName });
  emit('close.compiled', { verdict: compiled.verdict, ok: compiled.ok, suiteBytes: compiled.suiteBytes, validity: compiled.validity });
  if (!compiled.ok) {
    return finishEscalate(buildEscalation({
      goal: request, blocker: 'close-untrustworthy', costSpent: await costOf(gate), detail: compiled.verdict,
      whatWasTried: [{ attempt: 'self-authored a grounded suite from the prose alone', verdict: compiled.verdict,
        gap: `validity-gate rejected the authored close as "${compiled.verdict}" (stubCatch=${compiled.validity?.stubCatch}, referencePasses=${compiled.validity?.referencePasses}, mutantsKilled=${compiled.validity?.mutantsKilled})` }],
    }));
  }

  // ③ GATED WORKER on recurse() — the SAME close is the top global predicate AND the leaf sensor (worker.mjs).
  const w = await implement({ task: request, workdir, target, closeCommand, provider, gate });
  emit('receipts', { verdict: w.verdict, iterations: w.iterations, incomplete: w.incomplete });
  emit('worker.done', { outcome: w.outcome, delivered: w.delivered, finalClosePass: !!w.finalClose?.pass, iterations: w.iterations });
  if (!w.delivered) {
    const blocker = w.incomplete ? 'budget-cap' : 'close-exhausted';
    return finishEscalate(buildEscalation({
      goal: request, blocker, costSpent: await costOf(gate),
      whatWasTried: [{ attempt: 'implemented against the grounded close, feeding each failure back', verdict: w.finalClose?.status ?? 'needs_revision',
        gap: String(w.finalClose?.output || w.finalClose?.critique || 'the grounded close stayed red within the attempt budget').slice(0, 800) }],
    }));
  }

  // ④ D5 — THE STANDING ARBITER. own-green is necessary, NOT sufficient: run the INDEPENDENT GOLD (which the
  // worker never saw — written only now). own-green + GOLD-red is the ONE fit-to-pass mode the reference gate
  // cannot see, so it can NEVER deliver. This guard stays permanently (not a probe to retire).
  let gold = null;
  if (goldSuite) {
    writeFileSync(join(workdir, goldSuite.name), goldSuite.source);
    gold = runClose(['node', '--test', goldSuite.name], { cwd: workdir });
    emit('gold.checked', { pass: gold.pass, exitCode: gold.exitCode });
    if (!gold.pass) {
      return finishEscalate(buildEscalation({
        goal: request, blocker: 'gold-mismatch', costSpent: await costOf(gate),
        whatWasTried: [{ attempt: 'delivered an impl that passes its OWN self-authored close', verdict: 'gold-red',
          gap: String(gold.output || 'the independent GOLD test failed on the delivered artifact').slice(0, 800) }],
      }));
    }
  }

  const split = criteriaSplit();
  emit('run.deliver', { target, outcome: 'delivered', goldChecked: !!goldSuite, split });
  emit('run.end', { outcome: 'delivered' });
  return { outcome: 'delivered', delivered: true, target, worker: w, gold, split };
}
