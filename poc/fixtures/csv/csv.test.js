// Executable spec for parseCSVLine. node --test; exit code is the predicate truth.
// These cases are the well-known fiddly parts of CSV; a naive split() fails the
// quoted ones. Not authored to contain the answer — authored to be correct CSV.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSVLine } from './csv.js';

test('plain fields', () => {
  assert.deepEqual(parseCSVLine('a,b,c'), ['a', 'b', 'c']);
});

test('empty line is one empty field', () => {
  assert.deepEqual(parseCSVLine(''), ['']);
});

test('interior empty field', () => {
  assert.deepEqual(parseCSVLine('a,,c'), ['a', '', 'c']);
});

test('trailing empty field', () => {
  assert.deepEqual(parseCSVLine('a,b,'), ['a', 'b', '']);
});

test('quoted field containing a comma', () => {
  assert.deepEqual(parseCSVLine('"a,b",c'), ['a,b', 'c']);
});

test('escaped quote inside a quoted field', () => {
  assert.deepEqual(parseCSVLine('"she said ""hi""",x'), ['she said "hi"', 'x']);
});

test('quotes preserve surrounding spaces', () => {
  assert.deepEqual(parseCSVLine('"  spaced  ",y'), ['  spaced  ', 'y']);
});

test('empty quoted field between values', () => {
  assert.deepEqual(parseCSVLine('"line","","end"'), ['line', '', 'end']);
});
