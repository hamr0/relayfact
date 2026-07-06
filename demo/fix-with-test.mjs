#!/usr/bin/env node
// fix-with-test.mjs — point relayfact at a real repo and a real failing test.
//
// This is the exact loop from the roman-numeral demo, made repo-agnostic. Three inputs, nothing invented:
//   --repo    <dir>            workdir the test runs in
//   --target  <file>          the ONLY file the agent may write (gate write-scoped — it physically can't game the test)
//   --test    '<cmd> <args…>'  the check, run VERBATIM (e.g. 'node --test suite.test.mjs' or 'npm test')
//   --task    "<prose>"       what to make pass (optional; a sane default is derived from the test command)
//
// The test is the oracle. relayfact edits only --target, re-runs --test authoritatively on the delivered
// artifact, and DELIVERS only on a real green — else it escalates. It cannot fake green: the gate write-scopes
// the impl, never the suite. Every step narrates to a JSONL event log the pure observer renders.
//
// Run (key stays out of the tree):
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node demo/fix-with-test.mjs \
//     --repo /path/to/repo --target /path/to/repo/impl.mjs --test 'node --test suite.test.mjs' \
//     --task "Implement X so the suite passes."

import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { Gate } from 'bareguard';
import { implementAgainstClose } from '../src/worker.mjs';
import { makeProvider } from '../src/author.mjs';
import { createEventLog } from '../src/event-log.mjs';
import { readEventLog, renderRun } from '../src/observer.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const repo = resolve(arg('repo', process.cwd()));
const target = resolve(arg('target', ''));
const testCmd = arg('test', 'node --test');
const closeCommand = testCmd.split(/\s+/); // run verbatim as an array — no shell
const task = arg('task', `Edit ${target} so \`${testCmd}\` passes. Fix the SOURCE only; never edit the test.`);
const model = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const maxCostUsd = Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.5);

if (!process.env.ANTHROPIC_API_KEY) { console.error('set ANTHROPIC_API_KEY (e.g. $(pass amr/claude_api))'); process.exit(2); }
if (!target || !existsSync(target)) { console.error(`--target must be an existing file (the agent writes only this). got: ${target}`); process.exit(2); }
if (!existsSync(repo)) { console.error(`--repo not found: ${repo}`); process.exit(2); }

const logPath = join(repo, '.relayfact-run.jsonl');
const log = createEventLog(logPath);

// The leash: write-scoped to --target ONLY, capped, audited. The suite is not writable — the loop can't cheat.
const gate = new Gate({
  budget: { maxCostUsd },
  limits: { maxTurns: 20, maxDepth: 0, maxChildren: 1 },
  fs: { writeScope: [target], readScope: [] },
  bash: { allow: [] },
  audit: { path: join(repo, '.relayfact-audit.jsonl') },
  humanChannel: async () => ({ decision: 'deny' }),
});
await gate.init();
const provider = makeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model });

log.emit('run.start', { request: task, workdir: repo, target });
console.error(`→ ${model}  repo=${repo}\n→ target=${target}\n→ check=${testCmd}\n`);

const r = await implementAgainstClose({ task, workdir: repo, target, closeCommand, provider, gate });

log.emit('receipts', { verdict: r.verdict, iterations: r.iterations, incomplete: r.incomplete });
log.emit('worker.done', { outcome: r.outcome, delivered: r.delivered, finalClosePass: !!r.finalClose?.pass, iterations: r.iterations });
if (r.delivered) log.emit('run.deliver', { target, outcome: 'delivered' });
else log.emit('run.escalate', { escalation: { blocker: r.incomplete ? 'budget-cap' : 'close-exhausted' }, decisionReady: true });
log.emit('run.end', { outcome: r.delivered ? 'delivered' : 'escalated' });
log.close();

console.error('\n' + renderRun(readEventLog(logPath)));
console.error(`\n${r.delivered ? '✅ DELIVERED' : '🛑 ESCALATED'} — authoritative re-run: ${r.finalClose?.pass ? 'GREEN' : 'RED'} (iters=${r.iterations})`);
console.error(`event log: ${logPath}`);
process.exit(r.delivered ? 0 : 1);
