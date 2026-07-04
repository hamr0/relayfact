// close.mjs — the grounded close (PRD §5 doctrine anchor): run a real command, exit code = truth.
//
// This is the ONE thing relayfact is doctrinally allowed to own (the grounded close + PRD→close
// compilation). It supplies the BODY of bareagent's eval seam — `recurse`'s `opts.evaluate` and
// `refineLeaf.sensor` both return a bareagent `Verdict`, so this maps a finished process → that Verdict.
//
// The Verdict tri-state is load-bearing (from bareagent/src/evaluator.js):
//   satisfied      → done. pass=true. the loop closes GREEN.
//   needs_revision → a normal test failure: RETRYABLE. the worker gets `critique` (the gap) and tries again.
//   failed         → TERMINAL: the close itself could not produce a verdict (command couldn't run / was
//                    killed). refine STOPS spending — relayfact escalates rather than spinning on a broken close.

import { spawnSync } from 'node:child_process';

/** @typedef {import('../types').Verdict} Verdict */ // bareagent's shape; extra exitCode/output are relayfact log fields.

/**
 * Map a finished child process to a bareagent `Verdict`. Pure (no spawning) so the exit→status mapping is
 * unit-testable without launching anything — this is where the retryable/terminal distinction is decided.
 *
 * @param {{status: number|null, signal: string|null, error?: Error|null, output?: string}} proc
 * @returns {Verdict & { exitCode: number|null, output: string }}
 */
export function verdictFromExit({ status, signal = null, error = null, output = '' }) {
  // The close could not run to a clean exit → TERMINAL. A boolean "false" would tell refine to retry; that
  // would spin forever against a broken harness. `failed` tells it to stop and escalate.
  if (error || signal || status === null) {
    const why = error ? `close command could not run: ${error.message}` : `close command killed by signal ${signal}`;
    return { status: 'failed', pass: false, score: null, critique: why, suggestions: [], exitCode: status ?? null, output };
  }
  if (status === 0) {
    return { status: 'satisfied', pass: true, score: null, critique: '', suggestions: [], exitCode: 0, output };
  }
  // Tests ran and something failed — the worker can fix it. Feed the output back as the gap (`critique`).
  return { status: 'needs_revision', pass: false, score: null, critique: output || `close exited ${status}`, suggestions: [], exitCode: status, output };
}

/**
 * Run a grounded close command and return its `Verdict`. Array form only — NO shell, so there is no command
 * injection surface (aligns with the bareguard no-shell stance).
 *
 * @param {string[]} command - e.g. `['node', '--test', 'test/examples.test.js']`.
 * @param {{cwd?: string, timeout?: number, env?: object}} [opts]
 * @returns {Verdict & { exitCode: number|null, output: string }}
 */
export function runClose(command, { cwd, timeout = 60_000, env } = {}) {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error('close command must be a non-empty array [cmd, ...args] (no shell string)');
  }
  const [cmd, ...args] = command;
  const r = spawnSync(cmd, args, { cwd, timeout, env, encoding: 'utf8' });
  const output = [r.stdout, r.stderr].filter(Boolean).join('\n').trim();
  return verdictFromExit({ status: r.status, signal: r.signal, error: r.error, output });
}
