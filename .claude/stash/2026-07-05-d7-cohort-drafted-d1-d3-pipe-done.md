# Stash — 2026-07-05 — pipe assembled + D3 + D1 done; D7 cohort drafted (awaiting sign-off)

## One-line state
`src/` build is one item from done: **steps 1–4 ✅, pipe assembled ✅, D3 ✅, D1 ✅** — only **D7 (the
≥3-real-task benches cohort)** remains, and it is **drafted and awaiting user sign-off** before spending live
budget. Then: retire `poc/`, cut `0.1.0`.

## What happened this session (commits, newest first)
- `10d0b44` **docs(plan): D7 cohort DRAFT** → `docs/plans/d7-cohort-plan.md` (3 tasks, for sign-off — NOT run).
- `e2000a6` **D1: agentic eval tier proven** — deploy+probe the real artifact; no new primitive.
- `43798a0` docs: sync CHANGELOG + graduated PRD to build state.
- `9cbbcb2` **D3: close-driven recall widening** — live A/B proves memory load-bearing.
- `e3e7077` **pipe ASSEMBLED** — `src/pipeline.mjs::runRequest`, live e2e green.
- (prior session: `caecf4f` step 4, `80c381b` step 3, `3ca87e4` step 2, etc.)

## The three things built this session (all live-verified, controls fail-capable)
1. **The pipe — `src/pipeline.mjs::runRequest`** (F39). Composes ① pre-flight → ② compile grounded close →
   ③ gated worker on `recurse()` → ④ D5 GOLD arbiter → deliver | decision-ready `run.escalate`, every step on
   the event log. **Two gates by design** (author writes ONLY the suite; worker ONLY the impl — own-green
   uncheatable). Added two escalation stop-classes to `src/escalation.mjs`: `close-untrustworthy`,
   `gold-mismatch`. `src/observer.mjs` gained `renderRun` (pure listener, `node:fs`-only, §7 intact). Live e2e
   (haiku, n=1): proceed → trusted (5/5 mutants) → red→green → GOLD green on fresh values → DELIVER 1/1.
2. **D3 — `src/memory.mjs`** (F40). Close-driven recall widening over a BOUNDED set (base 3→cap 6) + rule-framed
   `fact` lessons + fit-to-pass guard. Wired as an OPTIONAL `memory` seam in `src/worker.mjs` that augments the
   retry SENSOR only, NEVER the top `opts.evaluate` (a note can't close the loop; only the test can). Default
   off ⇒ worker/pipe behavior byte-identical. Token-free: real BM25 BURIES the right note at **rank 3**
   (pinned, verified-by-running); base window misses it, widening surfaces it. **Live A/B (n=1/haiku): memory
   is LOAD-BEARING** — blind starves, memory delivers (attempt1 window3=wrong twins→RED, attempt2 window6
   surfaces the right rule→GREEN). **A leaky+confounded first draft was CAUGHT by the widening control** (task
   example leaked the convention + unequal attempts) — fixed, then honest. Re-hit F26 firsthand (abbreviated
   distractors lost the burial).
3. **D1 — the agentic eval tier** (F41). **No new primitive:** `runClose` is tier-agnostic; an agentic close is
   just an EXERCISE harness (`node exercise.mjs` — boot `server.listen(0)`, probe `/health` over real HTTP with
   timeout+watchdog, exit code = truth) in place of `node --test`. Token-free (`test/agentic-close.test.js`):
   correct→green; wrong-body/no-response/boot-throw→red; **money case = unit-GREEN but integration-RED** (an
   unwired server whose `health()` unit-passes is caught RED by the agentic close = strictly stronger than
   predicate). Live (n=1/haiku): red→green DELIVER + contradictory-probe→escalate.

## Test state
`npm test` → **72 tests / 63 pass / 9 live-skip / 0 fail** (token-free by default). Live tests self-skip unless
`RELAYFACT_LIVE=1` + `ANTHROPIC_API_KEY` (via `pass amr/claude_api`). All live checks this session PASSED.

## NEXT: run D7 (after sign-off) — read `docs/plans/d7-cohort-plan.md` first
The plan drafts **3 tasks** spanning tiers, uncrafted (external-authority) specs, fresh independent GOLD:
1. **HTTP `Range` parser** — predicate, RFC 7233 §2.1.
2. **`compareSemver`** — predicate, semver.org §11 (the subtle one; run sonnet on this arm too).
3. **`/echo` HTTP service** — AGENTIC tier (deploy+probe) + **one rubric-residue criterion** ("400 error
   message is developer-friendly") so the per-task grounded/rubric split is non-trivial (~5 grounded / 6 total).

**3 open questions for the user** (in the plan's last section): (1) do external-authority specs + fresh GOLD
count as "real/uncrafted," or swap one for a G2-style real-repo bug? (2) sonnet on Task 2 only or wider sweep?
(3) is one rubric-residue criterion the right way to make the split non-trivial?

**How D7 wires:** each task = a `runRequest` call with `{ request, oracle{reference,stub,mutants}, goldSuite,
tier }`. `oracle` = relayfact-held validity truth (NOT shown to the worker). Shape: one
`test/integration/d7-cohort.live.test.js` + a token-free `test/d7-cohort.test.js` that pre-validates each
oracle offline (reference kills its own mutants) before spending. **PASS** = every task truthful-terminal
(deliver-green+GOLD-green OR decision-ready escalation), **fit-to-pass = 0**, split reported per task; **any
GOLD-red delivery = hard FAIL**. Denominator counts EVERY task; name every fail-mode.

## Doctrine reminders that bit this session (don't relearn)
- **Memory is where probes got caught fit-to-pass** — every positive arm must be able to fail: no answer in the
  recalled note/task, competing distractors, query derived from the failure, equalize confounds, verify the
  BM25 burial per store (it's length-sensitive, F26). State claims at exactly the altitude the construction
  supports; name n=1 thinness.
- **Verify lib interfaces + "green" by RUNNING**, never by reading a note. The agentic/D3 wins are both n=1
  live + a rigorous token-free control; keep them separate in claims.
- Surface issues to FINDINGS.md / upstream; never a silent workaround. `poc/` is throwaway.

## Key files
- `src/pipeline.mjs` (runRequest), `src/memory.mjs` (D3), `src/worker.mjs` (memory seam), `src/close.mjs`
  (runClose, tier-agnostic), `src/escalation.mjs` (+2 stop-classes), `src/observer.mjs` (renderRun).
- Tests: `test/pipeline.test.js`, `test/memory.test.js`, `test/agentic-close.test.js`; live:
  `test/integration/{pipeline,memory,agentic-close}.live.test.js`.
- Docs: `docs/plans/d7-cohort-plan.md` (NEXT), `docs/00-context/FINDINGS.md` (F39/F40/F41),
  `docs/01-product/relayfact-prd-v3-graduated.md` (build-progress block + §6 + D-table synced).
