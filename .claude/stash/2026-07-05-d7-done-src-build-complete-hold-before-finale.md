# Stash — 2026-07-05 — D7 DONE; src/ build COMPLETE; holding before the graduation finale

## One-line state
The `src/` graduated build is **functionally complete**: **D7 (the ≥3-real-task benches cohort) PASSED** —
4/4 arms delivered green through the assembled pipe, fit-to-pass=0 (F42). Whole product verified GREEN live
(13/13 live tests). **Deliberately HOLDING** on the only remaining work: retire `poc/` + cut `0.1.0`.

## What happened this session (commits, newest first)
- `30065c3` **src/ D7 DONE (F42)** — cohort ran green; author.mjs tier-aware; Task 1 reconciled to
  reimplement-from-spec; 3 findings surfaced+fixed honestly.
- `3242e23` src/ D7 — closed both live-run pipeline wiring gaps (per-task split via countGrounded; tier-
  agnostic close command + agentic D5 tripwire).
- `4bae134` src/ D7 Tasks 2 (semver §11) + 3 (/echo agentic) oracles built; pre-check across both tiers.
- `6e63985` src/ D7 signed off + Task 1 (real-repo bug) oracle built + token-free pre-check.
- (prior session tail: `10d0b44` D7 draft, `e2000a6` D1, `9cbbcb2` D3, `e3e7077` pipe assembled.)

## D7 RESULT (the deliverable) — F42
Canonical live run `test/integration/d7-cohort.live.test.js`, re-verified 3× (incl. the full ship-check):

| task | model | outcome | close | iters | GOLD | split |
|------|-------|---------|-------|-------|------|-------|
| filenamify reserved-name-with-ext (real-repo bug, sindresorhus/filenamify#46, post-cutoff) | haiku | delivered | trusted 4/4 | 1 | 🟢 | 1/1 |
| semver §11 (semver.org) | haiku | delivered | trusted 4/4 | 1 | 🟢 | 1/1 |
| semver §11 | sonnet | delivered | trusted 4/4 | 1 | 🟢 | 1/1 |
| /echo (AGENTIC: deploy+probe) + 1 rubric residue | haiku | delivered | trusted 4/4 | 1 | 🟢 | **5/6** |

PASS bar cleared: every arm truthful-terminal (deliver-green AND GOLD-green), **fit-to-pass=0**, split reported
per task, zero GOLD-red deliveries. ~$0.60/run but COST VARIES ~10× run-to-run (semver·haiku was $0.36 once,
$0.036 another) — haiku sometimes costs MORE than sonnet. Iters=1 everywhere; variance is in $, not iterations.

## Three findings surfaced en route (F42 — none papered over)
1. **The assembled pipe REIMPLEMENTS-FROM-SPEC, it does NOT patch a repo.** runRequest hands the worker no
   buggy tree / no read tool (multi-file resolveIn deferred in worker.mjs). So a "real-repo bug" = a from-scratch
   reimplement locked by the maintainer's real regression test as GOLD (realness = the GOLD, not a patched tree).
   ⇒ the validity-gate `reference` must implement the TASK spec, not the FULL library (the full filenamify lib
   over-constrained a suite authored from the narrow prose → narrowed the reference).
2. **Export SHAPE must be pinned in the VISIBLE prose** (F25-class): haiku authored `import { filenamify }`
   (named) vs a `export default` reference → over-constrained. Stating `export default` + the import line in the
   prose fixed it. (semver=default, echo=named both delivered first-try because their prose pinned the shape.)
3. **F33 in the wild — over-constrain → decision-ready escalate → complete-the-spec → deliver.** haiku flagged
   `com0` not reserved (exposed a REAL bug in my reference regex: `com\d` matched com0; spec is com1–com9) AND
   wrongly treated bare `com` as reserved. Reference gate caught both SAFE (close-untrustworthy, 0 delivery).
   Fixing the real regex bug + completing the spec boundary → next run green. Honesty machinery caught a genuine
   oracle bug AND a model misconception; neither shipped.

## Pipeline/author changes shipped this session (token-free, backward-compatible)
- `src/pipeline.mjs`: `runRequest` gained `tier` (default 'predicate') + `criteriaMap` (default null). Close is
  tier-agnostic: predicate `['node','--test',suite]` vs agentic `['node',suite]` (exercise harness); threaded to
  compile-close + worker; GOLD honors `goldSuite.command`. Split routes through `countGrounded()` (echo→5/6).
- `src/compile-close.mjs`: accepts `closeCommand` (default predicate) so the validity gate measures the REAL close.
- `src/author.mjs`: exports `AUTHOR_PERSONA` (predicate) + `AUTHOR_PERSONA_AGENTIC` (exercise harness);
  `authorSuiteViaRecurse` takes optional `persona` + `artifactNoun`. The agentic author self-wrote a valid harness.
- Tests: `test/pipeline.test.js` +2 (agentic deliver 5/6; agentic D5 tripwire = wrong server → exercise GOLD RED
  → gold-mismatch). `test/d7-cohort.test.js` (token-free oracle pre-check, all 3 tasks + split, fail-capable).

## Test state
Token-free: **82 tests / 69 pass / 13 live-skip / 0 fail** (`npm test`). Full live ship-check: **13/13 pass /
0 fail** (re-proved backward-compat — pipeline.live/compile-close.live/worker.live/agentic-close.live all green
after this session's changes). Live needs `RELAYFACT_LIVE=1` + `ANTHROPIC_API_KEY=$(pass amr/claude_api)`.

## NEXT (the graduation finale — user is HOLDING, do NOT do without explicit go)
1. **Retire `poc/`** — `git rm` the 269-file / 4MB `poc/` tree (throwaway per doctrine; recoverable from git).
   Nothing in src/ or tests IMPORTS from poc/ — only provenance COMMENTS ("Graduated from poc/probe-15", etc.)
   which stay valid as history (detail in F33/F36/F38). No code breaks.
2. **Cut `0.1.0`** — bump `package.json` 0.0.0→0.1.0; roll CHANGELOG `[Unreleased]`→`[0.1.0]` with the date.
   Tag/push ONLY if the user asks.
Plan (`docs/plans/d7-cohort-plan.md`) + graduated PRD both mark D7 ✅ and name these two as all that remains.

## Key files
- Cohort: `test/integration/d7-cohort.live.test.js` (live, 4 arms), `test/d7-cohort.test.js` (token-free oracle
  pre-check), `test/fixtures/d7/{filenamify,semver,echo}/` (prose/reference/stub/mutants-in-task.mjs/gold).
- Pipe: `src/pipeline.mjs`, `src/compile-close.mjs`, `src/author.mjs`, `src/worker.mjs`, `src/close.mjs`,
  `src/validity-gate.mjs` (countGrounded).
- Docs: `docs/00-context/FINDINGS.md` (F42), `CHANGELOG.md`, `docs/01-product/relayfact-prd-v3-graduated.md`,
  `docs/plans/d7-cohort-plan.md`.

## Doctrine reminders that bit / held this session
- **Verify by RUNNING**, never assert: caught the export-shape trap + the com0 reference bug + backward-compat,
  all by running, not reading. Every "green" here is a shown command output.
- **Surface, don't paper over**: the reimplement-from-spec discovery + com0 bug were logged to F42, not hidden;
  the prose reframes are the DESIGNED HITL cycle (escalation's own signal), not tuning-to-pass — but state that
  honestly.
- **Memory is where probes got caught fit-to-pass** — the token-free pre-check proves each oracle fail-capable
  BEFORE spending; every mutant is a guarded single-substring patch (throws on stale anchor).
- `poc/` is throwaway; graduating it is a rewrite (done). Name n=1 thinness: each arm is n=1 (semver ×2 models);
  D7 proves truthful-terminal on real tasks + fit-to-pass=0, NOT a benches-grade RATE (needs larger n).
