// task.mjs — assembles D7 Task 2 (semver §11 precedence compare) into the runRequest() task shape.
// The oracle impls are SOURCE STRINGS. `reference`/`stub`/`mutant-build` are read from files; the other three
// mutants are derived from the reference by a single guarded substring patch each (throws on a stale anchor,
// so no mutant is ever secretly identical to the reference). The four subtle mutants are the canonical §11
// mistakes: lexical-only (miss numeric), forget no-pre > pre, build-affects-order, and a reversed field-count
// tie-break.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');

const reference = read('reference.mjs');
const stub = read('stub.mjs');
const goldSource = read('gold.test.mjs');
const request = read('prose.txt');

function patch(name, find, replace) {
	if (!reference.includes(find)) {
		throw new Error(`mutant "${name}": anchor not found in reference — patch is stale: ${JSON.stringify(find)}`);
	}
	const code = reference.replace(find, replace);
	if (code === reference) throw new Error(`mutant "${name}": patch was a no-op`);
	return { name, code };
}

const mutants = [
	// m1 — compare pre-release identifiers LEXICALLY only (never numerically): "2" > "11" as strings, so it
	// mis-orders 1.0.0-beta.2 vs 1.0.0-beta.11. Achieved by making isNumeric always false.
	patch('m1-lexical-only', 'const isNumeric = (s) => /^[0-9]+$/.test(s);', 'const isNumeric = (s) => false;'),
	// m2 — forget that a normal version outranks its pre-release: reverse the a-has-no-prerelease case, so
	// 1.0.0 is ranked BELOW 1.0.0-rc.1.
	patch('m2-no-prerelease-order', 'if (pa.pre.length === 0) return 1;', 'if (pa.pre.length === 0) return -1;'),
	// m4 — reversed tie-break on field count: a LARGER set of pre-release fields wrongly ranks LOWER, so
	// 1.0.0-alpha is ranked ABOVE 1.0.0-alpha.1.
	patch('m4-fieldcount-reversed', 'return pa.pre.length < pb.pre.length ? -1 : 1;', 'return pa.pre.length < pb.pre.length ? 1 : -1;'),
	// m3 — build metadata affects order (see mutant-build.mjs): §11 says ignore it, this uses it as a tiebreak.
	{ name: 'm3-build-affects-order', code: read('mutant-build.mjs') },
];

export const task2 = {
	id: 'semver-precedence',
	source: 'semver.org 2.0.0 §11 (external authority spec)',
	tier: 'predicate',
	sonnetArm: true, // the subtle task — also runs on sonnet for the model-modulation datapoint (F20/F33)
	request,
	oracle: { reference, stub, mutants },
	goldSuite: { name: 'gold.test.mjs', source: goldSource, command: ['node', '--test', 'gold.test.mjs'] },
	implName: 'impl.mjs',
	criteriaMap: [{ criterion: 'compareSemver orders versions by SemVer §11 precedence', eval: 'predicate' }],
};
