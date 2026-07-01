// Spike-1 SATISFIABLE control. Same three slices as multi/, but fc's spec is fc(4) === 8 (double)
// instead of the contradiction — every slice is honestly closable, so the global predicate must go
// GREEN once each is fixed. Proves the test CAN pass (not always-red) and that decomposition + a
// global close converges when every slice is grounded.
import test from 'node:test';
import assert from 'node:assert';
import { fa } from './ma.js';
import { fb } from './mb.js';
import { fc } from './mc.js';

test('fa adds', () => assert.strictEqual(fa(2, 3), 5));
test('fb uppercases', () => assert.strictEqual(fb('hi'), 'HI'));
test('fc doubles', () => assert.strictEqual(fc(4), 8));
