// mutant-build.mjs — m3: the "build metadata affects order" mutant. §11-correct in EVERY respect except it
// uses build metadata as a final tiebreak instead of ignoring it. Subtle: it fails ONLY on two versions that
// are equal in every precedence-relevant field but differ in build metadata (e.g. 1.0.0+build.1 vs
// 1.0.0+build.2, which §11 requires to be EQUAL). Written explicitly (not a substring patch) because it adds
// logic; verified by running that the §11 chain still holds and only the build pair is mis-ordered.

function parse(v) {
	const plus = v.indexOf('+');
	const build = plus === -1 ? '' : v.slice(plus + 1);
	const noBuild = plus === -1 ? v : v.slice(0, plus);
	const dash = noBuild.indexOf('-');
	const core = dash === -1 ? noBuild : noBuild.slice(0, dash);
	const pre = dash === -1 ? [] : noBuild.slice(dash + 1).split('.');
	const [major, minor, patch] = core.split('.').map(Number);
	return { major, minor, patch, pre, build };
}

const isNumeric = (s) => /^[0-9]+$/.test(s);

function compareId(x, y) {
	const xn = isNumeric(x);
	const yn = isNumeric(y);
	if (xn && yn) {
		const a = Number(x);
		const b = Number(y);
		return a === b ? 0 : (a < b ? -1 : 1);
	}
	if (xn) return -1;
	if (yn) return 1;
	return x === y ? 0 : (x < y ? -1 : 1);
}

function comparePre(pa, pb) {
	if (pa.length === 0 && pb.length === 0) return 0;
	if (pa.length === 0) return 1;
	if (pb.length === 0) return -1;
	const n = Math.min(pa.length, pb.length);
	for (let i = 0; i < n; i++) {
		const c = compareId(pa[i], pb[i]);
		if (c !== 0) return c;
	}
	if (pa.length === pb.length) return 0;
	return pa.length < pb.length ? -1 : 1;
}

export default function compareSemver(a, b) {
	const pa = parse(a);
	const pb = parse(b);
	for (const k of ['major', 'minor', 'patch']) {
		if (pa[k] !== pb[k]) return pa[k] < pb[k] ? -1 : 1;
	}
	const preCmp = comparePre(pa.pre, pb.pre);
	if (preCmp !== 0) return preCmp;
	// BUG (m3): §11 requires build metadata to be IGNORED; this compares it as a tiebreak.
	return pa.build === pb.build ? 0 : (pa.build < pb.build ? -1 : 1);
}
