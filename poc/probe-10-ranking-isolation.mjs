#!/usr/bin/env node
// probe-10 — RANKING ISOLATION. Hardens the honest loose end I flagged on probe-09: the BM25 LENGTH
// CONFOUND. In probe-09 the right lesson (406 chars, full working code) outranked a TERSE legacy
// distractor (202 chars). That could be relevance OR just doc length / term-frequency. This probe
// removes the confound by adding wrong distractors that are AS RICH as the right lesson, then asks:
// does recall still rank the CURRENT rule on top?
//
// Zero LLM tokens — recall over a fixed store is deterministic, so n=1 per condition is the honest n
// (re-running cannot change a BM25/cosine score). No API key needed.
//
// Three things make this able to FAIL for the right reason:
//   1. `wrong-rich-legacy`  — equally rich (~matched chars), full WRONG code block, shares the id/format
//      vocabulary, framed as legacy/deprecated. This is the DIRECT length-confound kill for probe-09's
//      actual conditions: same length as the right lesson, only the rule (and "legacy" framing) differ.
//   2. `wrong-rich-twin`    — the adversarial LEXICAL TWIN: equally rich, full WRONG code, framed
//      WORD-FOR-WORD like the right lesson ("tests PASSED ... current ID convention"). Only the code
//      differs. If lexical BM25 cannot separate these, that is the honest ceiling of lexical recall,
//      and I report it as such (it does NOT retroactively break probe-09, which used legacy framing,
//      but it bounds the claim).
//   3. Two queries — Q_fail (failure-derived, names "current") and Q_neutral (no current/legacy/pass/fail
//      cue). Q_neutral strips the lexical cue that helps the right lesson, so it is the harder test.
//
// PASS (load-bearing): under Q_fail, the right lesson outranks `wrong-rich-legacy`. That kills the
//   length confound for probe-09's conditions.
// STRESSOR (reported, not pass/fail-gating): the twin + Q_neutral results map the lexical ceiling.
//
// Run:  node poc/probe-10-ranking-isolation.mjs            (BM25 only, no deps)
//       LC_EMBED=1 node poc/probe-10-ranking-isolation.mjs (also tries the semantic tier if installed)

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync, createWriteStream } from 'node:fs';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const memRoot = join(__dir, '.litectx-probe10');
const logPath = join(__dir, 'run-probe10-ranking.jsonl');
const RIGHT = 'lesson:entity-id-format';

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', cyn: '\x1b[36m', mag: '\x1b[35m', ylw: '\x1b[33m', blu: '\x1b[34m', rst: '\x1b[0m' };
const out = createWriteStream(logPath);
let seq = 0;
function emit(type, payload = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  out.write(JSON.stringify(ev) + '\n');
  const col = { 'verdict.PASS': C.grn, 'verdict.FAIL': C.red, 'verdict.STRESSOR': C.ylw, 'rank': C.blu, 'embed.skip': C.dim, 'seed': C.cyn }[type] || '';
  const keys = Object.keys(payload);
  let s = `${col}● ${type}${C.rst}`;
  if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]}`).join(' ')}${C.rst}`;
  console.error(s);
}

// The right lesson — VERBATIM what probe-09 stores (the agent's own verified userId code + framing).
const RIGHT_TEXT =
  `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
  `export function userId(n) {\n  const prefix = 'USER';\n  const paddedId = String(n).padStart(6, '0');\n  const checkChar = prefix[0];\n  return \`\${prefix}-\${paddedId}-\${checkChar}\`;\n}\n\n` +
  `This shows the current ID convention; apply the same rule (adjusting the entity prefix and its check letter) to other entities.`;

// Equally-rich WRONG distractor, legacy-framed. ~matched length, a full code block, SAME id/format
// vocabulary, but the rule is wrong (lowercase prefix, padStart(4), check = LAST letter). This is the
// honest twin of probe-09's terse legacy note — now it cannot lose on length alone.
const WRONG_LEGACY_TEXT =
  `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
  `export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n  const checkChar = prefix[prefix.length - 1];\n  return \`\${prefix}_\${paddedId}_\${checkChar}\`;\n}\n\n` +
  `This was the legacy v1 ID convention; it is deprecated and must not be used for new entities.`;

// Adversarial LEXICAL TWIN of the right lesson: framed WORD-FOR-WORD the same ("PASSED ... current
// convention"), only the code differs (wrong rule). Strips every lexical cue the right lesson has.
const WRONG_TWIN_TEXT =
  `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
  `export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n  const checkChar = prefix[prefix.length - 1];\n  return \`\${prefix}_\${paddedId}_\${checkChar}\`;\n}\n\n` +
  `This shows the current ID convention; apply the same rule (adjusting the entity prefix and its check letter) to other entities.`;

const SEED = [
  [RIGHT, RIGHT_TEXT],
  ['wrong-rich-legacy', WRONG_LEGACY_TEXT],
  ['wrong-rich-twin', WRONG_TWIN_TEXT],
  // carry probe-09's terse + far distractors so the pool is realistic
  ['legacy-id-format', 'Legacy v1 entity IDs used a different format: lowercase entity name, an underscore, then the raw number with NO zero-padding and NO check character. Example: user 7 -> "user_7". Do not use for new code.'],
  ['url-slug', 'URL slugs: lowercase the title, replace spaces with hyphens, strip punctuation. Example: "My Post!" -> "my-post".'],
  ['promo-code', 'Promotional short codes are exactly 4 uppercase alphanumeric characters with no prefix and no separators, e.g. "7K2X".'],
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) returning "$X.XX".'],
  ['timestamp', 'All timestamps are UTC ISO-8601 strings; never local time.'],
];

const Q_FAIL = `orderId() produced the wrong entity ID format and its test failed. What is the current project convention for formatting an entity ID (prefix, padding, check character)?`;
const Q_NEUTRAL = `How is an entity ID formatted in this project — the prefix, the numeric zero-padding width, and the check character?`;

async function rankWith(embeddings) {
  const { LiteCtx } = await import('litectx');
  rmSync(memRoot, { recursive: true, force: true });
  const lc = new LiteCtx({ root: memRoot, embeddings });
  for (const [id, t] of SEED) await lc.remember(id, t, { kind: 'fact' });

  // If embeddings were requested but the optional dep is missing, _embedSafe silently flips the tier
  // off after the first attempt. Detect that so we never claim a semantic run that didn't happen.
  if (embeddings) {
    try { await lc.embedder.embed('probe'); }
    catch (e) { return { unavailable: e.message }; }
  }

  const results = {};
  for (const [qname, q] of [['Q_fail', Q_FAIL], ['Q_neutral', Q_NEUTRAL]]) {
    const hits = await lc.recall(q, { kind: 'fact', n: SEED.length, body: false });
    const ranking = hits.map((h) => ({ id: h.path, score: Number((h.score ?? 0).toFixed(3)) }));
    const idx = (id) => ranking.findIndex((r) => r.id === id);
    results[qname] = {
      ranking,
      rightRank: idx(RIGHT),
      legacyRank: idx('wrong-rich-legacy'),
      twinRank: idx('wrong-rich-twin'),
      rightScore: ranking[idx(RIGHT)]?.score ?? null,
      legacyScore: ranking.find((r) => r.id === 'wrong-rich-legacy')?.score ?? null,
      twinScore: ranking.find((r) => r.id === 'wrong-rich-twin')?.score ?? null,
    };
  }
  return results;
}

async function main() {
  emit('seed', {
    n: SEED.length,
    rightChars: RIGHT_TEXT.length,
    wrongLegacyChars: WRONG_LEGACY_TEXT.length,
    wrongTwinChars: WRONG_TWIN_TEXT.length,
    note: 'rich wrong distractors length-matched to the right lesson — BM25 cannot win on length here',
  });

  // ---- BM25 (the tier probe-09 actually ran under) ----
  const bm25 = await rankWith(false);
  for (const [qname, r] of Object.entries(bm25)) {
    emit('rank', { tier: 'bm25', q: qname, rightRank: r.rightRank, legacyRank: r.legacyRank, twinRank: r.twinRank, scores: { right: r.rightScore, legacy: r.legacyScore, twin: r.twinScore } });
    emit('rank.full', { tier: 'bm25', q: qname, ranking: r.ranking });
  }

  // Load-bearing verdict: under the FAILURE-DERIVED query, does the right rule beat the equally-rich
  // legacy distractor? (This is exactly probe-09's condition, now length-controlled.)
  const f = bm25.Q_fail;
  const killsConfound = f.rightRank === 0 && f.rightRank < f.legacyRank;
  if (killsConfound) {
    emit('verdict.PASS', {
      claim: 'LENGTH CONFOUND KILLED for probe-09 conditions',
      detail: `under Q_fail the right rule ranks #${f.rightRank} (score ${f.rightScore}) ABOVE an equally-rich (~${WRONG_LEGACY_TEXT.length}c) wrong legacy distractor at #${f.legacyRank} (score ${f.legacyScore}). Ranking is doing relevance work, not preferring length.`,
    });
  } else {
    emit('verdict.FAIL', {
      claim: 'LENGTH CONFOUND NOT KILLED',
      detail: `under Q_fail the right rule is #${f.rightRank} and the equally-rich wrong legacy distractor is #${f.legacyRank}. probe-09's ranking win was at least partly a length/lexical artifact — must be reported.`,
    });
  }

  // Honest stressor map (does NOT gate pass/fail): the lexical twin + the neutral query.
  emit('verdict.STRESSOR', {
    twin_vs_right_Qfail: f.twinRank < f.rightRank ? 'TWIN OUTRANKS RIGHT' : 'right >= twin',
    twin_Qfail: { rightRank: f.rightRank, twinRank: f.twinRank, scores: { right: f.rightScore, twin: f.twinScore } },
    neutral: { rightRank: bm25.Q_neutral.rightRank, legacyRank: bm25.Q_neutral.legacyRank, twinRank: bm25.Q_neutral.twinRank },
    reading: 'a tie/flip on the word-for-word twin or under Q_neutral is the lexical ceiling of BM25, not a probe-09 defect — reported, not papered over.',
  });

  // ---- Embeddings tier (optional; semantic re-rank could separate twin from right) ----
  if (process.env.LC_EMBED) {
    const emb = await rankWith(true);
    if (emb.unavailable) {
      emit('embed.skip', { reason: emb.unavailable.split('.')[0], note: 'optional dep @huggingface/transformers not installed — semantic arm HONESTLY SKIPPED (no claim made for it)' });
    } else {
      for (const [qname, r] of Object.entries(emb)) {
        emit('rank', { tier: 'embed', q: qname, rightRank: r.rightRank, legacyRank: r.legacyRank, twinRank: r.twinRank, scores: { right: r.rightScore, legacy: r.legacyScore, twin: r.twinScore } });
        emit('rank.full', { tier: 'embed', q: qname, ranking: r.ranking });
      }
    }
  } else {
    emit('embed.skip', { reason: 'LC_EMBED unset', note: 'semantic tier not requested this run' });
  }

  emit('done', { logPath, killsConfound });
  out.end(() => { process.exitCode = killsConfound ? 0 : 1; });
}

main().catch((e) => { emit('error', { message: e.message }); console.error(e); out.end(() => { process.exitCode = 2; }); });
