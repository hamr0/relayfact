// Spike-1 fixture — the UNSATISFIABLE variant. Three independent slices under ONE suite.
// fa and fb are honestly fixable; fc is unsatisfiable by construction (asserted both true and
// false for the same input), so a child assigned the fc slice CANNOT honestly close it.
// The whole suite is the GLOBAL predicate relayfact hands recurse as opts.evaluate. The test:
// even though recurse does NOT grade intermediate child nodes with relayfact's evaluate (children
// strip it, F13), this global predicate must still go RED — the ungrounded slice cannot be faked
// green at the top. If it ever passes, the grounding doctrine is refuted.
import test from 'node:test';
import assert from 'node:assert';
import { fa } from './ma.js';
import { fb } from './mb.js';
import { fc } from './mc.js';

test('fa adds', () => assert.strictEqual(fa(2, 3), 5));
test('fb uppercases', () => assert.strictEqual(fb('hi'), 'HI'));
test('fc(4) is true', () => assert.strictEqual(fc(4), true));
test('fc(4) is false', () => assert.strictEqual(fc(4), false)); // contradiction — never both
