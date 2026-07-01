#!/usr/bin/env node
// probe-11 — DISCRIMINATION UNDER ADVERSARIAL RECALL + a real transfer RATE.
//
// probe-10 proved lexical recall ranks on textual similarity, NOT correctness: two equally-rich WRONG
// rules outrank the right one under the failure-derived query. So the open question is no longer "does
// ranking pick the right note" (it does not) — it is: when recall threads a MIXED top-3 (wrong rules
// ranked ABOVE the right one), can the worker + the grounded close still converge to correct code?
// And does that hold as a RATE across several entities (not n=4 on one), including a structurally
// DISTANT transfer?
//
// Arms, per entity (5 entities incl. the wrapped-output auditBadge):
//   blind  — no recall, no runbook. CONTROL: the width-6/check-letter convention is not guessable, so
//            this should FAIL. A pass here is an honest null for that entity (convention was guessable).
//   recall — recall the SAME store probe-10 used (right lesson + the two rich wrong distractors + far
//            ones), thread the ACTUAL top-3 (typically 2 wrong + 1 right) — no cherry-picking. The
//            grounded test is the only truth. Does the worker discriminate?
//
// This can fail honestly three ways: blind could pass (no lift), recall could fail (worker fooled by
// the higher-ranked wrong notes), or the distant transfer could break while the plain ones pass.
//
// Run:  ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-11-discrimination-rate.mjs
//       (optional: RELAYFACT_ENTITIES=orderId,auditBadge to subset; RELAYFACT_MAX_COST_USD=0.5 per run)

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { copyFileSync, writeFileSync, readFileSync, rmSync, existsSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const require = createRequire(import.meta.url);
const { recurse, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.4);
const FIX_DIR = resolve(join(__dir, 'fixtures', 'idfmt-multi'));
const memRoot = join(__dir, '.litectx-probe11');
const RIGHT = 'lesson:entity-id-format';
const logPath = join(__dir, 'run-probe11.jsonl');
const out = createWriteStream(logPath);

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', cyn: '\x1b[36m', mag: '\x1b[35m', ylw: '\x1b[33m', blu: '\x1b[34m', rst: '\x1b[0m' };
let seq = 0;
function emit(type, payload = {}) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  out.write(JSON.stringify(ev) + '\n');
  const col = { 'arm.PASS': C.grn, 'arm.FAIL': C.red, 'arm.NULL': C.ylw, 'recall': C.blu, 'entity': C.cyn, 'summary': C.mag, 'run.error': C.red }[type] || '';
  const keys = Object.keys(payload);
  let s = `${col}● ${type}${C.rst}`;
  if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]}`).join(' ')}${C.rst}`;
  console.error(s);
}

// SAME store contents as probe-10: right lesson (userId code — does NOT contain any target's answer) +
// the two rich wrong distractors that probe-10 showed OUTRANK it + the far ones.
const RIGHT_TEXT =
  `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
  `export function userId(n) {\n  const prefix = 'USER';\n  const paddedId = String(n).padStart(6, '0');\n  const checkChar = prefix[0];\n  return \`\${prefix}-\${paddedId}-\${checkChar}\`;\n}\n\n` +
  `This shows the current ID convention; apply the same rule (adjusting the entity prefix and its check letter) to other entities.`;
const SEED = [
  [RIGHT, RIGHT_TEXT],
  ['wrong-rich-legacy',
    `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
    `export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n  const checkChar = prefix[prefix.length - 1];\n  return \`\${prefix}_\${paddedId}_\${checkChar}\`;\n}\n\n` +
    `This was the legacy v1 ID convention; it is deprecated and must not be used for new entities.`],
  ['wrong-rich-twin',
    `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n` +
    `export function userId(n) {\n  const prefix = 'user';\n  const paddedId = String(n).padStart(4, '0');\n  const checkChar = prefix[prefix.length - 1];\n  return \`\${prefix}_\${paddedId}_\${checkChar}\`;\n}\n\n` +
    `This shows the current ID convention; apply the same rule (adjusting the entity prefix and its check letter) to other entities.`],
  ['url-slug', 'URL slugs: lowercase the title, replace spaces with hyphens, strip punctuation. Example: "My Post!" -> "my-post".'],
  ['promo-code', 'Promotional short codes are exactly 4 uppercase alphanumeric characters with no prefix and no separators, e.g. "7K2X".'],
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) returning "$X.XX".'],
];

const ALL_ENTITIES = ['orderId', 'accountId', 'invoiceId', 'ticketId', 'auditBadge'];
const ENTITIES = (process.env.RELAYFACT_ENTITIES ? process.env.RELAYFACT_ENTITIES.split(',') : ALL_ENTITIES).map((s) => s.trim());

const resolveTarget = (p) => join(FIX_DIR, basename(String(p || '')));
const editTool = {
  name: 'edit_file',
  description: 'Overwrite a source file with new contents. Pass the file name. Returns {ok,bytes}.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
  execute: async ({ path, contents }) => { writeFileSync(resolveTarget(path), contents); return { ok: true, bytes: contents.length }; },
};
const actionTranslator = (name, args, ctx) => {
  if (name === 'edit_file') return { type: 'write', path: resolveTarget(args?.path), args, _ctx: ctx };
  return { type: name, args, _ctx: ctx };
};
const PERSONA = [
  'You are a senior engineer in this project. Source files live in:', FIX_DIR + '.',
  'Apply fixes by calling edit_file with the FILENAME and full new contents.',
  'Each file must `export function <name>(...)`. Vanilla JS, no deps. Never edit tests.',
].join(' ');
const recallQuery = (fn) => `${fn}() produced the wrong entity ID format and its test failed. What is the current project convention for formatting an entity ID (prefix, padding, check character)?`;

function runSuite(testFile) {
  const r = spawnSync('node', ['--test', testFile], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, output: ((r.stdout || '') + (r.stderr || '')).slice(0, 300) };
}

async function runArm(lc, fn, useRecall, topN = 3) {
  const testFile = `${fn}.test.js`;
  const target = join(FIX_DIR, `${fn}.js`);
  const armName = !useRecall ? 'blind' : `recall${topN}`;
  copyFileSync(join(FIX_DIR, `${fn}.stub.js`), target);
  const auditPath = join(__dir, `run-probe11-${fn}-${armName}-audit.jsonl`);
  rmSync(auditPath, { force: true });

  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD }, limits: { maxTurns: 24, maxDepth: 1, maxChildren: 1 },
    fs: { writeScope: [target], readScope: [] }, bash: { allow: [] }, audit: { path: auditPath },
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });
  const stream = new Stream();

  let rightRank = null, threadedIds = [];
  const sensor = async () => {
    const v = runSuite(testFile);
    if (v.pass) return { pass: true, status: 'satisfied', critique: null };
    let critique = `${fn}() is wrong: the test failed. The required ID format is a fixed PROJECT CONVENTION — `
      + `it is not something to guess and it is not in any file you can read here.`;
    if (useRecall) {
      const hits = await lc.recall(recallQuery(fn), { kind: 'fact', n: 6, body: true });
      const ranking = hits.map((h) => h.path);
      rightRank = ranking.indexOf(RIGHT);
      const top = hits.slice(0, topN);
      threadedIds = top.map((h) => h.path);
      emit('recall', { fn, topN, rightRank, threaded: threadedIds, rightThreaded: threadedIds.includes(RIGHT) });
      critique += `\n\nMost relevant project notes recalled from memory (some may be outdated — judge which applies):\n`
        + top.map((h, i) => `(${i + 1}) [${h.path}] ${h.body}`).join('\n');
    }
    return { pass: false, status: 'unmet', critique };
  };

  const task = `Implement ${fn}.js so \`node --test ${testFile}\` passes. It must \`export function ${fn}(n)\` and format an entity ID. `
    + `Apply your fix with edit_file, then stop.`;
  let result;
  try { result = await recurse(task, { provider, policy, onLlmResult, stream }, { persona: PERSONA, tools: [editTool], maxDepth: 0, refineLeaf: { sensor } }); }
  catch (e) { emit('run.error', { fn, arm: useRecall ? 'recall' : 'blind', message: e.message }); return { pass: false, error: e.message }; }

  const v = runSuite(testFile);
  const rl = result.receipts?.refineLeaf;
  const src = (() => { try { return readFileSync(target, 'utf8').replace(/\s+/g, ' ').slice(0, 100); } catch { return ''; } })();
  return { pass: v.pass, iterations: rl?.iterations ?? null, rightRank, threadedIds, src };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY' }); out.end(() => { process.exitCode = 2; }); return; }
  const { LiteCtx } = await import('litectx');
  rmSync(memRoot, { recursive: true, force: true });
  const lc = new LiteCtx({ root: memRoot });
  for (const [id, t] of SEED) await lc.remember(id, t, { kind: 'fact' });
  emit('seed', { n: SEED.length, note: 'incl. 2 rich wrong distractors that probe-10 showed OUTRANK the right rule under Q_fail' });

  // Three arms:
  //   blind    — no recall (control: convention not guessable → should fail)
  //   recall3  — thread top-3 (probe-09's depth). probe-10 says the right rule ranks ~#3, so top-3 likely
  //              EXCLUDES it → isolates "ranking starved the worker"
  //   recall4  — thread top-4, which INCLUDES the right rule alongside the wrong ones → isolates "can the
  //              worker DISCRIMINATE right-from-wrong when it actually sees the right note?"
  const tally = { blind: { pass: 0, n: 0 }, recall3: { pass: 0, n: 0 }, recall4: { pass: 0, n: 0 } };
  const rows = [];
  for (const fn of ENTITIES) {
    emit('entity', { fn, distant: fn === 'auditBadge' });
    const blind = await runArm(lc, fn, false);
    tally.blind.n++; if (blind.pass) tally.blind.pass++;
    emit('arm.blind', { fn, pass: blind.pass, note: blind.pass ? 'blind PASSED — convention guessable here (honest null)' : 'control held — not guessable blind', src: blind.src });

    const r3 = await runArm(lc, fn, true, 3);
    tally.recall3.n++; if (r3.pass) tally.recall3.pass++;
    emit(r3.pass ? 'arm.PASS' : 'arm.FAIL', { fn, arm: 'recall3', pass: r3.pass, iterations: r3.iterations, rightRank: r3.rightRank, rightThreaded: r3.threadedIds.includes(RIGHT), src: r3.src });

    const r4 = await runArm(lc, fn, true, 4);
    tally.recall4.n++; if (r4.pass) tally.recall4.pass++;
    emit(r4.pass ? 'arm.PASS' : 'arm.FAIL', { fn, arm: 'recall4', pass: r4.pass, iterations: r4.iterations, rightRank: r4.rightRank, rightThreaded: r4.threadedIds.includes(RIGHT), src: r4.src });

    rows.push({ fn, distant: fn === 'auditBadge', blind: blind.pass, recall3: r3.pass, recall4: r4.pass, rightRank: r4.rightRank });
  }

  emit('summary', {
    blindRate: `${tally.blind.pass}/${tally.blind.n}`,
    recall3Rate: `${tally.recall3.pass}/${tally.recall3.n}`,
    recall4Rate: `${tally.recall4.pass}/${tally.recall4.n}`,
    rows,
    reading: 'recall3 (right note usually NOT threaded) isolates ranking-starvation; recall4 (right note IS threaded with the wrong ones) isolates worker discrimination. blind is the not-guessable control.',
  });
  // "lift" now means: does seeing the right note among wrong ones (recall4) beat blind?
  const lift = tally.recall4.pass > tally.blind.pass;
  out.end(() => { process.exitCode = lift ? 0 : 1; });
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); out.end(() => { process.exitCode = 1; }); });
