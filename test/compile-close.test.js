// compile-close.test.js — the prose→close ORCHESTRATION, verified token-free with a fake author over REAL
// on-disk suites (real `node --test` runs). The LLM author is a separate verify-by-running step; this proves
// the honesty gate wired to the real close runner catches a dishonest suite whoever wrote it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileClose } from '../src/compile-close.mjs';

// Domain under test: double(n). The oracle is REAL executable JS, not synthetic booleans.
const ORACLE = {
  reference: 'export const double = (n) => n * 2;\n',
  stub: 'export const double = (n) => {};\n',                       // returns undefined
  mutants: [
    { name: 'noop', code: 'export const double = (n) => n;\n' },       // 2→2
    { name: 'offbyone', code: 'export const double = (n) => n * 2 + 1;\n' }, // 2→5
    { name: 'zero', code: 'export const double = (n) => (n === 0 ? 1 : n * 2);\n' }, // 0→1
    { name: 'sign', code: 'export const double = (n) => Math.abs(n) * 2;\n' }, // -4→8
    { name: 'triple', code: 'export const double = (n) => n * 3;\n' }, // 2→6
  ],
};

// Suites an author might produce. Each is a REAL node:test file importing ./impl.mjs.
const HONEST_SUITE = `import { double } from './impl.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('positives', () => { assert.equal(double(2), 4); assert.equal(double(3), 6); });
test('zero', () => { assert.equal(double(0), 0); });
test('negatives', () => { assert.equal(double(-4), -8); });
`;
const STUB_GREEN_SUITE = `import { double } from './impl.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('exists', () => { assert.equal(typeof double, 'function'); });
`;
const OVER_CONSTRAINED_SUITE = `import { double } from './impl.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('positives', () => { assert.equal(double(2), 4); });
test('zero must be one', () => { assert.equal(double(0), 1); }); // asserts behavior the prose never specified
`;
// author factory: writes a fixed suite string (stands in for the LLM worker).
const fakeAuthor = (suiteSrc) => async ({ suitePath }) => writeFileSync(suitePath, suiteSrc);

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'relayfact-compile-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const PROSE = 'Write double(n) that returns n times two.';

test('an HONEST authored suite is TRUSTED (stub caught, reference passes, all mutants killed)', async () => {
  const { dir, cleanup } = scratch();
  try {
    const r = await compileClose({ workdir: dir, prose: PROSE, oracle: ORACLE, authorSuite: fakeAuthor(HONEST_SUITE) });
    assert.equal(r.verdict, 'trusted');
    assert.equal(r.ok, true);
    assert.equal(r.validity.mutantsKilled, 5);
  } finally { cleanup(); }
});

test('CONTROL — a stub-green suite is caught as VACUOUS, not trusted', async () => {
  const { dir, cleanup } = scratch();
  try {
    const r = await compileClose({ workdir: dir, prose: PROSE, oracle: ORACLE, authorSuite: fakeAuthor(STUB_GREEN_SUITE) });
    assert.equal(r.verdict, 'vacuous');
    assert.equal(r.ok, false);
  } finally { cleanup(); }
});

test('CONTROL — an over-constrained suite is caught (rejects a correct impl) — the SAFE G1 mode', async () => {
  const { dir, cleanup } = scratch();
  try {
    const r = await compileClose({ workdir: dir, prose: PROSE, oracle: ORACLE, authorSuite: fakeAuthor(OVER_CONSTRAINED_SUITE) });
    assert.equal(r.verdict, 'over-constrained');
    assert.equal(r.ok, false);
  } finally { cleanup(); }
});

test('CONTROL — an author that writes no suite → no-suite (never silently trusted)', async () => {
  const { dir, cleanup } = scratch();
  try {
    const r = await compileClose({ workdir: dir, prose: PROSE, oracle: ORACLE, authorSuite: async () => {} });
    assert.equal(r.verdict, 'no-suite');
    assert.equal(r.ok, false);
  } finally { cleanup(); }
});
