# Request: money formatter

Implement a function `money(cents)` in `./impl.mjs` that formats an integer number of
cents as a currency string, and write an executable test suite `./suite.test.mjs` that
pins the acceptance criteria.

`cents` is an integer (100 = one dollar). Acceptance criteria:

1. Leading dollar sign: `money(1234)` is `"$12.34"`.
2. Cents are zero-padded to two digits: `money(1)` is `"$0.01"`.
3. A `.` separates dollars and cents: `money(1234)` is `"$12.34"` (not `"$12,34"`).
4. Negative amounts put the minus sign BEFORE the `$`: `money(-5)` is `"-$0.05"`.

No thousands separators. The suite must use `node:test` + `node:assert/strict` and import
`money` from `./impl.mjs`.
