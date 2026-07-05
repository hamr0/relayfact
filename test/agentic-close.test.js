// agentic-close.test.js — D1: the `agentic` eval tier (PRD-v3 §5, the STRONGEST close), token-free.
//
// Every close to date is PREDICATE tier (`node --test` over the SOURCE). The agentic tier EXERCISES the
// DEPLOYED artifact over the real wire (boot the server, hit it on TCP, assert the response) — exit code =
// truth, mapped by the SAME `runClose` (relayfact builds no new primitive: an agentic close is just an
// exercise command). This proves the doctrine claim the eval table is not yet allowed to make:
//   (1) a correct deployed artifact → the agentic close goes GREEN;
//   (2) the agentic close GROUNDS the loop — three real deploy-time faults each drive it RED (fail-capable);
//   (3) it is STRICTLY STRONGER than predicate — an artifact whose handler is unit-GREEN but whose server is
//       never wired is caught RED by the agentic close (the integration gap a source test cannot see).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runClose } from '../src/close.mjs';

// The agentic EXERCISE harness — the close's command. It DEPLOYS the artifact (listen on an OS-assigned port),
// probes it over real HTTP with a bounded timeout, and exits 0=pass / nonzero=fail. It NEVER hangs (fetch
// timeout + a watchdog), so a broken artifact becomes a truthful exit code, not a stuck close. This is the
// agentic analog of the predicate suite: fixed, and the worker is write-scoped OUT of it.
const EXERCISE = `import { createApp } from './server.mjs';
setTimeout(() => { console.error('watchdog: artifact never became ready'); process.exit(1); }, 8000).unref();
const code = await (async () => {
  let server;
  try {
    server = createApp();
    if (!server || typeof server.listen !== 'function') { console.error('createApp did not return an http server'); return 1; }
  } catch (e) { console.error('boot threw: ' + e.message); return 1; }
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const res = await fetch('http://127.0.0.1:' + port + '/health', { signal: AbortSignal.timeout(2500) });
    const body = await res.json().catch(() => null);
    if (res.status !== 200) { console.error('expected 200, got ' + res.status); return 1; }
    if (!body || body.ok !== true) { console.error('expected {ok:true}, got ' + JSON.stringify(body)); return 1; }
    return 0;
  } catch (e) { console.error('probe failed: ' + e.message); return 1; }
  finally { try { server.close(); } catch { /* already down */ } }
})();
process.exit(code);
`;

const CORRECT = `import http from 'node:http';
export function createApp() {
  return http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true })); }
    else { res.writeHead(404); res.end(); }
  });
}
`;
// Handler LOGIC is correct in isolation (health() unit-passes) but the server never ROUTES it → integration red.
const UNWIRED = `import http from 'node:http';
export function health() { return { ok: true }; }
export function createApp() {
  return http.createServer((req, res) => { res.writeHead(404); res.end(); }); // /health is NOT wired
}
`;
const UNIT_TEST = `import { health } from './server.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('health() returns ok in isolation', () => { assert.deepEqual(health(), { ok: true }); });
`;
const WRONG_BODY = CORRECT.replace('{ ok: true }', '{ ok: false }');
const HANGS = `import http from 'node:http';
export function createApp() {
  return http.createServer((req, res) => { /* accepts the request, never responds */ });
}
`;
const BOOT_THROWS = `export function createApp() { throw new Error('cannot construct the server'); }
`;

function agenticVerdict(serverSrc) {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-agentic-'));
  writeFileSync(join(dir, 'server.mjs'), serverSrc);
  writeFileSync(join(dir, 'exercise.mjs'), EXERCISE);
  try { return runClose(['node', 'exercise.mjs'], { cwd: dir, timeout: 15000 }); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('a correct DEPLOYED artifact → the agentic close goes GREEN (satisfied)', () => {
  const v = agenticVerdict(CORRECT);
  assert.equal(v.pass, true, v.output);
  assert.equal(v.status, 'satisfied');
  assert.equal(v.exitCode, 0);
});

test('CONTROL — a wrong response body drives the agentic close RED (retryable)', () => {
  const v = agenticVerdict(WRONG_BODY);
  assert.equal(v.pass, false);
  assert.equal(v.status, 'needs_revision');   // the worker can fix the source; the gap is the probe output
  assert.match(v.output, /expected \{ok:true\}/);
});

test('CONTROL — a server that never responds is caught by the timeout, not a hang', () => {
  const v = agenticVerdict(HANGS);
  assert.equal(v.pass, false);
  assert.match(v.output, /probe failed|watchdog/);
});

test('CONTROL — an artifact that throws on boot → RED (not a false green)', () => {
  const v = agenticVerdict(BOOT_THROWS);
  assert.equal(v.pass, false);
  assert.match(v.output, /boot threw|did not return an http server/);
});

test('STRONGEST TIER — unit-GREEN but integration-RED: predicate passes, agentic catches the unwired server', () => {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-agentic-gap-'));
  writeFileSync(join(dir, 'server.mjs'), UNWIRED);
  writeFileSync(join(dir, 'unit.test.mjs'), UNIT_TEST);
  writeFileSync(join(dir, 'exercise.mjs'), EXERCISE);
  try {
    const predicate = runClose(['node', '--test', 'unit.test.mjs'], { cwd: dir, timeout: 15000 });
    const agentic = runClose(['node', 'exercise.mjs'], { cwd: dir, timeout: 15000 });
    assert.equal(predicate.pass, true, 'the handler is correct in isolation — the SOURCE test passes');
    assert.equal(agentic.pass, false, 'but the deployed server never routes /health — the agentic close catches it');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
