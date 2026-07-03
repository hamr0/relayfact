// probe-19 — VERIFY-SHIPPED: bareguard 0.11.0 BG-3 (content payload-exclude), token-free.
// Doctrine: verify a shipped lib fix by RUNNING the installed code + observing, never by reading source.
// Claim under test: with the probe-16 gate config MINUS the `content:{askPatterns:[]}` override, an
// edit_file write whose PAYLOAD text contains destructive code vocab must now ALLOW (the fix), while the
// SAME verb in an operation field (cmd / HTTP method) must still deny/ask (the guard is not blinded).
// Controls that can FAIL: each case asserts an EXACT expected outcome; a regression flips a PASS to FAIL.
import { Gate } from 'bareguard';
// NOTE (F37): PAYLOAD_FIELDS is documented as "a new export" but is only exported from
// src/primitives/content.js — NOT re-exported by src/index.js, and the package `exports` map
// exposes only "." and "./types". So the documented extension point is UNREACHABLE publicly.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const auditPath = join(tmpdir(), 'probe-19-audit.jsonl');
rmSync(auditPath, { force: true });

// Same shape as probe-16's gate, but WITHOUT content:{askPatterns:[]} — the override we want to drop.
// humanChannel ALLOWS: an askHuman then resolves to outcome=allow but keeps rule=content.askPatterns,
// so we can distinguish "asked (rule=askPatterns), human allowed" from a plain allow (rule=default).
const gate = new Gate({
  fs: { readScope: ['/tmp'], writeScope: ['/tmp'] },
  bash: { allow: [] },
  audit: { path: auditPath },
  humanChannel: async () => ({ decision: 'allow' }),
});
await gate.init();

// edit_file's real translated action shape (probe-16 actionTranslator): payload lives in args.contents.
const write = (contents) => ({ type: 'write', path: '/tmp/examples/read.js', args: { path: 'examples/read.js', contents } });
// a bash op with the verb in the OPERATION field (cmd), not payload.
const bash = (cmd) => ({ type: 'bash', args: { cmd } });
// an HTTP-ish op with a structural DELETE method (ask default).
const httpDelete = () => ({ type: 'http', args: { method: 'DELETE', url: 'https://api/x' } });

// The exact fix text probe-16's worker writes: code about DROPPED / removed filters.
const fixText = `// build jq from opts.match: earlier code DROPPED every --match filter (only --where survived).\n` +
  `const clauses = Object.entries(opts.match||{}).map(([k,v]) => \`select(.\${k}=="\${v}")\`);\n` +
  `// do not remove / purge / delete the where clause; truncate nothing.`;

// Each case asserts the EXACT (outcome, rule) pair. rule proves WHICH path fired:
//   default            = content patterns did NOT match (payload stripped)  → the fix
//   content.denyPatterns = an operation field matched a deny verb            → guard intact
//   content.askPatterns  = an operation field matched an ask verb (human then allowed) → guard intact
const cases = [
  { name: 'payload code-vocab (drop/remove/purge/delete/truncate) → ALLOW/default', act: write(fixText), outcome: 'allow', rule: 'default' },
  { name: 'payload literal "DROP TABLE" bytes → ALLOW/default (inert data)', act: write('const sql = "DROP TABLE users";'), outcome: 'allow', rule: 'default' },
  { name: 'DROP TABLE in a bash cmd (operation) → DENY/content.denyPatterns', act: bash('psql -c "DROP TABLE users"'), outcome: 'deny', rule: 'content.denyPatterns' },
  { name: 'rm -rf in a bash cmd (operation) → DENY/content.denyPatterns', act: bash('rm -rf /var/data'), outcome: 'deny', rule: 'content.denyPatterns' },
  { name: 'structural method:DELETE (operation) → ASK/content.askPatterns (strip does not blind it)', act: httpDelete(), outcome: 'allow', rule: 'content.askPatterns' },
];

import { readFileSync } from 'node:fs';
// For an askHuman case the FINAL rule is humanChannel.allow (the human's override); the proof that the
// ask FIRED is the gate audit line recorded BEFORE the human applied. Read it back per action.
const askRuleFor = (actType) => {
  const lines = readFileSync(auditPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const g = lines.find((o) => o.phase === 'gate' && o.decision === 'askHuman' && o.action?.type === actType);
  return g?.rule;
};

let allPass = true;
for (const c of cases) {
  const res = await gate.check(c.act);
  const got = res?.outcome;
  // when the case expects an ask-rule but the human overrode to allow, verify the ask fired via audit.
  const gotRule = (c.rule.startsWith('content.ask') && res?.rule === 'humanChannel.allow')
    ? askRuleFor(c.act.type) : res?.rule;
  const pass = got === c.outcome && gotRule === c.rule;
  allPass = allPass && pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  want=(${c.outcome},${c.rule})  got=(${got},${gotRule})  ${c.name}`);
}
console.log(allPass ? '\nALL PASS — BG-3 shipped correctly; probe-16 override can be dropped.'
                    : '\nFAIL — do NOT drop the override; BG-3 behavior diverges from spec.');
process.exitCode = allPass ? 0 : 1;
