#!/usr/bin/env node
// probe-18 — G4 self-check: the observer is a real artifact, and it is HONEST about what a run exposed.
//
// The observer (observer.mjs) is a pure listener over persisted artifacts (run-*.jsonl + *-audit.jsonl).
// This probe replays it over TWO existing, DIFFERENT-SHAPED logs and asserts, with controls that can fail:
//
//   probe-12-depth  (a recurse tree run): MUST expose header, grounded close (verify.ran), tree/boundary
//                   (boundary.map), gate (audit), terminal (spike). MUST NOT expose memory (no recall) —
//                   and the observer must DECLARE it absent, not invent recall events.
//   probe-13        (the memory loop run): MUST expose header, memory (recall + widening), gate, terminal
//                   (summary/arms). It does NOT emit verify.ran or boundary.map — so the observer must
//                   DECLARE close+tree absent, not fabricate a per-node verdict tree.
//
// THE CONTROL THAT CAN FAIL (anti-paper-over): if the observer fabricated a facet a run never persisted
// (e.g. a fake tree for probe-13), the "absent-and-declared" assertions below would FAIL. And a reviewer
// must be able to narrate each run from the render alone — asserted by requiring the load-bearing numbers
// to appear in the rendered text (grounded coverage + DOCTRINE for probe-12; widen windows + rates for
// probe-13). Zero tokens — pure replay.
//
// Run:  node poc/probe-18-observer.mjs

import { loadRun, analyze, render } from './observer.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, ''); // compare on plain text, not color codes

let failures = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`  ${ok ? '\x1b[32m✓' : '\x1b[31m✗'} ${name}\x1b[0m${detail ? ` \x1b[2m${detail}\x1b[0m` : ''}`);
  return ok;
}

function run(label, logName, expect) {
  const path = join(__dir, logName);
  console.log(`\n\x1b[1m${label}\x1b[0m \x1b[2m(${logName})\x1b[0m`);
  if (!existsSync(path)) { check(`log exists`, false, path); return; }
  let facets, text;
  try {
    const { events, audits } = loadRun(path);
    facets = analyze(events, audits);
    text = strip(render(facets, { runLogPath: path }));
  } catch (e) {
    check('observer ran without crashing', false, e.message);
    return;
  }
  check('observer ran without crashing', true);
  // present facets
  for (const f of expect.present) check(`exposes ${f}`, facets[f]?.present === true);
  // absent-and-declared facets (the control): facet.present must be false AND render must say so
  for (const f of expect.absent) {
    const declaredAbsent = facets[f]?.present === false && text.includes('not exposed by this run');
    check(`DECLARES ${f} absent (does not fabricate)`, declaredAbsent, facets[f]?.present === false ? '' : 'facet was marked present!');
  }
  // narratable: load-bearing numbers must surface in the render
  for (const needle of expect.mustRender) check(`render contains "${needle}"`, text.includes(needle));
  return text;
}

console.log('\x1b[1m\x1b[36m━━ probe-18: observer honesty self-check ━━\x1b[0m');

const t12 = run('recurse tree run', 'run-probe12-depth.jsonl', {
  present: ['header', 'close', 'tree', 'gate', 'terminal'],
  absent: ['memory'],
  mustRender: ['grounded coverage', '1/1', 'DOCTRINE HELD'],
});

const t13 = run('memory loop run', 'run-probe13.jsonl', {
  present: ['header', 'memory', 'gate', 'terminal'],
  absent: ['close', 'tree'],
  mustRender: ['window=', 'fixed='],
});

console.log('\n\x1b[1m━━ one full render, for the eye ━━\x1b[0m');
const { events, audits } = loadRun(join(__dir, 'run-probe12-depth.jsonl'));
console.log(render(analyze(events, audits), { runLogPath: join(__dir, 'run-probe12-depth.jsonl') }));

console.log(`\n${failures ? '\x1b[31m' : '\x1b[32m'}${failures ? failures + ' check(s) FAILED' : 'ALL CHECKS PASSED'}\x1b[0m`);
process.exitCode = failures ? 1 : 0;
