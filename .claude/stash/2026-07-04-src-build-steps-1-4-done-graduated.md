# relayfact — GRADUATED; `src/` build steps 1–4 DONE + live-verified; only step 3-D3 + step 5 remain (2026-07-04)

**Status:** Graduation gate COMPLETE (G1–G5 all met, call = **GRADUATE**), and the `src/` REWRITE is now
underway — this is the FIRST shippable code (poc/ stays throwaway, §2). Continues
`2026-07-04-all-empirical-gates-met-only-g5-remains.md`.
**Local lib versions (unchanged, verified prior sessions):** bareguard 0.11.1 · bare-agent 0.25.0 · litectx 0.26.1.
**7 COMMITS THIS SESSION (all on `master`, no remote):** `51dc82f` (G5 graduated PRD), `c0d318b` (step 1),
`8d5fc35`+`b32b5e6`+`3ca87e4` (step 2), `80c381b` (step 3 core), `caecf4f` (step 4). Working tree clean except
the usual `.claude/friction/*` + `.claude/memory/*` auto-gen churn + this stash (deliberately uncommitted).
**`npm test` = 50 tests / 45 pass / 5 live-skip** (token-free by default). Test cmd: `node --test 'test/**/*.test.js'`.

## THE VERDICT THAT REFRAMED THE SESSION (answered for the user)
G1–G5 = the graduation **GATE** (a decision test, all throwaway `poc/` probes) → it decided **GRADUATE vs
archive**. Passing it does NOT build the product. **Graduation = the `src/` build** (a rewrite; §2). So the
current work is NOT "more POCs" — it's the actual thing. The user asked this explicitly ("i thought we
finished… why more pocs?"); the line is: gate done → now constructing.

## G5 written (the graduated PRD) — `docs/01-product/relayfact-prd-v3-graduated.md`
User chose **graduate recommendation** framing. Doc encodes G1–G4 numbers, makes G5-EXIT testable (prose+repo
→ pre-flight → grounded close w/ independent GOLD arbiter → gated recurse() → deliver-green-or-escalation, on
**≥3 real tasks**, grounded/rubric split counted per task), and draws **7 explicit descopes** (D1 agentic tier
IN-first-spike; D2 embeddings OUT per F26; D3 memory-widening IN w/ store cap per F29; D4 bare-refine terminate
OUT/N-A per F30; D5 fit-to-pass IN as standing GOLD guard; D6 depth OUT per F13/F28/F31; D7 scale IN via
cohort). **§5.1** has the two-eval-placement diagram + corrected lib ownership. Archive path stayed live, not
chosen (§7). v1 PRD §8.2 G5 marked WRITTEN; CHANGELOG phase → gate COMPLETE.

## LIB OWNERSHIP — settled from SOURCE (user asked twice; corrected their model twice)
- **bareagent** = the loop (recurse/refine/refineLeaf = the "rlm") + the eval SEAM: `Evaluator`, `Verdict
  {status:satisfied|needs_revision|failed, pass, score, critique, suggestions}`, `Criteria.predicate|rubric|
  agentic`. recurse `opts.evaluate` and `refineLeaf.sensor` both RETURN a Verdict.
- **relayfact** = the eval JUDGMENT (the predicate BODY: run a real command, exit code = truth) + PRD→close
  compilation + persona + fixed write path. The ONE thing it's doctrinally allowed to own.
- **bareguard** = the LEASH ONLY (Gate: caps/halts/writeScope/audit/redaction). It has **NO eval primitive** —
  correctly (wrong axis: "is the action allowed" ≠ "is the result correct"). **NOT the evaluator.** No missing
  primitive, no finding.
- **litectx** = memory (recall/remember). Not yet wired into src/ (that's D3).

## `src/` BUILD — what's DONE (each with a LIVE run whose output was SHOWN; every load-bearing control fail-capable)
Build order = v3 PRD §6. `npm run` uses `node --test`; live tests self-skip unless `RELAYFACT_LIVE=1` + key.
- **step 1 ✅ `src/event-log.mjs` + `src/observer.mjs`** — the §7 spine (append-only JSONL, `{...payload,type,
  seq,ts}` stamped LAST so payload can't clobber; stdlib `node:fs`, NOT bareagent's JsonlTransport — dep
  hierarchy + §7 decoupling) + the pure-listener observer contract. **§7 control proven fail-capable** (inject
  a spine import → red → revert).
- **step 2 ✅ `src/close.mjs` + `validity-gate.mjs` + `compile-close.mjs` + `author.mjs`** — the grounded close
  (exit→Verdict: 0→satisfied, nonzero→needs_revision RETRYABLE gap-fed-back, spawn-err/signal/null→failed
  TERMINAL-escalate; array-only no-shell) + the G1 honesty machinery (validateSuite = stub-catch +
  reference-gate + mutant-kill≥4/5; countGrounded N/M; **arbitrate = the standing GOLD arbiter, D5**:
  own-green+GOLD-red ⇒ fit-to-pass, never deliver) + prose→close orchestration + the LLM author
  (authorSuiteViaRecurse: maxDepth:0 recurse worker, write_test tool write-scoped by a bareguard Gate).
  **LIVE (haiku): a real worker self-authored a suite from prose → relayfact found it `trusted`, 5/5 mutants
  killed.** 🔴 **Bug caught BY RUNNING:** under `node --test`, a spawned `node --test` close inherits
  `NODE_TEST_CONTEXT`, defers to parent, EXITS 0 even when tests FAIL → close would map RED→green
  (fit-to-pass-class). Fix: runClose strips `NODE_TEST_CONTEXT`; pinned by a fail-capable regression test.
- **step 3 ◑ CORE DONE `src/worker.mjs`** — the gated implement loop: edit_file write-scoped by the Gate; SAME
  deterministic close is both `opts.evaluate` (global top) and `refineLeaf.sensor`; final close re-run
  AUTHORITATIVELY on the delivered artifact; `deliveryDecision` pure helper (delivers iff final-green AND not
  incomplete). **LIVE (haiku): (1) satisfiable close → red→green DELIVERED (1 iter); (2) LOAD-BEARING CONTROL:
  unsatisfiable close (double(2)==4 AND ==5) → `escalated-red`, delivered=false — worker tried, deterministic
  close REFUSED to certify, and it COULDN'T fake green (gate write-scopes impl, not the suite).**
  **DEFERRED within step 3 (logged, NOT dropped):** litectx close-driven recall widening (**D3**) + multi-file
  `resolveIn` targeting.
- **step 4 ✅ `src/escalation.mjs` + `src/preflight.mjs`** — the come-back: buildEscalation `{goal,blocker(§5),
  whatWasTried[],decisionNeeded{q,options},receipts,costSpent}` from a DECISION map; **isDecisionReady = the
  control that can fail** (rejects bare {incomplete}, <2 options, attempt-bearing stop w/ empty whatWasTried,
  unknown blocker). Pre-flight = a bounded bareagent `Loop` (system prompt, NO tools — **verified Loop.run
  interface against source, did NOT guess provider.chat**); parsePreflight split pure with SAFETY property:
  **garbage/unknown verdict NEVER yields `proceed`** → clarify. **LIVE (haiku) both corners: coherent→proceed
  (never false-block), nonsense→decline (never false-go).**

## NEXT (in order) — RECOMMENDED: assemble the pipe first
1. **Assemble the pipe** (capstone): one top-level program pre-flight → compile-close → worker →
   deliver-or-escalate, EVERY step emitting to the step-1 event log; ONE live e2e run + the observer (step 1)
   rendering it. Makes the spine earn its place; the honest prerequisite for step 5's cohort. Mostly
   deterministic + one live run.
2. **step 3 D3** — litectx close-driven recall widening over a CAPPED store. ⚠️ Do this in its OWN careful
   session — memory is exactly where poc/probe-06/07/08 got caught FIT-TO-PASS. Needs: a transferable RULE not
   containing the answer, equally-rich WRONG distractors (F26), failure-derived query, blind-vs-recall control.
3. **step 5** — the `agentic`-tier close spike (D1) + the **≥3 real-task cohort** (D7) = first graduated-shape
   benches datapoints. Then retire poc/, version 0.1.0.

## DOCTRINE HONORED (keep honoring) — user pushed HARD on this
- User challenged "are you verifying for real or handwaving?" → answer: every "green" was a SHOWN command
  output; load-bearing claims proven FAIL-CAPABLE (mutation/injection); live runs pasted their actual output.
- Honest thinness NAMED, not hidden: live runs are n=1 trivial `double` fixture, one model (haiku) — they
  verify WIRING reproduces G1's shape, NOT a fresh honesty claim (that was poc/probe-15). Observer hasn't yet
  rendered a REAL engine run's log (rich renderer deferred).
- Verified lib INTERFACES against source before use (Verdict shape; Loop.run vs guessed provider.chat) —
  caught a wrong-interface guess before shipping.
- Key via `pass amr/claude_api` (GPG pinentry, expires — batch live runs while warm). Live tests gated behind
  `RELAYFACT_LIVE=1` so `npm test` is token-free. poc/ throwaway. Commit only when user says (they did each time).
- No fit-to-pass; controls that can FAIL; claim only at the altitude the construction supports.

📝 9 stashes since last consolidation — run `/remember` to fold them into memory.
