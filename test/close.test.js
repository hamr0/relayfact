// close.test.js — the grounded close maps exit code → the RIGHT Verdict tri-state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictFromExit, runClose } from '../src/close.mjs';

test('exit 0 → satisfied (the loop closes GREEN)', () => {
  const v = verdictFromExit({ status: 0, output: 'ok' });
  assert.equal(v.status, 'satisfied');
  assert.equal(v.pass, true);
  assert.equal(v.exitCode, 0);
});

test('nonzero exit (tests ran, failed) → needs_revision, RETRYABLE, carries the gap', () => {
  const v = verdictFromExit({ status: 1, output: 'AssertionError: expected 3 got 4' });
  assert.equal(v.status, 'needs_revision');
  assert.equal(v.pass, false);
  assert.equal(v.exitCode, 1);
  assert.match(v.critique, /expected 3 got 4/); // the failure output is fed back as the gap
});

test('a FAILED test never maps to satisfied (control: guards an inverted mapping)', () => {
  assert.notEqual(verdictFromExit({ status: 1, output: 'boom' }).status, 'satisfied');
  assert.equal(verdictFromExit({ status: 1, output: 'boom' }).pass, false);
});

test('spawn error / signal / null status → failed (TERMINAL — escalate, do not spin)', () => {
  assert.equal(verdictFromExit({ status: null, error: new Error('ENOENT') }).status, 'failed');
  assert.equal(verdictFromExit({ status: null, signal: 'SIGTERM' }).status, 'failed');
  assert.equal(verdictFromExit({ status: null }).status, 'failed');
  // failed must be distinct from needs_revision so refine STOPS rather than retrying a broken close.
  assert.notEqual(verdictFromExit({ status: null, signal: 'SIGKILL' }).status, 'needs_revision');
});

test('runClose end-to-end: a real passing command → satisfied', () => {
  const v = runClose(['node', '-e', 'process.exit(0)']);
  assert.equal(v.status, 'satisfied');
  assert.equal(v.pass, true);
});

test('runClose end-to-end: a real failing command → needs_revision with its output', () => {
  const v = runClose(['node', '-e', 'console.error("BOOM"); process.exit(1)']);
  assert.equal(v.status, 'needs_revision');
  assert.equal(v.exitCode, 1);
  assert.match(v.output, /BOOM/);
});

test('runClose end-to-end: an unrunnable command → failed (terminal)', () => {
  const v = runClose(['this-binary-does-not-exist-xyz']);
  assert.equal(v.status, 'failed');
  assert.equal(v.pass, false);
});

test('regression: a failing `node --test` child reports RED even under a test-runner parent', () => {
  // This test itself runs under `node --test`, so NODE_TEST_CONTEXT is set. Without stripping it, the child
  // `node --test` would DEFER to this parent and exit 0 — mapping a failing suite to satisfied (fit-to-pass
  // class). runClose strips it, so the close's "exit code = truth" contract holds.
  assert.ok(process.env.NODE_TEST_CONTEXT, 'precondition: we are under a test-runner parent');
  const suite = 'test/fixtures/always-red.test.mjs';
  const v = runClose(['node', '--test', suite]);
  assert.equal(v.status, 'needs_revision', 'a failing child suite must NOT map to satisfied');
  assert.equal(v.pass, false);
});

test('runClose rejects a shell-string command (array form only, no injection surface)', () => {
  assert.throws(() => runClose('node --test'), /non-empty array/);
  assert.throws(() => runClose([]), /non-empty array/);
});
