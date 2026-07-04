// pipeline.live.test.js — the ONE real-model end-to-end run of the assembled pipe (PRD-v3 G5-EXIT).
//
// A prose request + a repo dir go in; the WHOLE pipe runs for real — pre-flight (haiku) → the worker
// self-authors a grounded close from prose (recurse) → relayfact's validity-gate trusts it → a second gated
// worker implements the impl red→green through the bareguard leash → the INDEPENDENT GOLD arbiter (D5) → a
// DELIVER. Every step lands in the event log; the pure-listener observer renders it at the end.
//
// Two gates by design: the author writes ONLY the suite; the worker writes ONLY the impl (scope-EXCLUDES the
// suite, so it cannot fake green). Token-spending ⇒ SELF-SKIPS unless RELAYFACT_LIVE=1 AND a key is present.
// Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_LIVE=1 node --test test/integration/pipeline.live.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Gate } from 'bareguard';
import { createEventLog } from '../../src/event-log.mjs';
import { readEventLog, renderRun } from '../../src/observer.mjs';
import { runClose } from '../../src/close.mjs';
import { runRequest } from '../../src/pipeline.mjs';
import { authorSuiteViaRecurse, makeProvider } from '../../src/author.mjs';

const LIVE = process.env.RELAYFACT_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const skip = LIVE ? false : 'set RELAYFACT_LIVE=1 and ANTHROPIC_API_KEY';

const PROSE = 'Implement double(n): return n multiplied by two. Works for positive, negative, and zero integers.';
const ORACLE = {
  reference: 'export const double = (n) => n * 2;\n',
  stub: 'export const double = (n) => {};\n',
  mutants: [
    'export const double = (n) => n;\n',
    'export const double = (n) => n * 2 + 1;\n',
    'export const double = (n) => (n === 0 ? 1 : n * 2);\n',
    'export const double = (n) => Math.abs(n) * 2;\n',
    'export const double = (n) => n * 3;\n',
  ],
};
// Independent GOLD — the worker never sees it (written only after it finishes). Fresh values, not in the prose.
const GOLD = {
  name: 'gold.test.mjs',
  source: `import { double } from './impl.mjs';\nimport { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('gold', () => { assert.equal(double(7), 14); assert.equal(double(-9), -18); assert.equal(double(0), 0); });\n`,
};

test('live e2e: prose + repo → pre-flight → compile → gated worker → GOLD → DELIVER', { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-e2e-'));
  const suitePath = join(dir, 'suite.test.mjs');
  const implPath = join(dir, 'impl.mjs');
  const log = createEventLog(join(dir, 'run.jsonl'));
  try {
    const provider = makeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });
    const maxCostUsd = Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.8);

    // Gate #1 — the author writes ONLY the suite.
    const authorGate = new Gate({
      budget: { maxCostUsd }, limits: { maxTurns: 20, maxDepth: 0, maxChildren: 1 },
      fs: { writeScope: [suitePath], readScope: [] }, bash: { allow: [] },
      audit: { path: join(dir, 'audit-author.jsonl') }, humanChannel: async () => ({ decision: 'deny' }),
    });
    await authorGate.init();
    // relayfact's deterministic leaf close for the AUTHOR loop (suite exists AND a correct impl passes it).
    const sensor = async () => {
      if (!existsSync(suitePath)) return { status: 'needs_revision', pass: false, score: null, critique: 'No suite yet — write suite.test.mjs.', suggestions: [] };
      writeFileSync(implPath, ORACLE.reference);
      const v = runClose(['node', '--test', 'suite.test.mjs'], { cwd: dir });
      return v.pass
        ? { status: 'satisfied', pass: true, score: null, critique: '', suggestions: [] }
        : { status: 'needs_revision', pass: false, score: null, critique: `A correct impl must pass your suite but it failed — you may be over-constraining. Output:\n${v.output}`, suggestions: [] };
    };
    const authorSuite = () => authorSuiteViaRecurse({ prose: PROSE, target: suitePath, provider, gate: authorGate, sensor });

    // Gate #2 — the worker writes ONLY the impl; the suite is NOT writable (cannot be gamed).
    const workerGate = new Gate({
      budget: { maxCostUsd }, limits: { maxTurns: 20, maxDepth: 0, maxChildren: 1 },
      fs: { writeScope: [implPath], readScope: [] }, bash: { allow: [] },
      audit: { path: join(dir, 'audit-worker.jsonl') }, humanChannel: async () => ({ decision: 'deny' }),
    });
    await workerGate.init();

    const r = await runRequest({
      request: PROSE, workdir: dir, target: implPath, oracle: ORACLE, goldSuite: GOLD,
      authorSuite, provider, gate: workerGate, log,
    });

    const events = readEventLog(join(dir, 'run.jsonl'));
    console.error('\n' + renderRun(events) + '\n');
    console.error(`[live/e2e] outcome=${r.outcome} delivered=${r.delivered} gold.pass=${r.gold?.pass} split=${r.split?.groundedOfTotal}`);

    assert.equal(r.outcome, 'delivered', 'the whole pipe should deliver double() green');
    assert.equal(r.delivered, true);
    assert.equal(r.gold.pass, true, 'the INDEPENDENT GOLD must be green on the delivered artifact');
    // the event stream recorded every stage, in order, and the observer rendered a DELIVER
    const seq = events.map((e) => e.type);
    assert.deepEqual(seq, ['run.start', 'preflight', 'close.compiled', 'receipts', 'worker.done', 'gold.checked', 'run.deliver', 'run.end']);
    assert.match(renderRun(events), /✅ DELIVER/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
