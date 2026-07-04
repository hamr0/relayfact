// preflight.test.js — the parse/normalize SAFETY property (token-free): garbage NEVER yields `proceed`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePreflight } from '../src/preflight.mjs';

test('parses a clean proceed/clarify/decline', () => {
  assert.equal(parsePreflight('{"verdict":"proceed","reason":"clear","questions":[]}').verdict, 'proceed');
  assert.equal(parsePreflight('{"verdict":"decline","reason":"nonsense"}').verdict, 'decline');
  const c = parsePreflight('{"verdict":"clarify","questions":["which format?"]}');
  assert.equal(c.verdict, 'clarify');
  assert.deepEqual(c.questions, ['which format?']);
});

test('extracts JSON embedded in prose', () => {
  assert.equal(parsePreflight('Here is my call: {"verdict":"proceed","reason":"ok"} done').verdict, 'proceed');
});

test('SAFETY CONTROL — unparseable garbage NEVER proceeds (falls back to clarify)', () => {
  assert.equal(parsePreflight('lol what').verdict, 'clarify');
  assert.equal(parsePreflight('').verdict, 'clarify');
  assert.equal(parsePreflight(null).verdict, 'clarify');
  assert.equal(parsePreflight('{"verdict":"go for it"}').verdict, 'clarify'); // unknown verdict word
  assert.equal(parsePreflight('{ broken json').verdict, 'clarify');
});

test('SAFETY CONTROL — an unknown verdict is never silently upgraded to proceed', () => {
  // The one verdict that spends is proceed; only an explicit, valid "proceed" may produce it.
  for (const bad of ['yes', 'ok', 'PROCEED ', 'maybe', 'run']) {
    assert.notEqual(parsePreflight(`{"verdict":"${bad}"}`).verdict, 'proceed');
  }
});
