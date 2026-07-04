// observer-contract.test.js — the §7 pure-listener invariant + round-trip, with a control that can FAIL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, appendFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEventLog } from '../src/event-log.mjs';
import { readEventLog } from '../src/observer.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-obs-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('emit → persist → read-back is a faithful round-trip, in seq order', () => {
  const { dir, cleanup } = scratch();
  try {
    const path = join(dir, 'run.jsonl');
    const log = createEventLog(path, { clock: () => '2026-07-04T00:00:00.000Z' });
    log.emit('run.start', { model: 'haiku' });
    log.emit('verify.ran', { pass: true, exitCode: 0 });
    log.emit('run.done', { status: 'deliver' });
    const events = readEventLog(path);
    assert.equal(events.length, 3);
    assert.deepEqual(events.map((e) => e.seq), [0, 1, 2]);
    assert.deepEqual(events.map((e) => e.type), ['run.start', 'verify.ran', 'run.done']);
    assert.equal(events[0].model, 'haiku');
    assert.equal(events[2].status, 'deliver');
  } finally { cleanup(); }
});

test('the reader survives a partial/corrupt trailing line (a crashed run)', () => {
  const { dir, cleanup } = scratch();
  try {
    const path = join(dir, 'run.jsonl');
    const log = createEventLog(path, { clock: () => '2026-07-04T00:00:00.000Z' });
    log.emit('run.start');
    appendFileSync(path, '{"seq":1,"type":"verify.ran","pa');  // killed mid-append
    const events = readEventLog(path);
    assert.equal(events.length, 1, 'the good line survives; the corrupt one is skipped, not thrown');
    assert.equal(events[0].type, 'run.start');
  } finally { cleanup(); }
});

test('§7 invariant: the observer imports ONLY node builtins — never the engine or the spine', () => {
  // The control that can FAIL: if the observer ever wires itself to event-log.mjs or a bare-suite engine,
  // this goes red. A pure listener cannot influence control flow — that is what makes every UI a listener.
  const src = readFileSync(resolve(here, '../src/observer.mjs'), 'utf8');
  // Every module SPECIFIER — static `import … from`, dynamic `import(…)`, and `require(…)` — must be a
  // node builtin. Scanning specifiers (not raw substrings) lets the file document the spine by name in a
  // comment while still failing red if it ever actually wires itself to the engine or the spine.
  const specifiers = [
    ...src.matchAll(/\bimport\s+[^;]*?\bfrom\s+['"]([^'"]+)['"]/g),
    ...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...src.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1]);
  assert.ok(specifiers.length > 0, 'expected at least one import to inspect');
  const forbidden = ['event-log', 'bare-agent', 'bareguard', 'litectx'];
  for (const spec of specifiers) {
    assert.ok(spec.startsWith('node:'), `observer must import only node builtins, found: ${spec}`);
    for (const f of forbidden) {
      assert.ok(!spec.includes(f), `observer must not import "${f}" (§7 pure-listener)`);
    }
  }
});
