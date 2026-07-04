// event-log.test.js — the spine's contract, with controls that can FAIL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEventLog } from '../src/event-log.mjs';

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-evlog-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
// A deterministic clock so the ts assertion doesn't depend on wall time.
const fixedClock = () => '2026-07-04T00:00:00.000Z';

test('emit stamps a monotonic seq starting at 0', () => {
  const { dir, cleanup } = scratch();
  try {
    const log = createEventLog(join(dir, 'run.jsonl'), { clock: fixedClock });
    const a = log.emit('run.start');
    const b = log.emit('verify.ran', { pass: true });
    const c = log.emit('run.done');
    assert.deepEqual([a.seq, b.seq, c.seq], [0, 1, 2]);
    assert.equal(log.count, 3);
  } finally { cleanup(); }
});

test('emit preserves type + payload and stamps ts', () => {
  const { dir, cleanup } = scratch();
  try {
    const log = createEventLog(join(dir, 'run.jsonl'), { clock: fixedClock });
    const ev = log.emit('verify.ran', { pass: false, exitCode: 1 });
    assert.equal(ev.type, 'verify.ran');
    assert.equal(ev.pass, false);
    assert.equal(ev.exitCode, 1);
    assert.equal(ev.ts, '2026-07-04T00:00:00.000Z');
  } finally { cleanup(); }
});

test('a payload key can NOT clobber the spine fields (type/seq/ts win)', () => {
  // The control: if spine fields were spread first, this evil payload would hijack sequencing.
  const { dir, cleanup } = scratch();
  try {
    const log = createEventLog(join(dir, 'run.jsonl'), { clock: fixedClock });
    log.emit('real.type', { irrelevant: 1 });
    const ev = log.emit('real.type', { type: 'EVIL', seq: 999, ts: 'FAKE' });
    assert.equal(ev.type, 'real.type');
    assert.equal(ev.seq, 1);
    assert.equal(ev.ts, '2026-07-04T00:00:00.000Z');
  } finally { cleanup(); }
});

test('the log is append-only: each emit adds exactly one line, earlier lines unchanged', () => {
  const { dir, cleanup } = scratch();
  try {
    const path = join(dir, 'run.jsonl');
    const log = createEventLog(path, { clock: fixedClock });
    log.emit('a');
    const after1 = readFileSync(path, 'utf8');
    log.emit('b');
    const after2 = readFileSync(path, 'utf8');
    assert.equal(after1.trimEnd().split('\n').length, 1);
    assert.equal(after2.trimEnd().split('\n').length, 2);
    assert.ok(after2.startsWith(after1), 'the first line must be byte-identical after appending the second');
  } finally { cleanup(); }
});

test('every line is valid JSON', () => {
  const { dir, cleanup } = scratch();
  try {
    const path = join(dir, 'run.jsonl');
    const log = createEventLog(path, { clock: fixedClock });
    log.emit('a', { n: 1 });
    log.emit('b', { nested: { x: [1, 2, 3] } });
    for (const line of readFileSync(path, 'utf8').trimEnd().split('\n')) {
      assert.doesNotThrow(() => JSON.parse(line));
    }
  } finally { cleanup(); }
});

test('a closed log rejects further emits', () => {
  const { dir, cleanup } = scratch();
  try {
    const log = createEventLog(join(dir, 'run.jsonl'), { clock: fixedClock });
    log.emit('a');
    log.close();
    assert.throws(() => log.emit('b'), /closed/);
  } finally { cleanup(); }
});

test('a non-string type and a non-object payload are rejected', () => {
  const { dir, cleanup } = scratch();
  try {
    const log = createEventLog(join(dir, 'run.jsonl'), { clock: fixedClock });
    assert.throws(() => log.emit(''), /type/);
    assert.throws(() => log.emit(42), /type/);
    assert.throws(() => log.emit('a', null), /payload/);
  } finally { cleanup(); }
});
