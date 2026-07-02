# Request: CSV record parser

Implement a function `parse(line)` in `./impl.mjs` that splits one CSV record string into
an array of field strings, and write an executable test suite `./suite.test.mjs` that pins
the acceptance criteria.

Acceptance criteria:

1. Basic split on commas: `parse("a,b,c")` deep-equals `["a","b","c"]`.
2. Empty fields are preserved: `parse("a,,c")` deep-equals `["a","","c"]`.
3. Commas inside double-quoted fields are NOT separators: `parse('"a,b",c')` deep-equals `["a,b","c"]`.
4. A doubled quote inside a quoted field is one literal quote: `parse('"a""b"')` deep-equals `['a"b']`.

The suite must use `node:test` + `node:assert/strict` and import `parse` from `./impl.mjs`.
