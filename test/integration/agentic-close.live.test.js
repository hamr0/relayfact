// agentic-close.live.test.js — D1 LIVE (n=1, named): the gated worker driven by an AGENTIC close.
//
// Same worker (src/worker.mjs), same leash — the ONLY change from the predicate live test is the close
// command: `node exercise.mjs` (boot the server, probe it over real HTTP) instead of `node --test`. This
// proves the agentic tier grounds a real red→green loop end-to-end, and that an unsatisfiable agentic
// requirement ESCALATES (the worker can't fake a live server that contradicts itself — the gate write-scopes
// it to server.mjs, never the exercise). Self-skips unless RELAYFACT_LIVE=1. Run:
//   ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_LIVE=1 node --test test/integration/agentic-close.live.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Gate } from 'bareguard';
import { implementAgainstClose } from '../../src/worker.mjs';
import { makeProvider } from '../../src/author.mjs';

const LIVE = process.env.RELAYFACT_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const skip = LIVE ? false : 'set RELAYFACT_LIVE=1 and ANTHROPIC_API_KEY';

// The agentic close: DEPLOY server.mjs and probe GET /health over real TCP. Bounded (fetch timeout + watchdog)
// so a broken artifact is a truthful exit code, never a hang. The worker cannot edit this (gate write-scope).
const EXERCISE = `import { createApp } from './server.mjs';
setTimeout(() => { console.error('watchdog'); process.exit(1); }, 8000).unref();
const code = await (async () => {
  let server;
  try { server = createApp(); if (!server || typeof server.listen !== 'function') { console.error('createApp did not return an http server'); return 1; } }
  catch (e) { console.error('boot threw: ' + e.message); return 1; }
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/health', { signal: AbortSignal.timeout(2500) });
    const body = await res.json().catch(() => null);
    if (res.status !== 200) { console.error('expected 200, got ' + res.status); return 1; }
    if (!body || body.ok !== true) { console.error('expected {ok:true}, got ' + JSON.stringify(body)); return 1; }
    return 0;
  } catch (e) { console.error('probe failed: ' + e.message); return 1; }
  finally { try { server.close(); } catch { /* down */ } }
})();
process.exit(code);
`;
// Contradictory: no single live server can answer /health with BOTH {ok:true} and {ok:false}. Grounds ESCALATE.
const IMPOSSIBLE_EXERCISE = `import { createApp } from './server.mjs';
setTimeout(() => { console.error('watchdog'); process.exit(1); }, 8000).unref();
const code = await (async () => {
  let server;
  try { server = createApp(); if (!server || typeof server.listen !== 'function') { return 1; } } catch { return 1; }
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const get = async () => { const res = await fetch('http://127.0.0.1:' + port + '/health', { signal: AbortSignal.timeout(2500) }); return res.json().catch(() => null); };
  try {
    const a = await get(); const b = await get();
    if (!(a && a.ok === true)) return 1;
    if (!(b && b.ok === false)) return 1;   // impossible together
    return 0;
  } catch { return 1; } finally { try { server.close(); } catch { /* down */ } }
})();
process.exit(code);
`;
const STUB = `import http from 'node:http';
export function createApp() { return http.createServer((req, res) => { res.writeHead(404); res.end(); }); }
`; // RED start: a server that 404s — the worker must wire GET /health.

const TASK = 'Implement createApp() in ./server.mjs so it returns a Node http server that answers GET /health '
  + 'with HTTP 200 and the JSON body {"ok":true}. Use only the node:http builtin, no dependencies. Save the '
  + 'full file with edit_file.';

async function runGated({ exercise, temperatures }) {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-agentic-live-'));
  const serverPath = join(dir, 'server.mjs');
  writeFileSync(join(dir, 'exercise.mjs'), exercise);
  writeFileSync(serverPath, STUB);
  const gate = new Gate({
    budget: { maxCostUsd: Number(process.env.RELAYFACT_MAX_COST_USD ?? 0.6) },
    limits: { maxTurns: 20, maxDepth: 0, maxChildren: 1 },
    fs: { writeScope: [serverPath], readScope: [] }, bash: { allow: [] }, // server.mjs ONLY — not the exercise
    audit: { path: join(dir, 'audit.jsonl') }, humanChannel: async () => ({ decision: 'deny' }),
  });
  await gate.init();
  const provider = makeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });
  const r = await implementAgainstClose({
    task: TASK, workdir: dir, target: serverPath, closeCommand: ['node', 'exercise.mjs'], provider, gate, temperatures,
  });
  rmSync(dir, { recursive: true, force: true });
  return r;
}

test('live: an AGENTIC close (deploy + probe) drives a real red→green and DELIVERS', { skip }, async () => {
  const r = await runGated({ exercise: EXERCISE, temperatures: [0.2, 0.4, 0.6, 0.8] });
  console.error(`[agentic/deliver] outcome=${r.outcome} delivered=${r.delivered} finalClose.pass=${r.finalClose.pass} iters=${r.iterations}`);
  assert.equal(r.delivered, true, 'a real worker should make the deployed /health endpoint green');
  assert.equal(r.finalClose.pass, true);
});

test('live CONTROL: an UNSATISFIABLE agentic close ESCALATES — it never fakes a live green', { skip }, async () => {
  const r = await runGated({ exercise: IMPOSSIBLE_EXERCISE, temperatures: [0.2, 0.5] });
  console.error(`[agentic/impossible] outcome=${r.outcome} delivered=${r.delivered} finalClose.pass=${r.finalClose.pass}`);
  assert.equal(r.delivered, false, 'no live server can satisfy a contradictory probe — the agentic close grounds the loop');
  assert.equal(r.finalClose.pass, false);
});
