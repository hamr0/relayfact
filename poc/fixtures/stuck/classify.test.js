// Unsatisfiable by construction. `classify(0)` is called ONCE; its single return value is
// then asserted to equal two different strings. No implementation — pure, stateful, or
// otherwise — can make one value equal both 'even' and 'odd'. The only way to make this
// pass is to edit the test, which the gate forbids (writeScope is the source file only).
//
// This is the point: a task whose acceptance criteria contradict each other CANNOT be
// self-certified green. A grounded loop must run out its iterations and ESCALATE. If the
// loop ever reports success here, the harness is lying — that is what this fixture guards.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './classify.js';

test('contradiction — one value cannot be both', () => {
  const r = classify(0);
  assert.equal(r, 'even');
  assert.equal(r, 'odd');
});
