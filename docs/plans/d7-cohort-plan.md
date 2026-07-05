# D7 — the ≥3-real-task benches cohort (plan, for sign-off)

**Status:** DRAFT — awaiting sign-off on "what counts as real/uncrafted" before running. This is the last
`src/` build item (PRD-v3 §6 step 5, descope D7); on completion → retire `poc/`, cut `0.1.0`.

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

### Task 1 — HTTP `Range` header parser  ·  PREDICATE tier  ·  spec = RFC 7233 §2.1
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

## Open questions for sign-off
1. Do these 3 count as "real/uncrafted" for you (external-authority specs + fresh GOLD), or do you want a
   real-repo bug (G2-style) as one of the three instead of a standards-transcription task?
2. Sonnet on Task 2 only, or a wider model sweep (cost ↑)?
3. Is the single rubric-residue criterion (Task 3's error-message quality) the right way to make the split
   non-trivial, or should more tasks carry a rubric criterion?

## Descopes NOT reopened by D7
D2 (embeddings OUT), D4 (bare-refine terminate N/A), D6 (depth OUT) stay closed. D3 (bounded memory) and D5
(GOLD arbiter) are ALREADY wired into the pipe; D7 exercises them on real tasks but does not extend them.
