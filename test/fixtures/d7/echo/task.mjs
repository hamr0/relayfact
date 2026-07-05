// task.mjs — assembles D7 Task 3 (the /echo service, AGENTIC tier) into the runRequest() task shape. The
// close is an EXERCISE harness (boot the server, probe over HTTP) rather than `node --test`, so the impl name
// is `server.mjs` and goldSuite.command runs the harness directly. The four subtle mutants are clean guarded
// substring patches on the reference. There is deliberately NO mutant for the rubric-residue criterion ("the
// 400 message is developer-friendly") — it is judgment-only, un-grounded, and cannot be an executable kill.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, name), 'utf8');

const reference = read('reference.mjs');
const stub = read('stub.mjs');
const goldSource = read('gold.exercise.mjs');
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
	// m1 — /healthz returns 200 but the WRONG shape ({ok:true} instead of {status:'ok'}).
	patch('m1-healthz-shape', "send(200, { status: 'ok' });", 'send(200, { ok: true });'),
	// m2 — /echo echoes the body but count is always 0 (miscomputed).
	patch('m2-count-zero', 'const count = (body && typeof body === \'object\') ? Object.keys(body).length : 0;', 'const count = 0;'),
	// m3 — malformed JSON returns 200 instead of 400 (the grounded STATUS criterion).
	patch('m3-malformed-not-400', "send(400, { error: 'invalid_json',", "send(200, { error: 'invalid_json',"),
	// m4 — unknown route returns 200 instead of 404.
	patch('m4-unknown-not-404', "send(404, { error: 'not_found',", "send(200, { error: 'not_found',"),
];

// The criteria→eval map for the grounded/rubric split (REPORTED, not gated — routes through
// validity-gate.mjs::countGrounded()). Five grounded (agentic) + one rubric residue = 5/6.
const criteriaMap = [
	{ criterion: 'GET /healthz → 200', eval: 'agentic' },
	{ criterion: 'GET /healthz body is {status:"ok"}', eval: 'agentic' },
	{ criterion: 'POST /echo round-trips the body and count = top-level key count', eval: 'agentic' },
	{ criterion: 'unknown route/method → 404', eval: 'agentic' },
	{ criterion: 'malformed JSON on /echo → 400', eval: 'agentic' },
	{ criterion: 'the 400 error message is developer-friendly', eval: 'rubric' },
];

export const task3 = {
	id: 'echo-service',
	source: 'authored spec (agentic tier: deploy + probe); one rubric-residue criterion',
	tier: 'agentic',
	request,
	oracle: { reference, stub, mutants },
	goldSuite: { name: 'gold.exercise.mjs', source: goldSource, command: ['node', 'gold.exercise.mjs'] },
	implName: 'server.mjs',
	criteriaMap,
};
