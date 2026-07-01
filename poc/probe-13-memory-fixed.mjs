#!/usr/bin/env node
// probe-13 — the FIXED memory loop, and proof it beats the naive one.
//
// F26/F27 diagnosed the naive loop's failure: lexical recall ranks on SIMILARITY, not CORRECTNESS, so
// trusting the top-k threads wrong rules and STARVES the worker of the right note (naive top-3 = 0/5).
// The fix follows the thesis (recall proposes, the executable close disposes) on BOTH failure axes:
//   FIX-1 (retrieval): do NOT trust rank. Let the GROUNDED CLOSE drive recall — on each failed attempt,
//                      WIDEN the candidate window (3 -> 6 …), framed as "unverified candidates; the test
//                      decides which applies". The close, not the ranking, selects the memory. Scalable:
//                      widen up to a cap on repeated failure rather than threading the whole store upfront.
//   FIX-2 (transfer):  store the lesson as an explicit RULE + example, not verbatim code. F27's distant
//                      transfer (auditBadge) failed because the worker copied the lesson's RETURN SHAPE; a
//                      rule ("format the ID as <PREFIX>-<pad6>-<CHK>, then produce whatever the function
//                      requires") lets it adapt the surrounding structure.
//
// Two arms over the SAME 5 entities + the SAME adversarial store (the two rich wrong distractors from F26):
//   naive  — verbatim-code lesson, thread top-3, rank-trusting.               EXPECT ~0/5 (reproduces F27).
//   fixed  — rule-framed lesson, close-driven widening (3->6) candidates.     EXPECT high (incl. auditBadge).
//
// Can fail honestly: fixed could still fail if the worker can't discriminate even with the right note
// present, or if rule-framing doesn't fix the distant transfer. Reported as measured, no tuning.
//
// Run:  ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-13-memory-fixed.mjs
//       (RELAYFACT_ENTITIES=orderId,auditBadge to subset)

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, writeFileSync, readFileSync, rmSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const require = createRequire(import.meta.url);
const { recurse, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.5);
const FIX_DIR = resolve(join(__dir, 'fixtures', 'idfmt-multi'));
const memRoot = join(__dir, '.litectx-probe13');
const RIGHT = 'lesson:entity-id-format';
const logPath = join(__dir, 'run-probe13.jsonl');
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', rst: '\x1b[0m' };
let seq = 0;
function emit(type, payload = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  const col = { 'arm.PASS': C.grn, 'arm.FAIL': C.red, 'recall': C.blu, 'entity': C.cyn, 'summary': C.mag, 'run.error': C.red }[type] || '';
  const keys = Object.keys(payload);
  let s = `${col}● ${type}${C.rst}`;
  if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]}`).join(' ')}${C.rst}`;
  console.error(s);
}

// The right note, two ways. NAIVE stores verbatim userId code (F27's form). FIXED stores an explicit RULE.
const RIGHT_CODE =
  `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
  `export function userId(n) {\n  const prefix = 'USER';\n  const paddedId = String(n).padStart(6, '0');\n  const checkChar = prefix[0];\n  return \`\${prefix}-\${paddedId}-\${checkChar}\`;\n}\n\n` +
  `This shows the current ID convention; apply the same rule to other entities.`;
const RIGHT_RULE =
  `Project entity-ID convention (current). An entity ID is the string \`<PREFIX>-<NNNNNN>-<CHK>\` where:\n` +
  `- PREFIX = the entity name in UPPERCASE (the "user" entity -> USER, "order" -> ORDER).\n` +
  `- NNNNNN = the numeric id, left zero-padded to WIDTH 6 (7 -> 000007, 123456 -> 123456).\n` +
  `- CHK = a single check char, the FIRST letter of PREFIX (USER -> U, ORDER -> O).\n` +
  `Example: user 7 -> "USER-000007-U". Apply this rule to ANY entity: derive its prefix and check letter,\n` +
  `format the ID, then produce whatever the specific function must return (the ID alone, or wrapped in other text).`;

// The two rich wrong distractors from F26 (length-matched, share the vocabulary, WRONG rule) + far ones.
const WRONG_LEGACY =
  `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
  `export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n  const checkChar = prefix[prefix.length - 1];\n  return \`\${prefix}_\${paddedId}_\${checkChar}\`;\n}\n\n` +
  `This was the legacy v1 ID convention; it is deprecated and must not be used for new entities.`;
const WRONG_TWIN =
  `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
  `export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n  const checkChar = prefix[prefix.length - 1];\n  return \`\${prefix}_\${paddedId}_\${checkChar}\`;\n}\n\n` +
  `This shows the current ID convention; apply the same rule to other entities.`;
const FAR = [
  ['url-slug', 'URL slugs: lowercase the title, replace spaces with hyphens, strip punctuation. Example: "My Post!" -> "my-post".'],
  ['promo-code', 'Promotional short codes are exactly 4 uppercase alphanumeric characters with no prefix and no separators, e.g. "7K2X".'],
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) returning "$X.XX".'],
];

const ALL = ['orderId', 'accountId', 'invoiceId', 'ticketId', 'auditBadge'];
const ENTITIES = (process.env.RELAYFACT_ENTITIES ? process.env.RELAYFACT_ENTITIES.split(',') : ALL).map((s) => s.trim());

const resolveTarget = (p) => join(FIX_DIR, basename(String(p || '')));
const editTool = {
  name: 'edit_file', description: 'Overwrite a source file with new contents. Pass the file name. Returns {ok,bytes}.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
  execute: async ({ path, contents }) => { writeFileSync(resolveTarget(path), contents); return { ok: true, bytes: contents.length }; },
};
const actionTranslator = (name, args, ctx) => name === 'edit_file' ? { type: 'write', path: resolveTarget(args?.path), args, _ctx: ctx } : { type: name, args, _ctx: ctx };
const PERSONA = [
  'You are a senior engineer in this project. Source files live in:', FIX_DIR + '.',
  'Apply fixes by calling edit_file with the FILENAME and full new contents.',
  'Each file must `export function <name>(...)`. Vanilla JS, no deps. Never edit tests.',
].join(' ');
const recallQuery = (fn) => `${fn}() produced the wrong entity ID format and its test failed. What is the current project convention for formatting an entity ID (prefix, padding, check character)?`;
function runSuite(testFile) { const r = spawnSync('node', ['--test', testFile], { cwd: FIX_DIR, encoding: 'utf8' }); return { pass: r.status === 0 }; }

async function seedStore(lc, arm) {
  for (const [id, t] of FAR) await lc.remember(id, t, { kind: 'fact' });
  await lc.remember('wrong-rich-legacy', WRONG_LEGACY, { kind: 'fact' });
  await lc.remember('wrong-rich-twin', WRONG_TWIN, { kind: 'fact' });
  await lc.remember(RIGHT, arm === 'fixed' ? RIGHT_RULE : RIGHT_CODE, { kind: 'fact' });
}

async function runArm(lc, fn, arm) {
  const testFile = `${fn}.test.js`;
  const target = join(FIX_DIR, `${fn}.js`);
  copyFileSync(join(FIX_DIR, `${fn}.stub.js`), target);
  const auditPath = join(__dir, `run-probe13-${fn}-${arm}-audit.jsonl`);
  rmSync(auditPath, { force: true });
  const gate = new Gate({ budget: { maxCostUsd: MAX_COST_USD }, limits: { maxTurns: 30, maxDepth: 1, maxChildren: 1 }, fs: { writeScope: [target], readScope: [] }, bash: { allow: [] }, audit: { path: auditPath } });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });
  const stream = new Stream();

  let attempt = 0, everSawRight = false, widths = [];
  const sensor = async () => {
    const v = runSuite(testFile);
    if (v.pass) return { pass: true, status: 'satisfied', critique: null };
    attempt++;
    let critique = `${fn}() is wrong: the test failed. The required ID format is a fixed PROJECT CONVENTION — not guessable, not in any readable file.`;
    // FIX-1: close-driven widening. naive = fixed top-3, rank-trusting. fixed = widen 3 -> 6 on each failure.
    const N = arm === 'fixed' ? Math.min(6, 3 * attempt) : 3;
    const hits = await lc.recall(recallQuery(fn), { kind: 'fact', n: 6, body: true });
    const slate = hits.slice(0, N);
    const rightRank = hits.map((h) => h.path).indexOf(RIGHT);
    const sawRight = slate.some((h) => h.path === RIGHT); everSawRight = everSawRight || sawRight;
    widths.push(N);
    emit('recall', { fn, arm, attempt, window: N, rightRank, rightInSlate: sawRight });
    critique += arm === 'fixed'
      ? `\n\nUnverified candidate notes from memory — the TEST decides which one is right; ignore any that don't make the test pass:\n${slate.map((h, i) => `(${i + 1}) [${h.path}] ${h.body}`).join('\n')}`
      : `\n\nMost relevant project notes recalled from memory:\n${slate.map((h, i) => `(${i + 1}) [${h.path}] ${h.body}`).join('\n')}`;
    return { pass: false, status: 'unmet', critique };
  };

  // Per-FUNCTION output shape (NOT a project convention → belongs in the task, not memory). auditBadge is the
  // fair structure-transfer test: the ID rule comes from the recalled lesson, the WRAPPING comes from here, and
  // neither contains auditBadge's literal answer (the example uses a different prefix/number).
  const SHAPES = { auditBadge: ' This function must return the formatted entity ID WRAPPED in double angle brackets — e.g. an id string like `FOO-000003-F` becomes `<<FOO-000003-F>>`.' };
  const task = `Implement ${fn}.js so \`node --test ${testFile}\` passes. It must \`export function ${fn}(n)\` and format an entity ID.${SHAPES[fn] || ''} Apply your fix with edit_file, then stop.`;
  // FIXED gets 4 attempts so the close-driven widening (3->6) has room to surface + apply the right note.
  const refineLeaf = arm === 'fixed' ? { sensor, temperatures: [0.2, 0.5, 0.8, 1.0] } : { sensor };
  let result;
  try { result = await recurse(task, { provider, policy, onLlmResult, stream }, { persona: PERSONA, tools: [editTool], maxDepth: 0, refineLeaf }); }
  catch (e) { emit('run.error', { fn, arm, message: e.message }); return { pass: false }; }
  const v = runSuite(testFile);
  const src = (() => { try { return readFileSync(target, 'utf8').replace(/\s+/g, ' ').slice(0, 90); } catch { return ''; } })();
  return { pass: v.pass, iterations: result.receipts?.refineLeaf?.iterations ?? null, everSawRight, widths, src };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY' }); out.end(() => { process.exitCode = 2; }); return; }
  const { LiteCtx } = await import('litectx');
  const tally = { naive: { p: 0, n: 0 }, fixed: { p: 0, n: 0 } };
  const rows = [];
  for (const fn of ENTITIES) {
    emit('entity', { fn, distant: fn === 'auditBadge' });
    const row = { fn, distant: fn === 'auditBadge' };
    for (const arm of ['naive', 'fixed']) {
      rmSync(memRoot, { recursive: true, force: true });
      const lc = new LiteCtx({ root: memRoot });
      await seedStore(lc, arm);
      const r = await runArm(lc, fn, arm);
      tally[arm].n++; if (r.pass) tally[arm].p++;
      row[arm] = r.pass;
      emit(r.pass ? 'arm.PASS' : 'arm.FAIL', { fn, arm, pass: r.pass, iterations: r.iterations, everSawRight: r.everSawRight, windows: r.widths, src: r.src });
    }
    rows.push(row);
  }
  emit('summary', {
    model: MODEL, naiveRate: `${tally.naive.p}/${tally.naive.n}`, fixedRate: `${tally.fixed.p}/${tally.fixed.n}`, rows,
    reading: 'naive = rank-trusting top-3 (F27 repro). fixed = close-driven widening + candidates-framing + rule-framed lesson. auditBadge is the distant transfer (tests FIX-2). SCALING CAVEAT: widening to the full pool works for a bounded candidate set; a large store needs better retrieval or a hard widen cap.',
  });
  const better = tally.fixed.p > tally.naive.p;
  out.end(() => { process.exitCode = better ? 0 : 1; });
}
main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); out.end(() => { process.exitCode = 1; }); });
