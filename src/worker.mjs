// worker.mjs — the gated worker (PRD §8 v2, step 3): implement against a grounded close, through the leash.
//
// Given a validated close (from compile-close) and a task, drive a maxDepth:0 recurse worker whose only
// mutating tool (`edit_file`) is write-scoped by a bareguard Gate. The GLOBAL top predicate (`opts.evaluate`)
// AND the leaf sensor (`refineLeaf.sensor`) are the SAME deterministic close — exit code = truth — so a failed
// attempt feeds its gap forward and retries, and an UNSATISFIABLE close can never be faked green (the worker
// cannot edit the suite; the gate denies it). Graduated from poc/probe-16 (F36). relayfact owns persona +
// the close + the fixed write path; recurse owns the worker Loop.
//
// Deferred (logged, NOT silently dropped): multi-file `resolveIn` targeting (probe-16's shell_read + path
// resolution for real repos) and the litectx close-driven recall widening (D3) — both are follow-ons WITHIN
// step 3; this cut is the single-file gated implement loop closed by a test that can fail.

import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { writeFileSync } from 'node:fs';
import { runClose } from './close.mjs';

const require = createRequire(import.meta.url);
const { recurse, wireGate, Stream } = require('bare-agent');

const IMPL_PERSONA = [
  'You are a senior engineer. Implement the code so the project test suite passes. Make the SMALLEST correct',
  'change. When a test fails you will be told what failed — fix the SOURCE, never the test (you cannot edit',
  'the test). Save your code by calling edit_file with the FULL file contents. Vanilla JS, no dependencies.',
].join(' ');

/**
 * Pure delivery decision: the loop DELIVERS only when the authoritative final close is green AND the run did
 * not stop incomplete. Green-but-incomplete or never-green ⇒ escalate. (No rubric here — the test decides.)
 * @param {{ finalClose: {pass: boolean}, incomplete: boolean }} args
 * @returns {{ delivered: boolean, outcome: 'delivered'|'escalated-incomplete'|'escalated-red' }}
 */
export function deliveryDecision({ finalClose, incomplete }) {
  const delivered = !!(finalClose?.pass && !incomplete);
  const outcome = delivered ? 'delivered' : incomplete ? 'escalated-incomplete' : 'escalated-red';
  return { delivered, outcome };
}

/**
 * Run the gated implement loop against a grounded close.
 *
 * @param {object} args
 * @param {string} args.task - the implement instruction (prose) shown to the worker.
 * @param {string} args.workdir - cwd the close runs in.
 * @param {string} args.target - absolute path the worker's edits are pinned to (fixed — path arg ignored).
 * @param {string[]} args.closeCommand - the grounded close, e.g. `['node','--test','suite.test.mjs']`.
 * @param {object} args.provider - a bareagent provider.
 * @param {object} args.gate - an initialised bareguard Gate (writeScope MUST include `target`, exclude the suite).
 * @param {string} [args.persona]
 * @param {number[]} [args.temperatures]
 * @returns {Promise<{ delivered: boolean, outcome: string, verdict: object|null, finalClose: object, incomplete: boolean, iterations: number|null }>}
 */
export async function implementAgainstClose({ task, workdir, target, closeCommand, provider, gate, persona = IMPL_PERSONA, temperatures = [0.2, 0.4, 0.6, 0.8] }) {
  const editTool = {
    name: 'edit_file',
    description: `Write ${basename(target)} with the FULL file contents in "contents". Returns {ok,bytes}.`,
    parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['contents'] },
    execute: async ({ contents }) => { writeFileSync(target, contents); return { ok: true, bytes: contents.length, wrote: basename(target) }; },
  };
  const actionTranslator = (name, args, ctx) => (name === 'edit_file' ? { type: 'write', path: target, args, _ctx: ctx } : { type: name, args, _ctx: ctx });
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const stream = new Stream();

  // The one close, used for both the top global predicate and the leaf sensor. On failure, enrich the
  // critique so the gap fed back tells the worker to fix the SOURCE (it cannot touch the test).
  const close = () => {
    const v = runClose(closeCommand, { cwd: workdir });
    if (v.pass) return v;
    return { ...v, critique: `The close still fails. Fix the SOURCE (never the test). Failing output:\n${(v.output || '').slice(0, 1400)}` };
  };

  const result = await recurse(
    task,
    { provider, policy, onLlmResult, stream },
    { persona, tools: [editTool], maxDepth: 0, evaluate: () => close(), refineLeaf: { sensor: () => close(), temperatures } },
  );

  // Authoritative final close — never trust the loop's own report; re-run the test on the delivered artifact.
  const finalClose = runClose(closeCommand, { cwd: workdir });
  const incomplete = !!result?.incomplete;
  const { delivered, outcome } = deliveryDecision({ finalClose, incomplete });
  return { delivered, outcome, verdict: result?.verdict ?? null, finalClose, incomplete, iterations: result?.receipts?.refineLeaf?.iterations ?? null };
}
