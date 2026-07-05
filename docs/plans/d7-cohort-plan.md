# D7 — the ≥3-real-task benches cohort (plan, for sign-off)

**Status:** ✅ DONE (2026-07-05) — cohort ran green through the assembled pipe: **4/4 arms delivered,
GOLD-green, fit-to-pass=0** (F42). This was the last `src/` build item (PRD-v3 §6 step 5, descope D7);
remaining → retire `poc/`, cut `0.1.0`.

**Result (canonical live run, `test/integration/d7-cohort.live.test.js`):** filenamify·haiku (real-repo bug)
1/1 · semver·haiku 1/1 · semver·sonnet 1/1 · echo·haiku (agentic) 5/6 — all delivered, all independent GOLDs
green, every close `trusted` (4/4 mutants), each in 1 iteration, ≈$0.60 total. Three findings surfaced en
route (F42): (1) the pipe REIMPLEMENTS-FROM-SPEC (no patch-a-tree) → the real-repo-bug reference was narrowed
to the task spec + prose reframed from-scratch; (2) the export SHAPE must be pinned in the visible prose
(haiku authored a named import vs a default-export reference → over-constrained); (3) F33 in the wild —
over-constrain → decision-ready escalate → fix a REAL reference bug (`com\d` matched `com0`) + complete the
spec boundary → deliver. Honesty machinery caught a genuine oracle bug AND a model misconception; neither
shipped. Side datapoint: cost varied 8× at iters=1; haiku cost MORE than sonnet on semver.

**Sign-off decisions:**
1. **Swap Task 1 (Range parser) for a G2-style real-repo bug** — one of the three is now an uncrafted,
   post-cutoff repo bug locked by a human regression test (the strongest realness claim); Tasks 2 & 3 stay
   (Task 2 carries the sonnet arm, Task 3 the agentic+rubric residue).
2. **Sonnet on Task 2 only** — haiku on all three (control tier); sonnet adds the model-modulation datapoint
   on the subtlest task (semver §11).
3. **One rubric-residue criterion** — Task 3's "400 error message is developer-friendly" (~5 grounded / 6
   total); keeps the split non-trivial without rubric creep into gating.

## What D7 is (and the bar it must clear)

Run the **whole assembled pipe** (`src/pipeline.mjs::runRequest`) on **≥3 real, uncrafted tasks**, honoring
the benches method (**controls that can fail, real uncrafted data, replay-through-shipped-code**) and the
G5-EXIT criterion: pre-flight → grounded close (independent GOLD arbiter) → gated `recurse()` →
deliver-green-or-decision-ready-escalation, narrated to the event log, **with the grounded/rubric split
counted per task** (N grounded of M criteria — reported, not gated).

**Honesty rules carried in (from memory + prior findings):**
- **Uncrafted spec** = transcribed from an EXTERNAL authority (RFC / semver.org), not authored to fit my
  reference solution. The worker sees only the prose; it has no read tool and is gate-write-scoped to the impl.
- **Independent GOLD uses FRESH cases** the prose never lists — passing means getting the *convention* right,
  not memorizing examples. GOLD is written only after the worker finishes (never visible to it).
- **The denominator counts EVERY task**, including escalated/broken ones; every fail-mode is NAMED (excluding
  escalations produces a false PASS — the inverse paper-over, memory).
- **No fit-to-pass:** own-suite green + independent GOLD red ⇒ NEVER delivered (D5 standing arbiter). The
  reference gate guards over-constraint; only GOLD guards the mode it can't see.
- Each task supplies the pipe: `{ request, oracle{reference,stub,mutants}, goldSuite, tier }`. The `oracle` is
  relayfact-held truth for the VALIDITY gate (is the self-authored suite trustworthy?) — it is NOT shown to
  the worker; it is the benches harness's ground truth, exactly as G2 used a human regression test as GOLD.

## The cohort (3 tasks, spanning tiers + a real rubric residue)

> **Task 1 SWAPPED (sign-off #1):** the RFC 7233 `Range` parser below is **retired from the cohort** in
> favor of a G2-style real-repo bug (see "Task 1 (replacement)"). It is kept here only as the descoped
> reference. The live cohort runs: **[real-repo bug] + [semver §11] + [/echo agentic]**.

### ~~Task 1 — HTTP `Range` header parser~~  ·  PREDICATE tier  ·  spec = RFC 7233 §2.1  ·  *(descoped — replaced)*
- **Prose (what the worker sees):** "Implement `parseRange(header, size)` for an HTTP `Range` request header
  over a resource of `size` bytes. Support `bytes=A-B` (inclusive), `bytes=A-` (A to end), `bytes=-N` (last N
  bytes). Return an array of `{start, end}` (inclusive, resolved against `size`); clamp `end` to `size-1`.
  Return `null` for a syntactically invalid header or a non-`bytes` unit; return `-1` (unsatisfiable) when a
  range's `start` ≥ `size`. Multiple comma-separated ranges are allowed."
- **Why uncrafted:** RFC 7233 is the authority; the subtle corners (suffix `-N`, open-ended `A-`, clamping,
  unsatisfiable-vs-invalid) are the standard's, not mine.
- **Reference (held back):** the RFC-correct resolver. **Mutants (validity gate):** off-by-one on `end`
  clamp; treat `bytes=-N` as `start=-N`; miss the unsatisfiable `start≥size` → `-1` case; accept a non-`bytes`
  unit. **GOLD (fresh):** `size` and ranges the prose doesn't list, incl. one suffix, one open-ended, one
  unsatisfiable, one multi-range.
- **Controls that can fail:** a stub returning `null` for everything must be caught (vacuous); the reference
  must pass the self-authored suite (else over-constrained → escalate SAFE); GOLD red on own-green ⇒ no deliver.

### Task 1 (replacement) — a G2-style real-repo bug  ·  PREDICATE tier  ·  spec = the repo's own issue + regression test
- **What it is:** an uncrafted, post-cutoff bug from a real repository, locked by a **human-authored
  regression test** (exactly as G2 did — that test is the GOLD, relayfact-held, never shown to the worker).
- **Prose (what the worker sees):** the issue/bug report as written by a human, plus the failing symptom —
  NOT my paraphrase of the fix. The worker gets the buggy tree (gate-write-scoped to the impl) and must make
  the human regression test pass.
- **Why uncrafted:** the bug, the fix, and the locking test are all the maintainers' — nothing authored to
  fit a reference. This is the strongest realness arm; it re-runs the G2 datapoint inside the assembled pipe.
- **Oracle / validity gate:** the human regression test **is** the GOLD; the "reference" is the maintainer's
  actual fix (held back); "mutants" = the pre-fix tree + near-miss partial fixes that leave the test red.
- **Controls that can fail:** the buggy tree must fail the human test RED first (else the bug isn't captured);
  own-green + human-test-red ⇒ no deliver; an over-narrow fix that passes only the self-authored suite but
  not the human GOLD ⇒ escalate.
- **SOURCE — LOCKED (2026-07-05):** `sindresorhus/filenamify` **PR #46** ("handle Windows reserved names with
  extensions", merged 2026-06-16, post knowledge-cutoff). ESM, single-file impl, one tiny data-dep
  (`filename-reserved-regex` — two regex factories, VENDORED inline so the fixture is `node_modules`-free and
  offline/token-free). The bug: reserved names WITH an extension (`CON.txt`) were left unsanitized because the
  check tested the WHOLE string against `/^(con|…)$/i`; the fix inserts the replacement suffix BEFORE the
  extension (`CON.txt`→`CON!.txt`, `NUL.tar.gz`→`NUL!.tar.gz`).
  - **prose (worker sees):** the issue + one example (`CON.txt`→`CON!.txt`); the buggy full `filenamify.js` tree.
  - **reference (held):** post-#46 `filenamify.js`. **stub:** identity. **mutants (k=5 canon: stub + 4 subtle):**
    (m1) original whole-string check; (m2) suffix appended at END, ignoring extension position; (m3) base via
    `lastIndexOf('.')` (breaks `NUL.tar.gz`); (m4) reserved regex without `/i` (misses `con.txt`).
  - **GOLD (independent = the maintainer's regression assertions, ported node:test):** `CON.txt`→`CON!.txt`,
    `con.txt`→`con!.txt`, `NUL.tar.gz`→`NUL!.tar.gz` (FRESH — not in prose; kills m3), `COM1.log`→`COM1!.log`,
    `LPT9.csv`→`LPT9!.csv`. The `NUL.tar.gz`/numbered-device cases are the discriminators the prose never lists.
  - **Vendoring caveat (honest):** only the two `filename-reserved-regex` factories are inlined (data, not the
    bug); the logic under test, the fix, and the locking assertions are all the maintainer's — nothing crafted.

### Task 2 — Semantic-version precedence compare  ·  PREDICATE tier  ·  spec = semver.org §11
- **Prose:** "Implement `compareSemver(a, b)` returning `-1 | 0 | 1` by SemVer precedence: compare
  major/minor/patch numerically; a version WITH a pre-release has LOWER precedence than the same without;
  compare pre-release identifiers left-to-right — numeric identifiers compared numerically, alphanumeric
  lexically (ASCII), numeric < alphanumeric, and a larger set of fields (when all preceding equal) has higher
  precedence; BUILD metadata (`+...`) is IGNORED."
- **Why uncrafted:** semver.org §11 is the authority; pre-release precedence is the canonical thing
  implementations get wrong.
- **Reference (held back):** §11-correct. **Mutants:** compare pre-release lexically only (miss numeric);
  forget "no-prerelease > prerelease"; let build metadata affect order; wrong tie-break on field count.
  **GOLD (fresh):** the §11 example chain (`1.0.0-alpha < …-alpha.1 < …-alpha.beta < …-beta < …-beta.2 <
  …-beta.11 < …-rc.1 < 1.0.0`) plus fresh pairs incl. a build-metadata-equal pair.
- **Controls:** stub returning `0` always → vacuous; reference must pass; GOLD arbitrates fit-to-pass.

### Task 3 — `/echo` HTTP service  ·  AGENTIC tier (deploy + probe)  ·  + a RUBRIC residue criterion
- **Prose:** "Implement `createApp()` returning a `node:http` server. `GET /healthz` → 200 + JSON
  `{status:'ok'}`. `POST /echo` with a JSON body → 200 + JSON echoing the SAME body under `echo`, plus a
  `count` = number of top-level keys in the body. Unknown routes → 404. Malformed JSON on `/echo` → 400 with
  a JSON error body whose `message` explains the problem in a developer-friendly way."
- **Tier:** the close is the AGENTIC exercise harness (F41): boot `server.listen(0)`, probe over real HTTP.
- **Grounded criteria (counted, in the close):** `/healthz` 200+shape; `/echo` round-trips the body; `count`
  correct; unknown → 404; malformed → **400** (status is grounded). **Rubric residue (1 criterion, NOT
  grounded):** "the 400 error `message` is developer-friendly" — judgment-only; pre-flight/advisory may note
  it, the close never gates on it. **⇒ per-task split ≈ 5 grounded / 6 total (the one rubric criterion reported,
  not gated)** — this is the task that makes the split non-trivial and MAPS the boundary (the experiment's point).
- **Reference (held back):** correct service. **GOLD (fresh):** a fresh multi-key payload (verifies `count`),
  a malformed-body probe (verifies 400), an unknown route.
- **Controls:** a server that 404s `/healthz` (unwired) → agentic red; own-green + GOLD-red ⇒ no deliver; the
  rubric criterion never flips a red close green.

## Build progress (token-free, no live budget spent yet)
- **Task 1 (filenamify real-repo bug) — ORACLE BUILT + PRE-CHECK GREEN (2026-07-05).** Assets under
  `test/fixtures/d7/filenamify/` (`reference.mjs` = post-#46, GOLD-verified by running; `stub.mjs`;
  `gold.test.mjs` = the maintainer's ported assertions; `prose.txt` = one example only; `task.mjs` derives the
  4 mutants by guarded single-substring patches). Token-free pre-check `test/d7-cohort.test.js` proves — via
  shipped `validateSuite`+`runClose` — that GOLD passes the reference, catches the stub, and KILLS all 4
  mutants. **Fail-capability proven:** dropping GOLD's `NUL.tar.gz` assertion lets `m3-lastindexof` survive →
  the pre-check goes RED (that maintainer case is load-bearing, not decorative).
- **Task 2 (semver §11) — ORACLE BUILT + PRE-CHECK GREEN (2026-07-05).** `test/fixtures/d7/semver/`: reference
  (§11-correct, verified by running the canonical chain + build-ignored + core-precedence cases); identity
  stub; 4 mutants — `m1` lexical-only, `m2` no-pre-order, `m4` field-count-reversed (guarded patches) + `m3`
  build-affects-order (explicit `mutant-build.mjs`, adds logic); GOLD = §11 chain + fresh pairs (build-equal,
  numeric). **Fail-capability proven:** removing the numeric-compare cases frees `m1`; removing the build pair
  frees `m3`. (`m1`/`m2`/`m4` are redundantly covered by the canonical chain — stronger, not weaker.)
- **Task 3 (/echo, AGENTIC tier) — ORACLE BUILT + PRE-CHECK GREEN (2026-07-05).** `test/fixtures/d7/echo/`:
  reference (stdlib-http service, verified GREEN by booting + probing via the GOLD harness); 404-everything
  stub; 4 guarded mutants (`m1` healthz-shape, `m2` count-zero, `m3` malformed-not-400, `m4` unknown-not-404);
  GOLD = an EXERCISE harness (`gold.exercise.mjs`, `command:['node','gold.exercise.mjs']`) that deploys the
  artifact and probes FRESH inputs over real HTTP. The one **rubric residue** ("the 400 message is
  developer-friendly") is in the `criteriaMap` as `eval:'rubric'` but has NO mutant (un-grounded ⇒ not an
  executable kill). Split proven **5 grounded / 6 total** offline via shipped `countGrounded()`.
  **Fail-capability proven:** dropping the `count` probe frees `m2`.
- **WIRING GAPS — BOTH CLOSED + TESTED (2026-07-05, token-free).**
  1. **Split** ✅ — `runRequest` takes an optional `criteriaMap`; `criteriaSplit()` routes it through shipped
     `countGrounded()` (Task 3 → 5/6; predicate tasks default 1/1). Backward-compatible.
  2. **Agentic close command** ✅ — `runRequest` takes `tier` (default `'predicate'`); the close is
     `['node','--test',suiteName]` (predicate) or `['node',suiteName]` (agentic exercise harness), threaded to
     `compile-close` (validity gate) and the worker (`opts.evaluate`+sensor), and the GOLD honors
     `goldSuite.command`. Tested in `test/pipeline.test.js`: an agentic run delivers with the exercise-harness
     GOLD green + split 5/6, AND the **agentic D5 tripwire** fires (a wrong server → exercise GOLD RED →
     `gold-mismatch`, never delivered). The `worker.mjs` close was already tier-agnostic (took `closeCommand`).
  - **The only remaining live part** is the AUTHOR: for an agentic task the worker must self-author an
    EXERCISE harness (not a `node:test` suite) from the prose. That is a live-model behavior verified during
    the run, not a wiring blocker — the plumbing above is proven token-free.

## Cohort execution

- **Models:** haiku on all 3 (the control tier); **sonnet on ≥1** (Task 2, the subtlest) to keep the
  model-modulation datapoint (F20/F33) — cost permitting, batch while the GPG cache is warm.
- **Per task, record:** pre-flight verdict; compile-close verdict (trusted/over-constrained/…); worker
  outcome (delivered | escalated-red | escalated-incomplete); **GOLD green/red**; iterations; grounded/rubric
  split (N/M); cost + calls. All emitted to the event log; the observer `renderRun` replays each.
- **PASS for the cohort** = every task ends in a **truthful** terminal state — delivered-green-AND-GOLD-green,
  OR a decision-ready escalation for a genuine reason — with **fit-to-pass = 0** across the cohort and the
  grounded/rubric split reported per task. A GOLD-red delivery anywhere is a **hard FAIL** (the tripwire).
- **Shape:** one `test/integration/d7-cohort.live.test.js` (self-skips unless `RELAYFACT_LIVE=1`), each task a
  `runRequest` call with its oracle+gold; a token-free `test/d7-cohort.test.js` can pre-validate each oracle
  offline (reference passes its own mutants' kill-check) before spending — so a mis-built oracle is caught free.

## Real-repo bug source (the one thing Task 1 still needs before running)
The swap requires a concrete bug. Candidates:
- **(a) Reuse the G2 private-repo bug** — already sourced, already locked by a human regression test, already
  post-cutoff. Cheapest; but it re-runs a datapoint we've seen (still real, still valid inside the pipe).
- **(b) A fresh private-repo bug** — another genuine bug from the user's own repos + its regression test. Real
  and unseen; needs the user to point at the repo/commit.
- **(c) A public-OSS post-cutoff bugfix** — pick a real merged bugfix (post knowledge-cutoff so it can't be
  memorized), revert it, transcribe the issue as prose, use the project's own regression test as GOLD. Fully
  uncrafted and reproducible; I can source it via web search, but it costs a scouting pass.

## Resolved sign-off (2026-07-05)
1. **Real/uncrafted:** swap one task for a G2-style real-repo bug (Task 1). ✅ — source TBD (above).
2. **Model sweep:** sonnet on Task 2 only. ✅
3. **Rubric residue:** one criterion, Task 3. ✅

## Descopes NOT reopened by D7
D2 (embeddings OUT), D4 (bare-refine terminate N/A), D6 (depth OUT) stay closed. D3 (bounded memory) and D5
(GOLD arbiter) are ALREADY wired into the pipe; D7 exercises them on real tasks but does not extend them.
