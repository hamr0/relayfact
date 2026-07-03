# truncate(str, max)

Implement `truncate(str, max)` — shorten a string so it fits a display width.

Rules:

1. If `str` has `max` characters or fewer, return `str` unchanged.
2. Otherwise shorten it to fit **exactly `max` characters in total**: take the first `max - 1`
   characters of `str` and append a single ellipsis character `'…'` (Unicode U+2026 — ONE character,
   not three ASCII dots). Because that ellipsis occupies one of the `max` slots, a truncated result is
   always exactly `max` characters long.

`max` is always an integer ≥ 1. `str` contains only Basic-Multilingual-Plane characters, so
`str.length` equals its visible character count (no surrogate-pair handling needed).

Examples:

- `truncate('report', 10)` → `'report'`   — already short enough, returned unchanged
- `truncate('deployment', 6)` → `'deplo…'`  — first 5 characters plus the ellipsis = 6 characters total
