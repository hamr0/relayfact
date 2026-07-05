// memory.live.test.js — D3 close-driven widening, LOAD-BEARING A/B (n=1, named). The token-free
// test/memory.test.js proves the retrieval POLICY (real BM25 burial, widening surfaces it, fit-to-pass
// guard). THIS proves the wired worker can CONSUME it — and that memory is genuinely load-bearing, not
// decorative — by an A/B on the SAME task where the answer is obtainable ONLY from memory:
//
//   BLIND  (memory=null): the worker gets a leak-proof "does not match the project convention" gap — the ID
//                         format is NOT in any file it can read (no read tool; gate write-scopes the impl).
//                         EXPECT it cannot converge → does not deliver.
//   MEMORY (widener):     on each failed close the window widens (3→6); BM25 first surfaces the WRONG twin
//                         (rank 0-2), the close rejects it, widening reaches the RIGHT rule (rank 3), the
//                         worker applies it. EXPECT deliver. This is F26/F27/F29 playing out live: recall
//                         proposes (rank-first = wrong), the executable close disposes, widening rescues.
//
// The wrapping (<<…>>) is given in the TASK; the ID CONVENTION comes from the recalled RULE (FIX-2 distant
// transfer). Neither the note nor the failure output contains auditBadge's literal answer. Self-skips unless
// RELAYFACT_LIVE=1. Run:
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_LIVE=1 node --test test/integration/memory.live.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Gate } from 'bareguard';
import { implementAgainstClose } from '../../src/worker.mjs';
import { makeProvider } from '../../src/author.mjs';
import { rememberLesson, makeWidener } from '../../src/memory.mjs';

const LIVE = process.env.RELAYFACT_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const skip = LIVE ? false : 'set RELAYFACT_LIVE=1 and ANTHROPIC_API_KEY';

// Leak-proof suite: asserts against an inline oracle but reveals ONLY a convention-mismatch message (verified
// by running — no AUDIT / 000003 / << in the failure output). The worker can't read this file (no read tool).
const SUITE = `import { auditBadge } from './impl.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const expect = (n) => \`<<AUDIT-\${String(n).padStart(6, '0')}-A>>\`;
test('auditBadge matches the project ID convention', () => {
  for (const n of [3, 42, 7]) {
    if (auditBadge(n) !== expect(n)) assert.fail('auditBadge output does not match the current project entity-ID convention');
  }
});
`;
const RIGHT = 'lesson:entity-id-format';
const RIGHT_RULE =
  'Project entity-ID convention (current). An entity ID is the string `<PREFIX>-<NNNNNN>-<CHK>` where:\n' +
  '- PREFIX = the entity name in UPPERCASE (the "user" entity -> USER, "order" -> ORDER).\n' +
  '- NNNNNN = the numeric id, left zero-padded to WIDTH 6 (7 -> 000007).\n' +
  '- CHK = a single check char, the FIRST letter of PREFIX (USER -> U).\n' +
  'Example: user 7 -> "USER-000007-U". Apply this rule to ANY entity.';
const WRONG = (tail) =>
  'A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n' +
  "export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n" +
  '  const checkChar = prefix[prefix.length - 1];\n  return `${prefix}_${paddedId}_${checkChar}`;\n}\n\n' + tail;
const FAR = [
  ['url-slug', 'URL slugs: lowercase the title, replace spaces with hyphens, strip punctuation. Example: "My Post!" -> "my-post".'],
  ['promo-code', 'Promotional short codes are exactly 4 uppercase alphanumeric characters with no prefix and no separators, e.g. "7K2X".'],
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) returning "$X.XX".'],
];
const QUERY = 'auditBadge() produced the wrong entity ID format and its test failed. What is the current project '
  + 'convention for formatting an entity ID (prefix, padding, check character)?';
// The task gives the WRAPPING requirement with a FORMAT-FREE placeholder (<<X>> for an id X) — it must NOT
// reveal the ID convention (prefix-casing / pad width / check char), or the worker could solve it without
// memory (the confound that a leaky earlier draft hit — caught by the control). The convention comes ONLY
// from the recalled rule.
const TASK = 'Implement auditBadge(n) in ./impl.mjs so `node --test suite.test.mjs` passes. It must '
  + '`export function auditBadge(n)` and return the entity ID formatted per the project convention, then '
  + 'WRAPPED in double angle brackets (an id X is returned as `<<X>>`). The ID format itself (prefix, '
  + 'padding, check character) is a fixed PROJECT CONVENTION — it is NOT in any file you can read; use it '
  + 'from the notes you are given.';

async function seedStore(lc) {
  for (const [id, t] of FAR) await lc.remember(id, t, { kind: 'fact' });
  await lc.remember('wrong-rich-legacy', WRONG('This was the legacy v1 ID convention; it is deprecated.'), { kind: 'fact' });
  await lc.remember('wrong-rich-twin', WRONG('This shows the current ID convention; apply the same rule.'), { kind: 'fact' });
  await rememberLesson(lc, { name: RIGHT, rule: RIGHT_RULE });
}

async function runArm({ memory, temperatures }) {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-mem-live-'));
  const implPath = join(dir, 'impl.mjs');
  writeFileSync(join(dir, 'suite.test.mjs'), SUITE);
  writeFileSync(implPath, 'export function auditBadge(n) { return "TODO"; }\n');
  const gate = new Gate({
    budget: { maxCostUsd: Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.6) },
    limits: { maxTurns: 20, maxDepth: 0, maxChildren: 1 },
    fs: { writeScope: [implPath], readScope: [] }, bash: { allow: [] },
    audit: { path: join(dir, 'audit.jsonl') }, humanChannel: async () => ({ decision: 'deny' }),
  });
  await gate.init();
  const provider = makeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });
  const r = await implementAgainstClose({
    task: TASK, workdir: dir, target: implPath, closeCommand: ['node', '--test', 'suite.test.mjs'],
    provider, gate, temperatures, memory,
  });
  rmSync(dir, { recursive: true, force: true });
  return r;
}

test('live A/B: memory is LOAD-BEARING — blind starves, close-driven widening delivers', { skip }, async () => {
  const { LiteCtx } = await import('litectx');
  const memRoot = mkdtempSync(join(tmpdir(), 'relayfact-memstore-'));
  try {
    const lc = new LiteCtx({ root: memRoot });
    await seedStore(lc);

    // Arms differ in EXACTLY ONE thing: memory. Same task, same temperatures/attempt budget — so a pass in
    // the memory arm cannot be attributed to "more tries" (the confound a leaky earlier draft hit).
    const TEMPS = [0.2, 0.5, 0.8, 1.0];

    // BLIND — no memory. The convention is unobtainable; it should not converge.
    const blind = await runArm({ memory: null, temperatures: TEMPS });
    console.error(`[mem/blind]  delivered=${blind.delivered} outcome=${blind.outcome} finalClose.pass=${blind.finalClose.pass}`);

    // MEMORY — close-driven widening. Record the windows the close drove recall through.
    const recalls = [];
    const memory = { widen: makeWidener(lc, { base: 3, cap: 6 }), query: QUERY, onRecall: (i) => recalls.push(i) };
    const withMem = await runArm({ memory, temperatures: TEMPS });
    console.error(`[mem/withMem] delivered=${withMem.delivered} outcome=${withMem.outcome} finalClose.pass=${withMem.finalClose.pass}`);
    console.error(`[mem/recalls] ${JSON.stringify(recalls)}`);

    assert.equal(blind.delivered, false, 'BLIND control: the convention is not in any readable file — the worker must NOT converge without memory');
    assert.equal(withMem.delivered, true, 'MEMORY: close-driven widening should surface the buried rule and the worker should apply it');
    assert.ok(recalls.some((r) => r.window >= 6), 'widening must have reached the widened window (where the right note is ranked)');
  } finally { rmSync(memRoot, { recursive: true, force: true }); }
});
