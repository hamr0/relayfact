// task.mjs — assembles D7 Task 1 (the real-repo bug arm) into the shape runRequest() consumes:
//   { id, tier, request, oracle:{reference, stub, mutants:[{name,code}]}, goldSuite:{name,source}, implName }
//
// The oracle impls are SOURCE STRINGS (compile-close writes each to `implName` in turn and runs the authored
// suite against it). `reference` and `stub` are read from their files; the four subtle mutants are derived
// from the reference by a single, documented substring patch each — so every mutant is exactly "the correct
// impl with ONE thing wrong", and the diff is auditable. Each patch is guarded: if it fails to change the
// source (a stale anchor), we throw rather than ship a mutant that is secretly identical to the reference.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');

const reference = read('reference.mjs');
const stub = read('stub.mjs');
const goldSource = read('gold.test.mjs');
const request = read('prose.txt');

/** Apply one substring patch; throw if the anchor is missing (never emit a no-op "mutant"). */
function patch(name, find, replace) {
	if (!reference.includes(find)) {
		throw new Error(`mutant "${name}": anchor not found in reference — patch is stale: ${JSON.stringify(find)}`);
	}
	const code = reference.replace(find, replace);
	if (code === reference) throw new Error(`mutant "${name}": patch was a no-op`);
	return { name, code };
}

const mutants = [
	// m1 — the ORIGINAL bug (pre-#46): test the WHOLE filename for reservedness, so "CON.txt" (base+ext) never
	// matches `^(con|…)$` and is left untouched. Kills on: CON.txt.
	patch('m1-whole-string-check',
		"const base = extensionIndex === -1 ? filename : filename.slice(0, extensionIndex);",
		"const base = filename;"),
	// m2 — right reservedness check, WRONG suffix position: append at the very end instead of before the
	// extension, so "CON.txt" -> "CON.txt!". Kills on: CON.txt (wrong output).
	patch('m2-suffix-at-end',
		"base + replacement + filename.slice(extensionIndex)",
		"filename + replacement"),
	// m3 — base via lastIndexOf('.') instead of indexOf('.'): for "NUL.tar.gz" the base becomes "NUL.tar"
	// (not reserved) so it is left untouched. Kills on: NUL.tar.gz (the maintainer's discriminator case).
	patch('m3-lastindexof-base',
		"const extensionIndex = filename.indexOf('.');",
		"const extensionIndex = filename.lastIndexOf('.');"),
	// m4 — case-SENSITIVE reserved regex (drops the /i): "CON.txt" (uppercase base) no longer matches.
	// Kills on: CON.txt.
	patch('m4-case-sensitive',
		"/^(con|prn|aux|nul|com\\d|lpt\\d)$/i",
		"/^(con|prn|aux|nul|com\\d|lpt\\d)$/"),
];

export const task1 = {
	id: 'filenamify-reserved-ext',
	source: 'sindresorhus/filenamify#46 (merged 2026-06-16, post-cutoff)',
	tier: 'predicate',
	request,
	oracle: { reference, stub, mutants },
	goldSuite: { name: 'gold.test.mjs', source: goldSource, command: ['node', '--test', 'gold.test.mjs'] },
	implName: 'impl.mjs',
	criteriaMap: [{ criterion: 'filenamify escapes reserved names with extensions per the maintainer regression test', eval: 'predicate' }],
};
