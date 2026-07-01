import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sUpper } from './sUpper.js';
import { sReverse } from './sReverse.js';
import { sTrim } from './sTrim.js';
import { nDouble } from './nDouble.js';
import { nSquare } from './nSquare.js';
import { nInc } from './nInc.js';

test('depth: all toolkit functions correct', () => {
  assert.equal(sUpper('hi'), 'HI');
  assert.equal(sReverse('abc'), 'cba');
  assert.equal(sTrim('  x  '), 'x');
  assert.equal(nDouble(4), 8);
  assert.equal(nSquare(3), 9);
  assert.equal(nInc(1), 2);
  assert.equal(nInc(1), 3); // CONTRADICTION: unsatisfiable by construction — no impl satisfies both
});
