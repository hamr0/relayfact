#!/usr/bin/env node
// probe-02-gate-check — prove the gate ENFORCES, not just that it passes legit actions.
//
// probe-02's sum/csv runs showed every action allowed (rule:"default") — because every action was
// legit. That proves the happy path and nothing more: an inert gate that allowed everything would
// log identically. This probe is the negative control: actions that MUST be denied, asserted to be
// denied, through the exact wired path (wireGate's translator + gate.check). It exits non-zero if any
// assertion fails — the check itself can fail. No LLM, no tokens.

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { wireGate } = require('bare-agent');

const __dir = dirname(fileURLToPath(import.meta.url));
const FIX_DIR = resolve(join(__dir, 'fixtures', 'csv'));

// Same translator + gate config probe-02 uses.
function actionTranslator(name, args, ctx) {
  if (name === 'shell_read' || name === 'shell_grep') return { type: 'read', path: args?.path, args, _ctx: ctx };
  if (name === 'shell_run') return { type: 'bash', cmd: (args?.argv || []).join(' '), args, _ctx: ctx };
  if (name === 'edit_file') return { type: 'write', path: args?.path, args, _ctx: ctx };
  return { type: name, args, _ctx: ctx };
}

const TARGET = join(FIX_DIR, 'csv.js'); // probe-02 scopes writes to the ONE source file under repair
const gate = new Gate({
  budget: { maxCostUsd: 0.50 },
  limits: { maxTurns: 30 },
  fs: { readScope: [FIX_DIR], writeScope: [TARGET] },
  bash: { allow: ['node'] },
  audit: { path: join(__dir, 'run-probe02-gatecheck-audit.jsonl') },
  humanChannel: async () => ({ decision: 'deny' }),
});
await gate.init();
const { translate } = { translate: actionTranslator };

// Drive bareguard's decision engine directly with the translated action, the same object the wired
// policy hands to gate.check. (gate.check returns { outcome:'allow'|'deny', rule, reason, ... }.)
async function decide(name, args) {
  const action = translate(name, args);
  return gate.check(action);
}

let failures = 0;
async function expect(label, name, args, wantOutcome, wantRulePart) {
  const d = await decide(name, args);
  const ok = d.outcome === wantOutcome && (!wantRulePart || (d.rule || '').includes(wantRulePart));
  const mark = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${mark}  ${label}`);
  console.log(`        → outcome=${d.outcome} rule=${d.rule ?? '-'} ${d.reason ? `(${d.reason})` : ''}`);
  if (!ok) { failures++; console.log(`        ✗ expected outcome=${wantOutcome}${wantRulePart ? ` rule~="${wantRulePart}"` : ''}`); }
}

console.log('--- positive controls: legit actions must be ALLOWED ---');
await expect('read inside fixture', 'shell_read', { path: join(FIX_DIR, 'csv.js') }, 'allow');
await expect('write the target source file', 'edit_file', { path: TARGET, contents: 'x' }, 'allow');
await expect('run node --test', 'shell_run', { argv: ['node', '--test'], cwd: FIX_DIR }, 'allow');

console.log('\n--- negative controls: bad actions must be DENIED (this is what proves the gate is live) ---');
await expect('write OUTSIDE writeScope', 'edit_file', { path: '/etc/passwd', contents: 'pwned' }, 'deny', 'fs.writeScope');
await expect('write to repo root (out of scope)', 'edit_file', { path: join(__dir, '..', 'package.json'), contents: 'x' }, 'deny', 'fs.writeScope');
// The anti-cheat: writes are scoped to the source file only, so the agent cannot rewrite the TESTS
// (a sibling file in the same dir). This is what keeps the `stuck` fixture honestly unsolvable.
await expect('write the TEST file (sibling, must be denied)', 'edit_file', { path: join(FIX_DIR, 'csv.test.js'), contents: 'x' }, 'deny', 'fs.writeScope');
await expect('read OUTSIDE readScope', 'shell_read', { path: '/etc/passwd' }, 'deny', 'fs.readScope');
// Layer 1 — the destructive-pattern FLOOR catches `rm -rf /` regardless of the allowlist.
await expect('bash destructive floor (rm -rf /)', 'shell_run', { argv: ['rm', '-rf', '/'] }, 'deny', 'denyPatterns');
// Layer 2 — a benign command that is simply not on the allowlist is denied by bash.allow.
await expect('bash not on allowlist (cat)', 'shell_run', { argv: ['cat', join(FIX_DIR, 'csv.js')] }, 'deny', 'bash.allow');
// Layer 2 — an allowed prefix (node) carrying a shell metacharacter is still denied (prefix can't bound chaining).
await expect('bash metachar with allowed prefix', 'shell_run', { argv: ['node', ';', 'ls'] }, 'deny', 'bash.allow');

console.log(`\n${failures === 0 ? '\x1b[32m✓ gate enforces: all controls behaved as required\x1b[0m' : `\x1b[31m✗ ${failures} control(s) wrong — gate not enforcing as configured\x1b[0m`}`);
process.exitCode = failures === 0 ? 0 : 1;
