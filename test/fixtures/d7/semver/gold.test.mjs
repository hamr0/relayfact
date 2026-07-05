// gold.test.mjs — the INDEPENDENT GOLD for D7 Task 2 (the D5 standing arbiter), written to the workdir only
// AFTER the worker finishes. The §11 canonical precedence chain is the spec's own example; the FRESH cases
// (core precedence, the equal-build pair, the numeric-vs-lexical pair) are concrete discriminators the prose
// states only as RULES — passing means implementing the rules, not echoing listed pairs.
import test from 'node:test';
import assert from 'node:assert/strict';
import compareSemver from './impl.mjs';

test('SemVer §11 canonical precedence chain (each strictly lower than the next)', () => {
	const chain = [
		'1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta',
		'1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0',
	];
	for (let i = 0; i < chain.length - 1; i++) {
		assert.equal(compareSemver(chain[i], chain[i + 1]), -1, `${chain[i]} < ${chain[i + 1]}`);
		assert.equal(compareSemver(chain[i + 1], chain[i]), 1, `${chain[i + 1]} > ${chain[i]}`);
	}
});

test('core precedence, equality, no-prerelease ordering, build-ignored (fresh)', () => {
	assert.equal(compareSemver('2.1.0', '2.0.9'), 1);      // minor beats patch numerically
	assert.equal(compareSemver('1.2.3', '1.2.3'), 0);      // identical
	assert.equal(compareSemver('1.0.0', '1.0.0-rc.1'), 1); // a normal version outranks its pre-release
	assert.equal(compareSemver('1.0.0+build.1', '1.0.0+build.2'), 0); // build metadata is IGNORED
	assert.equal(compareSemver('1.0.0-beta.2', '1.0.0-beta.11'), -1); // numeric identifiers compare numerically
});
