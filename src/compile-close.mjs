// compile-close.mjs — PRD→close compilation (G1, the crux): turn a PROSE request into a TRUSTED grounded
// close. This is the request-IN end of the goal sentence, and the second half of the thing relayfact owns.
//
// Two phases, structurally enforced (probe-15/F33 shipped): the worker AUTHORS an executable suite from prose
// ONLY (no read tool, no oracle on disk), then relayfact's deterministic validity-gate decides whether to
// TRUST it — before a single line is implemented against it. The author step is INJECTED so the orchestration
// is verifiable token-free (fake author = canned suite); the real author drives `recurse` (authorSuiteViaRecurse,
// built + verified together with the first real-model run — never claimed working unverified).

import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runClose } from './close.mjs';
import { validateSuite } from './validity-gate.mjs';

/**
 * Compile a prose request into a validated grounded close.
 *
 * @param {object} args
 * @param {string} args.workdir - a scratch dir; the suite is authored to `suiteName`, impls swapped at `implName`.
 * @param {string} args.prose - the request, the ONLY thing the author sees.
 * @param {{ reference: string, stub: string, mutants: ({name:string, code:string}|string)[] }} args.oracle
 *   - relayfact-held truth: a correct impl, a no-op stub, and subtle mutants. NEVER on disk during authoring.
 * @param {(a: {prose: string, workdir: string, suitePath: string, implPath: string}) => Promise<void>} args.authorSuite
 *   - writes the suite to `suitePath`. Real = a recurse worker with a write_test tool; fake = a canned suite.
 * @param {number} [args.minKill] - mutants the suite must kill (default 4 of the k=5 canon).
 * @param {string} [args.suiteName]
 * @param {string} [args.implName]
 * @param {string[]} [args.closeCommand] - the close command run against each impl. Default is the PREDICATE
 *   tier (`['node','--test',suiteName]`); an AGENTIC task passes `['node',suiteName]` (an exercise harness).
 *   The SAME command the worker's grounded close will use — so validity is measured on the real close.
 * @returns {Promise<{ ok: boolean, verdict: 'trusted'|'vacuous'|'over-constrained'|'weak-grounding'|'no-suite', validity: object|null, suiteBytes: number }>}
 */
export async function compileClose({ workdir, prose, oracle, authorSuite, minKill = 4, suiteName = 'suite.test.mjs', implName = 'impl.mjs', closeCommand = ['node', '--test', suiteName] }) {
  const suitePath = join(workdir, suiteName);
  const implPath = join(workdir, implName);

  // Phase A — the worker authors the suite from prose alone.
  await authorSuite({ prose, workdir, suitePath, implPath });
  if (!existsSync(suitePath)) return { ok: false, verdict: 'no-suite', validity: null, suiteBytes: 0 };

  // Run the authored suite against a swapped-in impl. The suite imports `implName`; we write each oracle
  // impl there in turn and let exit code decide — the same executable close the loop will later use.
  const codeOf = (m) => (typeof m === 'string' ? m : m.code);
  const runSuiteAgainst = (code) => {
    writeFileSync(implPath, code);
    return runClose(closeCommand, { cwd: workdir });
  };

  const validity = validateSuite({
    runSuiteAgainst,
    referenceImpl: oracle.reference,
    stubImpl: oracle.stub,
    mutants: (oracle.mutants ?? []).map(codeOf),
    minKill,
  });

  // Name the failure mode (probe-15's taxonomy) so escalation is decision-ready, not a bare boolean.
  let verdict;
  if (!validity.stubCatch) verdict = 'vacuous';                         // green on a no-op stub
  else if (!validity.referencePasses) verdict = 'over-constrained';     // rejects a correct impl (SAFE G1 mode)
  else if (validity.mutantsKilled < minKill) verdict = 'weak-grounding';
  else verdict = 'trusted';

  return { ok: validity.passes, verdict, validity, suiteBytes: readFileSync(suitePath, 'utf8').length };
}
