// compile-close.live.test.js — the ONE real-model verification of step 2: a live prose→suite compilation.
//
// Token-spending, so it SELF-SKIPS unless RELAYFACT_LIVE=1 AND a key is present — `npm test` stays free.
// Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_LIVE=1 node --test test/integration/compile-close.live.test.js
//
// It verifies the wiring authorSuiteViaRecurse → compileClose → validateSuite end-to-end on a real worker:
// a real haiku authors a suite from prose, and relayfact's deterministic gate must find it TRUSTED. (G1's
// honesty CLAIM was established in poc/probe-15; this proves the shipped src/ wiring reproduces it.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Gate } from 'bareguard';
import { runClose } from '../../src/close.mjs';
import { compileClose } from '../../src/compile-close.mjs';
import { authorSuiteViaRecurse, makeProvider } from '../../src/author.mjs';

const LIVE = process.env.RELAYFACT_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';

// The `double(n)` oracle — a correct impl, a no-op stub, and 5 subtle mutants (the k=5 canon).
const ORACLE = {
  reference: 'export const double = (n) => n * 2;\n',
  stub: 'export const double = (n) => {};\n',
  mutants: [
    { name: 'noop', code: 'export const double = (n) => n;\n' },
    { name: 'offbyone', code: 'export const double = (n) => n * 2 + 1;\n' },
    { name: 'zero', code: 'export const double = (n) => (n === 0 ? 1 : n * 2);\n' },
    { name: 'sign', code: 'export const double = (n) => Math.abs(n) * 2;\n' },
    { name: 'triple', code: 'export const double = (n) => n * 3;\n' },
  ],
};
const PROSE = 'Implement double(n): return n multiplied by two. Works for positive, negative, and zero integers.';

test('live: a real worker self-authors a TRUSTED grounded close from prose', { skip: LIVE ? false : 'set RELAYFACT_LIVE=1 and ANTHROPIC_API_KEY' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-live-'));
  const suitePath = join(dir, 'suite.test.mjs');
  const implPath = join(dir, 'impl.mjs');
  try {
    // relayfact's deterministic leaf close for the AUTHOR loop: suite exists AND a correct impl passes it
    // (the in-loop over-constraint guard). Not a model judge.
    const sensor = async () => {
      if (!existsSync(suitePath)) {
        return { status: 'needs_revision', pass: false, score: null, critique: `No suite written yet — write ${'suite.test.mjs'} via write_test.`, suggestions: [] };
      }
      writeFileSync(implPath, ORACLE.reference);
      const v = runClose(['node', '--test', 'suite.test.mjs'], { cwd: dir });
      return v.pass
        ? { status: 'satisfied', pass: true, score: null, critique: '', suggestions: [] }
        : { status: 'needs_revision', pass: false, score: null, critique: `A correct implementation must pass your suite, but it failed — you may be over-constraining. Output:\n${v.output}`, suggestions: [] };
    };

    const provider = makeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });
    const gate = new Gate({
      budget: { maxCostUsd: Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.5) },
      limits: { maxTurns: 20, maxDepth: 0, maxChildren: 1 },
      fs: { writeScope: [suitePath], readScope: [] }, bash: { allow: [] },
      audit: { path: join(dir, 'audit.jsonl') },
      humanChannel: async () => ({ decision: 'deny' }),
    });
    await gate.init();

    const authorSuite = () => authorSuiteViaRecurse({ prose: PROSE, target: suitePath, provider, gate, sensor });
    const r = await compileClose({ workdir: dir, prose: PROSE, oracle: ORACLE, authorSuite });

    console.error(`[live] verdict=${r.verdict} ok=${r.ok} validity=${JSON.stringify(r.validity)} suiteBytes=${r.suiteBytes}`);
    assert.equal(r.verdict, 'trusted', 'a real worker should self-author a suite relayfact finds trustworthy');
    assert.equal(r.ok, true);
    assert.equal(r.validity.stubCatch, true);
    assert.equal(r.validity.referencePasses, true);
    assert.ok(r.validity.mutantsKilled >= 4, `expected ≥4 mutants killed, got ${r.validity.mutantsKilled}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
