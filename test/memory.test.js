// memory.test.js — close-driven recall widening (D3), token-free but over REAL litectx BM25.
//
// This is the module the probe-06/07/08 fit-to-pass retraction was about, so the controls are built to FAIL:
//   1. the burial is REAL — over a real store, the right note is ranked BELOW a fixed base window by BM25
//      (verified-by-running, rank 3); a rank-trusting base window STARVES the worker of it (F27 repro);
//   2. close-driven widening SURFACES it — the widened window is a superset that reaches the buried note;
//   3. the note is a RULE, not the answer — the surfaced note does NOT contain the task's literal answer
//      (the standing fit-to-pass guard: recall proposes a rule, the executable close disposes).
//
// What this DOES NOT claim: that the worker will apply the surfaced rule. That is the worker/model's job and
// is a LIVE claim (test/integration/memory.live.test.js, n=1, named). Here we prove only the RETRIEVAL POLICY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rememberLesson, frameCandidates, windowFor, makeWidener } from '../src/memory.mjs';

// ── pure schedule + framing (no store) ─────────────────────────────────────────────────────────────────
test('windowFor: base on first failure, +base per retry, hard-capped at cap', () => {
  assert.equal(windowFor(1), 3);            // first failed close
  assert.equal(windowFor(2), 6);            // widened
  assert.equal(windowFor(3), 6);            // capped — the BOUND (D3)
  assert.equal(windowFor(9), 6);
  assert.equal(windowFor(1, { base: 2, cap: 8 }), 2);
  assert.equal(windowFor(4, { base: 2, cap: 8 }), 8);
  assert.equal(windowFor(0), 3);            // guarded: attempt<1 floors at one base window
});

test('frameCandidates: empty in → empty out (no noise); non-empty carries the "test decides" framing', () => {
  assert.equal(frameCandidates([]), '');
  assert.equal(frameCandidates(null), '');
  const t = frameCandidates([{ name: 'a', body: 'ruleA' }, { name: 'b', body: 'ruleB' }]);
  assert.match(t, /Unverified candidate notes/);
  assert.match(t, /the TEST decides/);
  assert.match(t, /\(1\) \[a\] ruleA/);
  assert.match(t, /\(2\) \[b\] ruleB/);
});

test('rememberLesson rejects an empty name or rule', async () => {
  await assert.rejects(() => rememberLesson({}, { name: '', rule: 'x' }), /name/);
  await assert.rejects(() => rememberLesson({}, { name: 'n', rule: '' }), /rule/);
});

// ── the real-BM25 control: burial is real, widening reaches past it ─────────────────────────────────────
// A transferable RULE (FIX-2) — note it contains NO entity name from any task and NO wrapped literal answer.
const RIGHT = 'lesson:entity-id-format';
const RIGHT_RULE =
  'Project entity-ID convention (current). An entity ID is the string `<PREFIX>-<NNNNNN>-<CHK>` where:\n' +
  '- PREFIX = the entity name in UPPERCASE (the "user" entity -> USER, "order" -> ORDER).\n' +
  '- NNNNNN = the numeric id, left zero-padded to WIDTH 6 (7 -> 000007).\n' +
  '- CHK = a single check char, the FIRST letter of PREFIX (USER -> U).\n' +
  'Example: user 7 -> "USER-000007-U". Apply this rule to ANY entity.';
// Two length-matched, same-vocabulary WRONG distractors (F26) + far notes — the adversarial store.
const WRONG = (tail) =>
  'A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n' +
  "export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n" +
  '  const checkChar = prefix[prefix.length - 1];\n  return `${prefix}_${paddedId}_${checkChar}`;\n}\n\n' + tail;
const FAR = [
  ['url-slug', 'URL slugs: lowercase the title, replace spaces with hyphens, strip punctuation. Example: "My Post!" -> "my-post".'],
  ['promo-code', 'Promotional short codes are exactly 4 uppercase alphanumeric characters with no prefix and no separators, e.g. "7K2X".'],
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) returning "$X.XX".'],
];
// The failure-derived query (F27 discipline: the query comes from the FAILED close, not crafted to the note).
const QUERY = 'auditBadge() produced the wrong entity ID format and its test failed. What is the current project '
  + 'convention for formatting an entity ID (prefix, padding, check character)?';

async function seededStore() {
  const { LiteCtx } = await import('litectx');
  const root = mkdtempSync(join(tmpdir(), 'relayfact-mem-'));
  const lc = new LiteCtx({ root });
  for (const [id, t] of FAR) await lc.remember(id, t, { kind: 'fact' });
  await lc.remember('wrong-rich-legacy', WRONG('This was the legacy v1 ID convention; it is deprecated.'), { kind: 'fact' });
  await lc.remember('wrong-rich-twin', WRONG('This shows the current ID convention; apply the same rule.'), { kind: 'fact' });
  await rememberLesson(lc, { name: RIGHT, rule: RIGHT_RULE });
  return { lc, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('CONTROL: BM25 BURIES the right note below the base window — a rank-trusting base slate STARVES', async () => {
  const { lc, cleanup } = await seededStore();
  try {
    const widen = makeWidener(lc, { base: 3, cap: 6 });
    const base = await widen(QUERY, 1);                  // first failed close: window 3
    assert.equal(base.window, 3);
    // Verified-by-running: the right note ranks at 3 for this failure query — OUTSIDE the base window.
    assert.equal(base.rankOf(RIGHT), 3, 'if this drifts, the burial premise changed — revisit, do not silently pass');
    assert.ok(!base.candidates.some((c) => c.name === RIGHT), 'the base window MUST miss the buried note (the starvation is real)');
  } finally { cleanup(); }
});

test('FIX-1: close-driven widening SURFACES the buried note (superset of the base window)', async () => {
  const { lc, cleanup } = await seededStore();
  try {
    const widen = makeWidener(lc, { base: 3, cap: 6 });
    const base = await widen(QUERY, 1);
    const wide = await widen(QUERY, 2);                  // second failed close: window 6
    assert.equal(wide.window, 6);
    const baseNames = new Set(base.candidates.map((c) => c.name));
    assert.ok(wide.candidates.every((c, i) => i >= base.candidates.length || c.name === base.candidates[i].name), 'widening is a stable superset — it only reaches deeper');
    assert.ok([...baseNames].every((n) => wide.candidates.some((c) => c.name === n)), 'widened window contains the whole base window');
    assert.ok(wide.candidates.some((c) => c.name === RIGHT), 'widening MUST reach the buried right note');
    assert.match(wide.text, /Unverified candidate notes/, 'candidates are framed as the test-arbitrated set');
  } finally { cleanup(); }
});

test('FIT-TO-PASS GUARD: the surfaced note is a RULE, not the task answer', async () => {
  const { lc, cleanup } = await seededStore();
  try {
    const widen = makeWidener(lc, { base: 3, cap: 6 });
    const wide = await widen(QUERY, 2);
    const right = wide.candidates.find((c) => c.name === RIGHT);
    assert.ok(right, 'precondition: the right note is surfaced');
    // The note must NOT contain the task's literal answer — no entity name from the task, no wrapped literal.
    assert.ok(!/auditBadge/i.test(right.body), 'the note must not name the task entity (that would be fit-to-pass)');
    assert.ok(!right.body.includes('<<'), 'the note must not contain the task output-wrapping (that is the answer, not a rule)');
    assert.match(right.body, /Apply this rule to ANY entity/, 'it is a transferable rule the worker must still apply');
  } finally { cleanup(); }
});
