#!/usr/bin/env node
// Fixtures for probe-12 (Spike 3, boundary-mapping at depth). A toolkit of 4 functions across 2
// conceptual modules (strings: sUpper/sReverse; numbers: nDouble/nInc) under ONE global test suite —
// hierarchical on purpose, to invite a 2-level decomposition (module groups → function leaves).
//   depth     — one leaf (nInc) is UNSATISFIABLE by construction (the suite asserts a contradiction).
//               EXPECT the global top predicate to catch it RED even though the fault is deep in the tree.
//   depth-ok  — same shape, all satisfiable. Control: must converge GREEN.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = dirname(fileURLToPath(import.meta.url));
const FUNCS = [
  ['sUpper', 's => s.toUpperCase()', `assert.equal(sUpper('hi'), 'HI');`],
  ['sReverse', `s => [...s].reverse().join('')`, `assert.equal(sReverse('abc'), 'cba');`],
  ['sTrim', 's => s.trim()', `assert.equal(sTrim('  x  '), 'x');`],
  ['nDouble', 'n => n * 2', `assert.equal(nDouble(4), 8);`],
  ['nSquare', 'n => n * n', `assert.equal(nSquare(3), 9);`],
  ['nInc', 'n => n + 1', null], // assertion filled per-variant below
];

for (const [variant, name, incAssert] of [
  ['depth', 'depth', `assert.equal(nInc(1), 2);\n  assert.equal(nInc(1), 3); // CONTRADICTION: unsatisfiable by construction — no impl satisfies both`],
  ['depth-ok', 'depth-ok', `assert.equal(nInc(1), 2);\n  assert.equal(nInc(5), 6);`],
]) {
  const dir = join(base, variant);
  mkdirSync(dir, { recursive: true });
  // stubs (all start red)
  for (const [fn] of FUNCS) writeFileSync(join(dir, `${fn}.stub.js`), `export function ${fn}(x) {\n  return undefined; // TODO\n}\n`);
  // one global suite importing every leaf
  const imports = FUNCS.map(([fn]) => `import { ${fn} } from './${fn}.js';`).join('\n');
  const asserts = FUNCS.map(([fn, , a]) => fn === 'nInc' ? `  ${incAssert}` : `  ${a}`).join('\n');
  writeFileSync(join(dir, `${name}.test.js`),
    `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${imports}\n\n` +
    `test('${name}: all toolkit functions correct', () => {\n${asserts}\n});\n`);
  console.log(`wrote ${variant}/ (${FUNCS.length} leaves, suite ${name}.test.js)`);
}
console.log('done');
