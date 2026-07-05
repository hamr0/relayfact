// reference.mjs — the RELAYFACT-HELD correct impl for D7 Task 2 (never shown to the worker). The SPEC is the
// external authority (semver.org §11); this is relayfact's §11-correct arbiter. Build metadata is parsed but
// deliberately IGNORED in comparison (§11: "Build metadata MUST be ignored when determining version precedence").

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

// Compare two pre-release identifiers per §11: numeric < alphanumeric; two numerics compare numerically; two
// alphanumerics compare lexically in ASCII sort order.
function compareId(x, y) {
	const xn = isNumeric(x);
	const yn = isNumeric(y);
	if (xn && yn) {
		const a = Number(x);
		const b = Number(y);
		return a === b ? 0 : (a < b ? -1 : 1);
	}
	if (xn) return -1; // a numeric identifier has lower precedence than a non-numeric one
	if (yn) return 1;
	return x === y ? 0 : (x < y ? -1 : 1);
}

export default function compareSemver(a, b) {
	const pa = parse(a);
	const pb = parse(b);

	for (const k of ['major', 'minor', 'patch']) {
		if (pa[k] !== pb[k]) return pa[k] < pb[k] ? -1 : 1;
	}

	// A version WITHOUT a pre-release has HIGHER precedence than the same version WITH one.
	if (pa.pre.length === 0 && pb.pre.length === 0) return 0;
	if (pa.pre.length === 0) return 1;
	if (pb.pre.length === 0) return -1;

	// Compare pre-release identifiers left to right.
	const n = Math.min(pa.pre.length, pb.pre.length);
	for (let i = 0; i < n; i++) {
		const c = compareId(pa.pre[i], pb.pre[i]);
		if (c !== 0) return c;
	}

	// All shared identifiers equal → the version with MORE fields has higher precedence.
	if (pa.pre.length === pb.pre.length) return 0;
	return pa.pre.length < pb.pre.length ? -1 : 1;
}
