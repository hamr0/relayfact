// parseCSVLine — the starting state the agent must repair.
//
// This is the naive implementation a junior would write: split on commas.
// It is genuinely red against csv.test.js (fails every quoted-field case).
// The agent's job is to make `node --test` pass without changing the tests.
//
// Spec (see csv.test.js for the executable truth):
//   - Fields are separated by commas.
//   - A field may be wrapped in double quotes; the quotes are stripped.
//   - A quoted field may contain commas (they are literal, not separators).
//   - Inside a quoted field, a doubled double-quote ("") is one literal ".
//   - Unquoted fields are taken verbatim (no trimming).
//   - Empty fields are preserved.

export function parseCSVLine(line) {
  return line.split(',');
}
