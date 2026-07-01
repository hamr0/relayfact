# Project conventions (authoritative runbook)

## Entity ID format (current — use for all new code)

An entity ID is built as: `<PREFIX>-<NNNNNN>-<CHK>`

- `PREFIX` — the entity name in UPPERCASE (e.g. the `user` entity → `USER`).
- `NNNNNN` — the numeric id, left zero-padded to **width 6** (e.g. 7 → `000007`, 123456 → `123456`).
- `CHK` — a single check character: the **first letter of PREFIX**, uppercase (e.g. `USER` → `U`).

Example: the user entity with id 7 → `USER-000007-U`.

This rule is the same for every entity; only the prefix (and therefore the check letter) changes.
