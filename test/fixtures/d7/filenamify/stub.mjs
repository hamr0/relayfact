// stub.mjs — the no-op the validity gate must reject as VACUOUS (it grounds nothing). Returns the input
// unchanged, so any suite that is green against it proves only that the suite asserts nothing real.
export default function filenamify(string) {
	return string;
}
