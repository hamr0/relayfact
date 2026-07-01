#!/usr/bin/env node
// probe-09 — the HONEST memory-loop test, rebuilt after probe-06/07/08 were caught fit-to-pass.
// See memory `no-fit-to-pass-tests`. Every rig from those probes is removed here:
//   RIG (06/07/08)                                  FIX (here)
//   recalled lesson contained the literal answer →  lesson is a transferable RULE; run-2's answers are NOT in it
//   run 1 was HANDED the value via context        →  run 1 DISCOVERS the rule from a readable runbook (a real read)
//   "transfer" to a renamed sibling, same constant→  run 2 is a DIFFERENT entity needing the rule re-applied
//                                                    (different prefix AND different check letter)
//   far distractors (nHits=2, no competition)     →  a NEAR distractor (a WRONG legacy id rule) + others that
//                                                    share id/format vocabulary → recall must actually rank
//   recall query hand-tuned to the answer         →  query derived from the FAILURE, describes the problem only
//   only #1 threaded / claim inflated             →  thread top-3 (realistic), log the FULL ranking, and report
//                                                    whatever happens — including an honest null or a failure.
//
// This test CAN fail three honest ways: (a) the OFF control could accidentally guess the convention (→ no lift,
// reported as such); (b) recall could rank the WRONG (legacy) rule top; (c) recall could surface the right rule
// and the model still misapplies it to orderId. I run each phase ONCE and report the real result — no tuning.
//
// Run IN ORDER (persistent store poc/.litectx-probe09):
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-09-memory-honest.mjs learn
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-09-memory-honest.mjs apply-off
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-09-memory-honest.mjs apply-on

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
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 1.0);
const FIX_DIR = resolve(join(__dir, 'fixtures', 'idfmt'));
const RUNBOOK = join(FIX_DIR, 'runbook.md');
const memRoot = join(__dir, '.litectx-probe09');
const LESSON_ID = 'lesson:entity-id-format';
const EXPECT = { learn: 'USER-000007-U', apply: 'ORDER-000042-O' }; // for the probe's own reporting ONLY; never shown to the worker.

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', ylw: '\x1b[33m', rst: '\x1b[0m' };

// Near + far distractors. legacy-id is the dangerous one: same domain, WRONG (lowercase, no pad) — recall
// must rank the CURRENT rule above it, and threading both means the model could be misled. That's realistic.
const DISTRACTORS = [
  ['legacy-id-format', 'Legacy v1 entity IDs used a different format: lowercase entity name, an underscore, then the raw number with NO zero-padding and NO check character. Example: user 7 -> "user_7". Do not use for new code.'],
  ['url-slug', 'URL slugs: lowercase the title, replace spaces with hyphens, strip punctuation. Example: "My Post!" -> "my-post".'],
  ['promo-code', 'Promotional short codes are exactly 4 uppercase alphanumeric characters with no prefix and no separators, e.g. "7K2X".'],
  ['money-cents', 'Money is stored as integer cents; format for display with fmtCents(n) returning "$X.XX".'],
  ['timestamp', 'All timestamps are UTC ISO-8601 strings; never local time.'],
];

const PHASES = {
  learn:       { fn: 'userId',  test: 'userId.test.js',  recall: false, read: true  },
  'apply-on':  { fn: 'orderId', test: 'orderId.test.js', recall: true,  read: false },
  'apply-off': { fn: 'orderId', test: 'orderId.test.js', recall: false, read: false },
};
const phase = (process.argv[2] || '').toLowerCase();
const P = PHASES[phase];
if (!P) { console.error(`unknown phase "${phase}" — use (in order): learn | apply-off | apply-on`); process.exit(2); }

const TARGET = join(FIX_DIR, `${P.fn}.js`);
const logPath = join(__dir, `run-probe09-${phase}.jsonl`);
const auditPath = join(__dir, `run-probe09-${phase}-audit.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });
let seq = 0;
function emit(type, payload = {}, quiet = false) {
  const ev = { seq: seq++, ts: new Date().toISOString(), type, ...payload };
  transport.write(ev);
  if (!quiet) {
    const col = { 'verify.PASS': C.grn, 'verify.FAIL': C.red, 'verify.NULL': C.ylw, 'run.error': C.red, 'phase.start': C.cyn, 'observe': C.mag, 'recall.consumed': C.blu, 'lesson.stored': C.blu, 'memory.seeded': C.blu }[type] || '';
    let s = `${col}● ${type}${C.rst}`;
    const keys = Object.keys(payload).filter((k) => k !== 'seq' && k !== 'ts');
    if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${fmt(payload[k])}`).join(' ')}${C.rst}`;
    console.error(s);
  }
}
const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v));
function finish(code) {
  console.error(`${C.dim}events -> ${logPath}${C.rst}\n${C.dim}store  -> ${memRoot}${C.rst}`);
  out.end(() => { process.exitCode = code; });
}
function runSuite() {
  const r = spawnSync('node', ['--test', P.test], { cwd: FIX_DIR, encoding: 'utf8' });
  return { pass: r.status === 0, exitCode: r.status ?? -1, output: ((r.stdout || '') + (r.stderr || '')).slice(0, 400) };
}

const resolveTarget = (p) => join(FIX_DIR, basename(String(p || '')));
const editTool = {
  name: 'edit_file',
  description: 'Overwrite a source file with new contents. Pass the file name. Returns {ok,bytes}.',
  parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
  execute: async ({ path, contents }) => { writeFileSync(resolveTarget(path), contents); return { ok: true, bytes: contents.length }; },
};
// read_file is offered ONLY in run 1 (learn) and scoped to the runbook — the agent must actually read to learn.
const readTool = {
  name: 'read_file',
  description: 'Read a UTF-8 text file by name (e.g. "runbook.md"). Returns {contents}.',
  parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  execute: async ({ path }) => ({ contents: readFileSync(resolveTarget(path), 'utf8') }),
};
const actionTranslator = (name, args, ctx) => {
  if (name === 'edit_file') return { type: 'write', path: resolveTarget(args?.path), args, _ctx: ctx };
  if (name === 'read_file') return { type: 'read', path: resolveTarget(args?.path), args, _ctx: ctx };
  return { type: name, args, _ctx: ctx };
};

// Query DERIVED FROM THE FAILURE — names the problem (wrong ID format for <fn>), not the answer. It also
// lexically matches the legacy distractor, so recall has to rank the current rule above it.
const recallQuery = (fn) => `${fn}() produced the wrong entity ID format and its test failed. What is the current project convention for formatting an entity ID (prefix, padding, check character)?`;

const PERSONA = [
  'You are a senior engineer in this project. Source files live in:', FIX_DIR + '.',
  'Apply fixes by calling edit_file with the FILENAME and full new contents.',
  'Each file must `export function <name>(...)`. Vanilla JS, no deps. Never edit tests.',
].join(' ');

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY' }); finish(2); return; }
  rmSync(auditPath, { force: true });

  const { LiteCtx } = await import('litectx');
  if (phase === 'learn') rmSync(memRoot, { recursive: true, force: true });
  if (phase !== 'learn' && !existsSync(memRoot)) { emit('run.error', { msg: `no store — run \`learn\` first` }); finish(2); return; }
  const lc = new LiteCtx({ root: memRoot });
  if (phase === 'learn') { for (const [id, t] of DISTRACTORS) await lc.remember(id, t, { kind: 'fact' }); emit('memory.seeded', { distractors: DISTRACTORS.length, includesNearWrongRule: 'legacy-id-format' }); }

  copyFileSync(join(FIX_DIR, `${P.fn}.stub.js`), TARGET);

  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD }, limits: { maxTurns: 60, maxDepth: 1, maxChildren: 1 },
    fs: { writeScope: [TARGET], readScope: P.read ? [RUNBOOK] : [] }, // runbook readable ONLY in learn
    bash: { allow: [] }, audit: { path: auditPath },
  });
  await gate.init();
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const stream = new Stream();

  let ranking = null, threaded = [];
  const sensor = async () => {
    const v = runSuite();
    if (v.pass) return { pass: true, status: 'satisfied', critique: null };
    let critique = `${P.fn}() is wrong: the test failed. The required ID format is a fixed PROJECT CONVENTION — `
      + `it is not something to guess and it is not in any file you can read here.`;
    if (P.recall) {
      const hits = await lc.recall(recallQuery(P.fn), { kind: 'fact', n: 6, body: true });
      ranking = hits.map((h) => ({ id: h.path, score: Number((h.score ?? 0).toFixed(3)) }));
      const top3 = hits.slice(0, 3);
      threaded = top3.map((h) => h.path);
      emit('recall.consumed', { nHits: hits.length, threaded, ranking }, false);
      if (top3.length) {
        critique += `\n\nMost relevant project notes recalled from memory (some may be outdated — judge which applies):\n`
          + top3.map((h, i) => `(${i + 1}) [${h.path}] ${h.body}`).join('\n');
      }
    }
    return { pass: false, status: 'unmet', critique };
  };

  const task = `Implement ${P.fn}.js so \`node --test ${P.test}\` passes. It must \`export function ${P.fn}(n)\` and format an entity ID. `
    + (P.read ? `You MAY read project docs with read_file (try "runbook.md"). ` : ``)
    + `Apply your fix with edit_file, then stop.`;
  const opts = { persona: PERSONA, tools: P.read ? [readTool, editTool] : [editTool], maxDepth: 0, refineLeaf: { sensor } };

  emit('phase.start', { phase, fn: P.fn, recall: P.recall, canReadRunbook: P.read, distractors: DISTRACTORS.length });

  let result;
  try { result = await recurse(task, { provider, policy, onLlmResult, stream }, opts); }
  catch (e) { emit('run.error', { source: 'recurse', message: e.message }); finish(1); return; }

  const rl = result.receipts?.refineLeaf;
  const v = runSuite();
  const src = (() => { try { return readFileSync(TARGET, 'utf8'); } catch { return ''; } })();
  emit('observe', { refineLeaf: rl, suiteGreen: v.pass, ranking, threaded, artifactHead: src.replace(/\s+/g, ' ').slice(0, 120) });

  if (phase === 'learn') {
    if (v.pass) {
      // store the agent's OWN working code as the lesson. It encodes the RULE (pad6, first-letter check) but
      // is userId-specific — it does NOT contain orderId's answers. Run 2 must adapt it.
      const lessonText = `A past task implemented the project entity-ID format and its tests PASSED. The working code was:\n\n${src.trim()}\n\nThis shows the current ID convention; apply the same rule (adjusting the entity prefix and its check letter) to other entities.`;
      await lc.remember(LESSON_ID, lessonText, { kind: 'fact' });
      emit('lesson.stored', { id: LESSON_ID, kind: 'fact', containsRun2Answer: src.includes(EXPECT.apply), note: 'agent\'s own verified code (the RULE, not orderId\'s answer)' });
      emit('verify.PASS', { phase, msg: `run 1 learned the rule from the runbook and passed; lesson stored among ${DISTRACTORS.length} distractors` });
      finish(0); return;
    }
    emit('verify.FAIL', { phase, msg: `run 1 could not implement userId even WITH the runbook (green=${v.pass}) — honest: the worker is the limit, not memory. out: ${v.output.replace(/\n/g, ' ')}` });
    finish(1); return;
  }

  // APPLY — report the real outcome; this is a measurement, not a target.
  const passed = !!rl && rl.passed === true && v.pass;
  if (P.recall) {
    const currentRuleRank = ranking ? ranking.findIndex((r) => r.id === LESSON_ID) : -1;
    const note = `recall ranking=${JSON.stringify(ranking)} (current-rule lesson at index ${currentRuleRank}; threaded=${JSON.stringify(threaded)})`;
    if (passed) emit('verify.PASS', { phase, msg: `WITH memory: orderId passed by adapting the recalled rule (iterations=${rl.iterations}). ${note}` });
    else emit('verify.FAIL', { phase, msg: `WITH memory: orderId did NOT pass (passed=${rl?.passed} green=${v.pass}). Either ranking buried the rule or the model misapplied it. ${note}` });
    finish(passed ? 0 : 1); return;
  }
  // apply-off: report pass/fail honestly. A PASS here is an honest NULL (memory adds nothing — model guessed it).
  if (passed) { emit('verify.NULL', { phase, msg: `WITHOUT memory orderId PASSED — the convention was guessable, so memory adds no lift here (honest null, not a win for memory).` }); finish(0); return; }
  emit('verify.PASS', { phase, msg: `control held: WITHOUT memory orderId failed (passed=${rl?.passed}, green=${v.pass}) — the convention is genuinely not guessable.` });
  finish(0);
}

main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
