// author.mjs — the LLM author (G1 Phase A): drive a recurse worker to self-author the grounded close.
//
// The ONLY token-spending seam of compile-close. It consumes bareagent (recurse + wireGate + Stream +
// Anthropic provider) and bareguard (Gate, via the caller) — relayfact builds no engine here; it supplies
// the persona (senior-engineer, write-a-suite-only stance), the write-scoped tool, and the deterministic
// `sensor` (the caller's grounded close). Graduated from poc/probe-15 (F33), verified by the live run.

import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { recurse, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');

// PREDICATE tier — the author writes a `node:test` suite over the source (the default, most tasks).
export const AUTHOR_PERSONA = [
  'You are a meticulous senior engineer. Do NOT implement anything. Write ONLY an executable test suite',
  "for the request. Use `import { test } from 'node:test'` and `import assert from 'node:assert/strict'`,",
  "and import the function under test from './impl.mjs'. Be THOROUGH: one test per acceptance criterion,",
  'plus the boundary and edge cases a correct implementation must handle. The suite is the definition of',
  'done — strong enough that a wrong implementation cannot pass it, but NEVER asserting behavior the request',
  'leaves unspecified (that would reject a correct implementation).',
].join(' ');

// AGENTIC tier — the author writes an EXERCISE HARNESS that DEPLOYS the artifact and probes it over the wire
// (exit code = truth), not a `node:test` suite. Used for tasks whose artifact is a running service.
export const AUTHOR_PERSONA_AGENTIC = [
  'You are a meticulous senior engineer. Do NOT implement the service. Write ONLY an executable EXERCISE',
  "HARNESS (a plain script, NOT a node:test file). Import `{ createApp }` from './server.mjs', start it with",
  '`const server = createApp(); await new Promise(r => server.listen(0, r));` and read the port from',
  '`server.address().port`. Probe it over REAL HTTP with `fetch` against `http://127.0.0.1:<port>`, asserting',
  'each acceptance criterion by checking the status code and parsed JSON body. Exit 0 only if every probe',
  'passes; on the first failure print a diagnostic to stderr and exit 1. Guard against hangs (an overall',
  'watchdog `setTimeout(()=>process.exit(1), 8000).unref()` and per-request `AbortSignal.timeout`) and always',
  'close the server. Be THOROUGH: one probe per acceptance criterion plus edge cases; but NEVER assert',
  'behavior the request leaves unspecified. End with `process.exit(code)`.',
].join(' ');

/** Build an Anthropic provider from an API key (thin passthrough — relayfact owns no provider). */
export function makeProvider({ apiKey, model }) {
  return new Anthropic({ apiKey, model });
}

/**
 * Author the suite at `target` by driving a maxDepth:0 recurse worker whose only tool writes that file.
 *
 * @param {object} args
 * @param {string} args.prose - the request (the ONLY thing the worker sees; no read tool).
 * @param {string} args.target - absolute path the suite is written to (fixed — the worker's path arg is ignored).
 * @param {object} args.provider - a bareagent provider (see makeProvider).
 * @param {object} args.gate - an initialised bareguard Gate (caps + write-scope + audit).
 * @param {(result:any, ctx:object) => (object|Promise<object>)} args.sensor - relayfact's deterministic close
 *   for the leaf (a Verdict): the suite must exist AND a correct impl must pass it (the in-loop over-constraint
 *   guard). NOT a model judge (R-S8).
 * @param {number[]} [args.temperatures] - refineLeaf escalation schedule.
 * @param {string} [args.toolName]
 * @param {string} [args.persona] - the author stance. Default = PREDICATE (`node:test` suite); pass
 *   AUTHOR_PERSONA_AGENTIC for an exercise-harness close (agentic tier).
 * @param {string} [args.artifactNoun] - what the author is writing, for the task wording ("test suite" |
 *   "exercise harness"). Cosmetic; the persona is what steers the shape.
 * @returns {Promise<{ ok: boolean, iterations: number|null, verdict: object|null }>}
 */
export async function authorSuiteViaRecurse({ prose, target, provider, gate, sensor, temperatures = [0.2, 0.5, 0.7], toolName = 'write_test', persona = AUTHOR_PERSONA, artifactNoun = 'test suite' }) {
  const editTool = {
    name: toolName,
    description: `Write the ${basename(target)} file. Pass the full file contents in "contents". Returns {ok,bytes}.`,
    parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['contents'] },
    execute: async ({ contents }) => { writeFileSync(target, contents); return { ok: true, bytes: contents.length, wrote: basename(target) }; },
  };
  // FIXED path — ignore any path the worker passes (F19/F20: workers guess wrong paths). The gate's writeScope
  // is pinned to `target`, so a stray path is denied anyway; this makes the intent explicit.
  const actionTranslator = (name, args, ctx) => (name === toolName ? { type: 'write', path: target, args, _ctx: ctx } : { type: name, args, _ctx: ctx });
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const stream = new Stream();

  const task = `Write the ${artifactNoun} for this request:\n\n${prose}\n\nWrite ONLY ${basename(target)} via ${toolName}. Do not implement the solution itself.`;
  const result = await recurse(
    task,
    { provider, policy, onLlmResult, stream },
    { persona, tools: [editTool], maxDepth: 0, refineLeaf: { sensor, temperatures } },
  );
  return { ok: true, iterations: result?.receipts?.refineLeaf?.iterations ?? null, verdict: result?.verdict ?? null };
}
