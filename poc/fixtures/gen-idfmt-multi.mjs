#!/usr/bin/env node
// Generator for probe-11 fixtures. Emits stub + test for several entities, all governed by the SAME
// project ID rule:  <PREFIX>-<n padStart(6,'0')>-<CHK = first letter of PREFIX>.
// The tests encode the CONVENTION (that is what a spec test does); the answers are NOT placed in any
// recalled memory. One entity (auditBadge) is a STRUCTURALLY-DISTANT transfer: the rule is wrapped in
// a different output shape, so copying a bare-ID lesson verbatim fails — the rule must be re-applied.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'idfmt-multi');
mkdirSync(dir, { recursive: true });

const id = (prefix, n) => `${prefix}-${String(n).padStart(6, '0')}-${prefix[0]}`;

// each: [fn, prefix, wrap(idStr)->expected, sampleNs]
const ENTITIES = [
  ['orderId', 'ORDER', (s) => s, [42, 5, 999999]],
  ['accountId', 'ACCOUNT', (s) => s, [42, 0, 7]],
  ['invoiceId', 'INVOICE', (s) => s, [1, 42, 123456]],
  ['ticketId', 'TICKET', (s) => s, [9, 42, 1000]],
  ['auditBadge', 'AUDIT', (s) => `<<${s}>>`, [42, 5, 999999]], // structurally distant: wrapped output
];

for (const [fn, prefix, wrap, ns] of ENTITIES) {
  writeFileSync(join(dir, `${fn}.stub.js`),
    `// Run target. Apply the project entity-ID convention to a NEW entity. The literal answers are NOT\n` +
    `// in any recalled note; the rule must be applied (prefix ${prefix}, its check letter, width-6 pad).\n` +
    `export function ${fn}(n) {\n  return 'TODO';\n}\n`);

  const cases = ns.map((n) => `  assert.equal(${fn}(${n}), ${JSON.stringify(wrap(id(prefix, n)))});`).join('\n');
  writeFileSync(join(dir, `${fn}.test.js`),
    `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { ${fn} } from './${fn}.js';\n\n` +
    `// Same convention as every entity; only the prefix (=> check letter) and${wrap('X') === 'X' ? '' : ' the output wrapping'} change.\n` +
    `test('${fn} formats per the project ID convention', () => {\n${cases}\n});\n`);
  console.log(`wrote ${fn}: ${ns.map((n) => wrap(id(prefix, n))).join('  ')}`);
}
console.log(`\nfixtures -> ${dir}`);
