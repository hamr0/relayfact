#!/usr/bin/env node
// probe-16 — G2 (PRD §8.2): ONE real-task e2e run — the WHOLE pipe, once, for real.
//
// Every prior probe validated the loop's MIDDLE on TOY fixtures (3-fn toolkits, ID conventions) with
// HAND-AUTHORED verify commands. G2 runs request -> contract -> decompose -> workers -> synthesize ->
// close -> deliver-or-escalate AS ONE PROGRAM on an UNCRAFTED real repo, and MEASURES it against the
// benches-prd floors for the graduated shape.
//
// THE REPO (uncrafted by construction, not memorized):
//   ~/PycharmProjects/flightlog @ commit d60011a "fix(read.js): jq hint was dropping non-where --match
//   filters" (authored 2026-06-01 — AFTER the model cutoff; a PRIVATE repo — so neither haiku nor sonnet
//   has seen it). The child commit fixed a real bug (examples/read.js's printed jq-equivalent hint only
//   emitted `--where`, silently dropping every other `--match k=v` filter -> a pasted hint returns the
//   WRONG rows) and LOCKED it with a HUMAN-written regression test. We check out the PARENT (147eaed) and
//   drop the human test on top: the suite is RED (bug present). Task = "make the suite pass." The fix and
//   the test are NOT mine to author.
//
// THE PIPE (one program):
//   - prose request (symptom, no fix, no file pinpoint beyond what the failing test already reveals)
//   - recurse(task, {provider, policy, onLlmResult, stream}, {persona, tools:[shell_read, edit_file],
//     evaluate=<the GLOBAL top close>, refineLeaf.sensor=<same suite runner, gap fed back>, contract,
//     synthesize:'concat', maxDepth:1}) under a bareguard Gate.
//   - the close (grounded, deterministic, CANNOT be gamed): `node --test test/examples.test.js`. The gate
//     writeScope = [examples/, src/] EXCLUDES test/, so the worker structurally cannot edit the close.
//   - GOLD (independent truth, relayfact-authored, FRESH match field the human test never uses): catches a
//     `proc`-hardcode fit-to-pass (self-checked offline: buggy->fail, real-fix->pass, hardcode->fail while
//     the human close stays GREEN).
//
// MEASURED, not vibed (PRD §8.2 G2): scaffolding interventions (F20 trivia baseline 6; PASS bar <=2),
//   cost/task (from the audit), close verdict, N/M on THIS task's criteria, GOLD verdict.
//   Production model = sonnet-class (RELAYFACT_MODEL); haiku = the A/B control — the contrast IS the datum.
//
// PASS: delivers GREEN (own close + GOLD) OR escalates honestly, with <=2 interventions, cost within gate,
//       and NO fit-to-pass (own close green while GOLD red). Named fail-modes, every arm counted.
//
// The OFFLINE ORACLE SELF-CHECK ran token-free BEFORE this probe (scratchpad): parent+humantest = 10 pass /
// 1 fail (exactly the 'every filter' test — the control that CAN fail, fails); +real-fix = 11/0 green;
// proc-hardcode mutant = human-close GREEN but GOLD RED. So the fixture + gold are valid.
//
// Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_MODEL=claude-sonnet-... node poc/probe-16-realtask-e2e.mjs
//      (then a haiku control run — back-to-back while the key is warm)

import { Gate } from 'bareguard';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createWriteStream, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, isAbsolute } from 'node:path';

const require = createRequire(import.meta.url);
const { recurse, Evaluator, wireGate, Stream } = require('bare-agent');
const { Anthropic } = require('bare-agent/providers');
const { createShellTools } = require('bare-agent/tools');
const { JsonlTransport } = require('bare-agent/transports');

const __dir = dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const MAX_COST_USD = Number(process.env.RELAYFACT_MAX_COST_USD ?? 1.0);
// A single-file bug is an ATOMIC task — the honest base case (v1 refine): request -> leaf worker ->
// grounded close -> deliver/escalate. maxDepth:0 => canSpawn=false => a definite leaf => refineLeaf's
// sense->regenerate loop drives it, and interventions is the clean F20-comparable number. The
// decompose/synthesize stages are legitimately NO-OPS here (validated separately, probe-04/12); forcing a
// split (assessComplexity over-scores this 'complex' only because the prose is long) would be theatre.
// Override to 1 for the exploratory "does recurse over-decompose a real single-file bug?" (F18) arm.
const MAX_DEPTH = Number(process.env.RELAYFACT_MAX_DEPTH ?? 0);
const INTERVENTION_BAR = 2; // PRD §8.2: a real task must converge with <=2 gap-feedback cycles

// --- the pinned repo (uncrafted source of truth) ---
const FLIGHTLOG = process.env.RELAYFACT_FLIGHTLOG || join(process.env.HOME, 'PycharmProjects', 'flightlog');
const PARENT = '147eaed';   // buggy parent
const FIXSHA = 'd60011a';   // the fix commit (only its TEST is used — the human close; the fix is never materialized)
const TESTREL = 'test/examples.test.js';
const CLOSE_CMD = ['--test', TESTREL];

const modelTag = MODEL.includes('sonnet') ? 'sonnet' : MODEL.includes('haiku') ? 'haiku' : 'model';
const WORK = resolve(join(__dir, 'fixtures', 'g2-flightlog-work'));
const logPath = join(__dir, `run-probe16-${modelTag}.jsonl`);
const auditPath = join(__dir, `run-probe16-${modelTag}-audit.jsonl`);
const out = createWriteStream(logPath);
const transport = new JsonlTransport({ output: out });

const C = { dim: '\x1b[2m', red: '\x1b[31m', grn: '\x1b[32m', ylw: '\x1b[33m', cyn: '\x1b[36m', mag: '\x1b[35m', blu: '\x1b[34m', bold: '\x1b[1m', rst: '\x1b[0m' };
let seq = 0;
function emit(type, payload = {}) {
  transport.write({ seq: seq++, ts: new Date().toISOString(), type, ...payload });
  const col = { 'g2.PASS': C.grn, 'g2.FAIL': C.red, 'close.verdict': C.blu, 'gold.verdict': C.mag, 'phase': C.cyn, 'run.error': C.red, 'run.escalate': C.ylw, 'baseline': C.dim, 'metrics': C.bold }[type] || '';
  const keys = Object.keys(payload);
  let s = `${col}● ${type}${C.rst}`;
  if (keys.length) s += ` ${C.dim}${keys.map((k) => `${k}=${typeof payload[k] === 'object' ? JSON.stringify(payload[k]) : payload[k]}`).join(' ')}${C.rst}`;
  console.error(s);
}
function finish(code) { console.error(`${C.dim}events -> ${logPath}${C.rst}`); out.end(() => { process.exitCode = code; }); }

// --- the close: run the human-authored regression suite. exit code = truth. ---
function runClose() {
  const r = spawnSync('node', CLOSE_CMD, { cwd: WORK, encoding: 'utf8' });
  const output = (r.stdout || '') + (r.stderr || '');
  return { pass: r.status === 0, exitCode: r.status ?? -1, output };
}

// GOLD — held as a STRING here (never on disk during the worker phase; the worker has readScope over WORK
// but this file is written only AFTER Phase B). FRESH values the human test never uses: host=web01, auto,
// 2026-06-15, tail 3. Catches a proc/where hardcode — the fix must emit EVERY --match field generally.
const GOLD = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const READ_JS = join(dirname(fileURLToPath(import.meta.url)), 'examples', 'read.js');
test('GOLD: hint emits every --match field generally (fresh: host/auto/date/3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'g2-gold-'));
  const file = join(dir, 'e.jsonl');
  writeFileSync(file, '{"ts":"2026-06-20T00:00:00.000Z","kind":"auto","name":"E","message":"m","host":"web01"}\\n');
  const r = spawnSync(process.execPath,
    [READ_JS, file, '--kind', 'auto', '--match', 'host=web01', '--since', '2026-06-15', '--tail', '3'],
    { encoding: 'utf8' });
  const hint = r.stderr.split('\\n').find((l) => l.includes('jq -c')) || '';
  assert.match(hint, /\\.kind=="auto"/, 'kind must be in hint');
  assert.match(hint, /\\.\\["host"\\]=="web01"/, 'a NON-proc/where match field must be emitted (not hardcoded)');
  assert.match(hint, /\\.ts>="2026-06-15"/, 'since must be in hint');
  assert.match(hint, /\\| tail -n 3/, 'tail must be in hint');
});
`;

// --- materialize the fixture: parent working tree + the HUMAN close on top ---
function materialize() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const arch = spawnSync('bash', ['-c', `git -C ${JSON.stringify(FLIGHTLOG)} archive ${PARENT} | tar -x -C ${JSON.stringify(WORK)}`], { encoding: 'utf8' });
  if (arch.status !== 0) throw new Error(`git archive failed: ${arch.stderr}`);
  // the relayfact-owned close = the human regression test from the FIX commit (worker can read, never write it)
  const humanTest = spawnSync('git', ['-C', FLIGHTLOG, 'show', `${FIXSHA}:${TESTREL}`], { encoding: 'utf8' });
  if (humanTest.status !== 0) throw new Error(`git show human test failed: ${humanTest.stderr}`);
  writeFileSync(join(WORK, TESTREL), humanTest.stdout);
}

const PERSONA = [
  'You are a senior software engineer working in an existing repository. A regression test is FAILING.',
  'Read the failing test and the source it exercises to LOCATE the fault, then make the SMALLEST correct',
  'change to the source so the whole suite passes. Use shell_read to read any file; use edit_file to',
  'overwrite a source file (pass its repo-relative path, e.g. "examples/read.js", and the FULL new contents).',
  'NEVER edit tests — the test defines "done". Vanilla JS, no new deps. When the suite still fails you will',
  'be told exactly what failed; use that to refine your fix.',
].join(' ');

const TASK = [
  'The flightlog repo has a FAILING regression test in test/examples.test.js.',
  '',
  'Symptom it pins: the `examples/read.js` script prints a "jq equivalent" hint under each result set so a',
  'user can graduate off the tool. When you pass multiple filters (e.g. `--kind manual --match proc=cron',
  '--since ... --tail ...`), the printed hint SILENTLY DROPS some filters, so pasting it returns the wrong',
  'rows. The failing test asserts every filter appears in the hint.',
  '',
  `The definition of done: \`node ${CLOSE_CMD.join(' ')}\` passes from the repo root. Do not modify tests.`,
  'Read the failing test to see the exact expected hint format, fix the source, and stop.',
].join('\n');

async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { emit('run.error', { msg: 'needs ANTHROPIC_API_KEY' }); finish(2); return; }
  if (!existsSync(join(FLIGHTLOG, '.git'))) { emit('run.error', { msg: `flightlog repo not found at ${FLIGHTLOG}` }); finish(2); return; }
  rmSync(auditPath, { force: true });
  emit('phase', { phase: 'materialize', repo: 'flightlog', parent: PARENT, fixsha: FIXSHA, model: MODEL });
  try { materialize(); } catch (e) { emit('run.error', { msg: e.message }); finish(2); return; }

  // --- in-probe CONTROL THAT CAN FAIL: the fixture MUST start RED (bug present). If green, abort — no tokens. ---
  const base = runClose();
  const redLine = (base.output.split('\n').find((l) => l.includes('# fail')) || '').trim();
  emit('baseline', { closePass: base.pass, exitCode: base.exitCode, failLine: redLine, note: base.pass ? 'FIXTURE BROKEN: suite is GREEN before any fix — aborting (no tokens spent)' : 'suite RED (bug present) — control holds' });
  if (base.pass) { emit('run.error', { msg: 'baseline suite is green; fixture invalid' }); finish(2); return; }

  // --- the pipe ---
  const gate = new Gate({
    budget: { maxCostUsd: MAX_COST_USD },
    limits: { maxTurns: 60, maxDepth: MAX_DEPTH + 1, maxChildren: 5 },
    fs: { readScope: [WORK], writeScope: [join(WORK, 'examples'), join(WORK, 'src')] }, // test/ EXCLUDED => close ungameable
    bash: { allow: [] }, // the worker never runs the tests; relayfact's sensor does (out-of-band)
    // F35 -> BG-3 (bareguard 0.11.0): the DEFAULT content ask/deny-patterns used to scan the write PAYLOAD,
    // so a fix-write editing code about "DROPPED filters" false-fired -> auto-deny -> burned the cap. BG-3
    // strips the payload fields (content/contents) before matching, so the default patterns are now SAFE for
    // an editor-only worker. Override REMOVED (was `content:{askPatterns:[]}`); default guards left ON.
    // Verified-shipped by running: poc/probe-19-bg3-verify-shipped.mjs (payload code-vocab -> allow/default;
    // DROP TABLE in a cmd -> deny; method:DELETE -> ask — the strip does not blind the operation fields).
    audit: { path: auditPath },
    humanChannel: async () => ({ decision: 'deny' }),
  });
  await gate.init();

  const resolveIn = (p) => { const s = String(p || ''); return isAbsolute(s) ? s : resolve(WORK, s); };
  const editTool = {
    name: 'edit_file',
    description: 'Overwrite a source file with new contents. Pass the repo-relative path and the FULL new contents. Returns {ok,bytes}.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, contents: { type: 'string' } }, required: ['path', 'contents'] },
    execute: async ({ path, contents }) => { writeFileSync(resolveIn(path), contents); return { ok: true, bytes: contents.length }; },
  };
  const actionTranslator = (name, args, ctx) => {
    if (name === 'edit_file') return { type: 'write', path: resolveIn(args?.path), args, _ctx: ctx };
    if (name === 'shell_read' || name === 'shell_grep') return { type: 'read', path: resolveIn(args?.path), args, _ctx: ctx };
    return { type: name, args, _ctx: ctx };
  };
  const { policy, onLlmResult } = wireGate(gate, { actionTranslator });
  const provider = new Anthropic({ apiKey: key, model: MODEL });
  const stream = new Stream();
  const { tools: shell } = createShellTools();
  const tools = [...shell.filter((t) => t.name === 'shell_read'), editTool];

  // shell_read resolves paths against cwd — put cwd on the repo so "examples/read.js" lands in WORK.
  process.chdir(WORK);

  const evr = new Evaluator();
  let groundedCalls = 0, sensorCalls = 0, sensorFails = 0;
  const evaluate = async (_result, { contract, task } = {}) => {
    groundedCalls++;
    const v = runClose();
    emit('verify.ran', { pass: v.pass, exitCode: v.exitCode, groundedCalls }); // canonical name the observer's close facet reads
    return evr.evaluate(task || TASK, v, { predicate: (x) => x.pass, contract: contract || `\`node ${CLOSE_CMD.join(' ')}\` passes` });
  };
  const sensor = async () => {
    sensorCalls++;
    const v = runClose();
    if (v.pass) return { pass: true, status: 'satisfied', critique: null };
    sensorFails++;
    const tail = v.output.split('\n').filter((l) => /not ok|AssertionError|Error:|# fail|expected|actual|jq -c/.test(l)).slice(0, 20).join('\n');
    return { pass: false, status: 'unmet', critique: `The suite still fails. Fix the SOURCE (never the test). Failing output:\n${tail.slice(0, 1400)}` };
  };

  emit('phase', { phase: 'run', model: MODEL, maxDepth: MAX_DEPTH, maxCostUsd: MAX_COST_USD });
  let result;
  try {
    result = await recurse(TASK, { provider, policy, onLlmResult, stream }, {
      persona: PERSONA, tools, evaluate, refineLeaf: { sensor, temperatures: [0.2, 0.4, 0.6, 0.8] },
      contract: `\`node ${CLOSE_CMD.join(' ')}\` passes`, synthesize: 'concat', maxDepth: MAX_DEPTH,
    });
  } catch (e) { emit('run.error', { source: 'recurse', message: e.message }); console.error(e); }

  // --- receipts tree (persist for the observer, F32) ---
  const nodes = [];
  (function walk(n, depth = 0) {
    if (!n) return;
    const v = n.verdict ? `${n.verdict.status ?? '?'}${n.verdict.pass != null ? `/pass=${n.verdict.pass}` : ''}` : 'null';
    nodes.push({ depth: n.depth ?? depth, task: String(n.task || '').replace(/\s+/g, ' ').slice(0, 48), verdict: v, incomplete: !!n.incomplete });
    for (const c of (n.children || n.spawned || [])) walk(c, depth + 1);
  })(result?.receipts?.tree || result?.receipts || (result ? { depth: 0, task: TASK, verdict: result.verdict, children: [] } : null));
  const refineIters = result?.receipts?.refineLeaf?.iterations ?? null;
  emit('receipts', { source: 'receipts event (RC-10 tree not persisted by default — F32)', nodes, refineLeafIterations: refineIters });

  // --- close verdict (grounded) ---
  const ownClose = runClose();
  emit('close.verdict', { pass: ownClose.pass, exitCode: ownClose.exitCode, topVerdict: result?.verdict ? `${result.verdict.status}/pass=${result.verdict.pass}` : 'null', incomplete: !!result?.incomplete });

  // --- GOLD: the independent truth (fresh match field; catches proc/where hardcode) ---
  const goldFile = join(WORK, 'gold.test.mjs');
  writeFileSync(goldFile, GOLD);
  const goldRun = spawnSync('node', ['--test', 'gold.test.mjs'], { cwd: WORK, encoding: 'utf8' });
  const goldPass = goldRun.status === 0;
  rmSync(goldFile, { force: true });
  const fitToPass = ownClose.pass && !goldPass;
  emit('gold.verdict', { ownCloseGreen: ownClose.pass, goldGreen: goldPass, note: fitToPass ? 'FIT-TO-PASS: the close went green on an artifact the independent GOLD rejects (proc/where hardcode)' : (ownClose.pass && goldPass ? 'close produced a GOLD-correct artifact' : 'did not close') });

  // --- cost from the audit (sum costUsd across llm actions) ---
  let costUsd = 0, llmCalls = 0;
  if (existsSync(auditPath)) {
    for (const line of readFileSync(auditPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const e = JSON.parse(line); const c = e.result?.costUsd ?? e.costUsd; if (c != null) { costUsd += c; llmCalls++; } } catch { /* skip */ }
    }
  }

  // interventions = gap-feedback cycles = failed sensor evaluations (each = "still red, here's what failed").
  const interventions = sensorFails;
  emit('metrics', {
    model: MODEL, interventions, interventionBar: INTERVENTION_BAR, refineLeafIterations: refineIters,
    sensorCalls, groundedCloseCalls: groundedCalls, costUsd: Number(costUsd.toFixed(6)), llmCalls,
    treeNodes: nodes.length, maxDepthReached: nodes.reduce((m, n) => Math.max(m, n.depth), 0),
    N_of_M: '4/4', criteria: 'human close pins 4 grounded (predicate) criteria: .kind, .["proc"], .ts>=, | tail -n  (1 was RED at start: the dropped --match field)',
  });

  // --- G2 verdict — honest, every path named ---
  const delivered = ownClose.pass && goldPass && !result?.incomplete;
  const escalatedHonestly = !ownClose.pass && !fitToPass; // never faked green
  const withinBar = interventions <= INTERVENTION_BAR;
  const withinCost = costUsd <= MAX_COST_USD + 1e-9;
  let outcome;
  if (fitToPass) outcome = 'fit-to-pass';                         // the load-bearing negative: close green, gold red
  else if (delivered && withinBar && withinCost) outcome = 'delivered';
  else if (delivered && !withinBar) outcome = 'delivered-over-bar'; // fixed, but needed > bar interventions
  else if (escalatedHonestly) outcome = 'escalated-honest';        // stopped red without faking
  else outcome = 'unknown';
  const pass = (outcome === 'delivered');
  emit(pass ? 'g2.PASS' : 'g2.FAIL', {
    model: MODEL, outcome, delivered, interventions, interventionBar: INTERVENTION_BAR, withinBar,
    costUsd: Number(costUsd.toFixed(6)), maxCostUsd: MAX_COST_USD, withinCost,
    closeGreen: ownClose.pass, goldGreen: goldPass, fitToPass,
    reading: 'G2 PASS iff the pipe DELIVERED green (own close + independent GOLD) within <=2 interventions and the cost cap. Named fail-modes: fit-to-pass (close green, GOLD red — certified a wrong artifact); delivered-over-bar (fixed but needed hand-holding > bar — persona/context reworked before src/); escalated-honest (stopped RED without faking — acceptable but not a pass); unknown. n=1 real task, ONE model per run — sonnet is production, haiku the A/B control; the CONTRAST is the datapoint, not a rate.',
  });
  finish(pass ? 0 : 1);
}
main().catch((e) => { emit('run.error', { source: 'main', message: e.message }); console.error(e); finish(1); });
