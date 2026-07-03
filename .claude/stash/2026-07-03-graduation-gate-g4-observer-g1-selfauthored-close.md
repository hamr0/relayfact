# relayfact — graduation gate defined (§8.2), G4 observer + G1 self-authored close done (2026-07-03)

**Status:** Still POC (no `src/`). **Now 3 commits** on branch `master`. **NO git remote configured** — nothing
pushed; user must add a remote (or give the URL) to push. Continues
`2026-07-02-graduation-push-memory-fixed-f11-depth-corrected.md`.

Commits this session:
- `81c62b0` G4 observer + §8.2 graduation gate (PRD gate G1–G5; `poc/observer.mjs` + `probe-18`; F32).
- `0809c6b` G1 (`probe-15`): self-authored close honesty; observer receipts-node render; verdict-bug fix; F33.

## WHY this session happened (the pivot)
User (on Opus 4.8) reviewed the prior "no open graduation blockers / graduate-or-archive" claim and pushed
back: the validated spikes only cover the loop's **MIDDLE** (worker + close + decomposition + memory + caps).
The stated GOAL is a full autonomy loop: **take a human request ONCE → go achieve it → come back and STOP if
POCs fail / goals can't be met / it doesn't make sense; otherwise keep going.** The two ENDS of that sentence
(request-IN, come-back-OUT) had ZERO evidence. User said I "was papering over things fast." So we REPLANNED the
POC with a real graduation gate before any `src/` rewrite.

## §8.2 GRADUATION GATE (added to PRD — the spine now)
Five criteria, each a POC-first spike with controls that can FAIL, or an explicit descope. Build order (revised
to fit the harness):
1. **G4 `probe-18` / `observer.mjs`** — token-free, built FIRST, instruments the rest. ✅ DONE.
2. **G1 `probe-15`** — the CRUX: who WRITES the close? ✅ POC-RUN (positive-with-caveat).
3. **G2 `probe-16`** — real-task e2e (uncrafted real repo, sonnet + haiku control). ⬜ NEXT.
4. **G3 `probe-17`** — the come-back: escalation artifact + pre-flight `proceed|clarify|decline`. ⬜.
5. **G5** — graduated v3 PRD, written last, encoding the numbers + explicit descopes. ⬜.
Archive path stays live: if G1 failed HARD (it didn't), archiving is the honest outcome.

## G4 — observer (DONE, F32)
`poc/observer.mjs` = ONE reusable PURE listener (never imports the engine, §7 invariant) over a run's PERSISTED
artifacts: `run-*.jsonl` (app events) + sibling `*-audit.jsonl` (bareguard audit). Renders 5 facets: grounded
close / memory / grounding boundary / gate / terminal. `probe-18-observer.mjs` replays over TWO existing logs
(probe-12 tree, probe-13 memory); CONTROL THAT CAN FAIL = "declare a facet ABSENT, don't fabricate it."
- The self-check caught **3 real bugs in my own observer**: (1) fabricated grounding-boundary facet off audit
  lineage for a memory run; (2) phantom "halts" from counting routine `severity:'action'` as a halt (a halt is
  only decision `deny`/`terminate` or halt-level severity); (3) audit-file match by plain `startsWith` let
  `run-probe12-depth` swallow `run-probe12-depth-ok`'s audit → fixed with LONGEST-matching-base assignment.
- **F32 load-bearing carry-forward:** RC-10 receipts tree + worker `Stream` events are RETURN-VALUE/console
  ONLY — NOT in the JSONL (`stream._transport:null`). So probes G1–G3 MUST emit a `receipts` event to persist
  the tree; observer renders it as `tree.source='receipts event...'` (PROVEN live on probe-15).
- Run: `node poc/observer.mjs poc/run-probe13.jsonl` · self-check `node poc/probe-18-observer.mjs` (exit 0).

## G1 — self-authored close (DONE, F33) — THE CRUX
Every prior probe was HANDED its predicate. G1 tests who WRITES it (R-S8 trap relocated one level up).
`poc/probe-15-selfauthored-close.mjs`, TWO PHASES:
- **Phase A (propose):** worker (tool `write_test` only, NO read tool) authors a `node:test` suite from a PROSE
  request. Phase-A grounded close = "a hidden REFERENCE impl must PASS your suite" (worker never sees it).
- **Deterministic relayfact-owned gate (zero rubric):** (a) STUB must be caught (suite fails on no-op);
  (b) N/M — each acceptance criterion has an OTHERWISE-CORRECT mutant violating exactly it; N = how many the
  suite catches (the §1 secondary-goal number done honestly: a criterion is *grounded* iff the close can FAIL
  on its violation).
- **Phase B (implement):** worker (tool `edit_impl` only) implements against its OWN suite (the self-authored
  close), gap fed back on failure.
- **GOLD verdict (independent truth):** a HIDDEN test I authored with FRESH values (not in prose) runs on Phase
  B's artifact — catches hardcoding/fit-to-pass. Oracle self-checked offline first (ref passes gold; stub + all
  8 mutants fail gold) BEFORE spending tokens.

**Fixtures:** `poc/fixtures/g1-money/prose.md`, `poc/fixtures/g1-csv/prose.md` (only prose.md is source;
impl/suite/gold are gitignored, materialized at runtime; reference/mutants/gold live as STRINGS in the probe so
the no-read-tool worker can never see them).

**RESULTS (haiku; money 3 runs, csv 5 runs — scoped signal, NOT a rate):**
- **money (fully-specified spec) = 3/3 HONEST.** Grounded 4/4, stub caught, ref passes, Phase B artifact
  GOLD-correct every run. Self-authored close worked end-to-end, no human touching tests.
- **csv (under-specified: quoting/escaping corners) = 2/5 honest, 3/5 OVER-CONSTRAINED.** On failures the worker
  wrote a thorough 33-test suite that INVENTED assertions for prose-unspecified behavior (e.g. "quote at end of
  unquoted field", "four consecutive quotes") diverging from a reasonable reference → Phase-A validity check
  CAUGHT it → `run.escalate` (blocker=over-constrained), never reached Phase B.
- **fit-to-pass (own-suite GREEN + gold RED) = 0 observed across all 8 runs.** Failures were all SAFE-direction
  (over-specify → caught → escalate), never silent wrongness.

**Durable claim (F33):** self-authored-close honesty tracks **SPEC COMPLETENESS** — a complete spec → reliable
gold-correct close; an incomplete spec → the agent fills gaps with guessed criteria (the §5 HITL/rubric residue,
seen from the authoring side). The "a correct impl must pass your suite" + stub-catch + independent gold is what
keeps even a self-authored close honest. **fit-to-pass unobserved ≠ excluded** — haiku over-specifies; a weaker
model / shallow-inviting spec is the honest next test.

**Verdict-logic BUG caught + fixed mid-run (inverse paper-over):** first pass excluded escalated
(`broken-suite`) requests from the denominator → printed false `g1.PASS`. Fixed: EVERY request counts; each
fail-mode NAMED (honest / over-constrained / fit-to-pass / weak-grounding / vacuous / unclosed / no-close). csv
is FLAKY (over-constrains ~3/5), so the probe's pass/fail flips run-to-run — that's honest, reported at altitude.

Run: `ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-15-selfauthored-close.mjs [money|csv]` (no arg=both).

## OPEN / NEXT
1. **G2 `probe-16`** (NEXT in order): whole pipe as ONE program — request → contract → decompose → workers →
   synthesize → close → deliver-or-escalate — on a SMALL REAL repo pinned at a bug-fix commit's PARENT (uncrafted;
   the human-written test already exists, fix known-possible but absent; prefer recent/obscure so not memorized).
   Consumes G1's compiled close (or repo's own suite if G1-mode fails — noted). PRODUCTION model = sonnet-class;
   haiku = A/B control. Measure: scaffolding interventions (F20 baseline 6; pass bar ≤2), cost, close verdict,
   N/M. Attach observer. This is the 3rd required observer log (G4 partial → complete). MOST EXPENSIVE probe.
2. **G1 sonnet arm still UNRUN** (key/pinentry timed out mid-sampling — key expires mid-session, run probes
   back-to-back while warm). Worth running to see if a stronger model over-specifies csv less.
3. **G3 `probe-17`**, then **G5** graduated PRD.

## DOCTRINE / OPERATIONAL REMINDERS (this session honored; keep honoring)
- Prove-don't-assert: the oracle was self-checked offline before spending tokens; the observer's own bugs were
  caught by a control that can fail; verify by RUNNING. No fit-to-pass; name every fail-mode; state claims at the
  altitude the construction supports. Surface to FINDINGS (now F1–F33) / UPSTREAM-FIXES; poc/ is throwaway.
- Consume-don't-build: observer + probe-15 are relayfact-owned GLUE (compilation, observability) — no primitives
  grown. recurse/refineLeaf/Gate/litectx all consumed.
- Commit only when the user asks (they did). End commits with the Co-Authored-By trailer. NO REMOTE = no push.
- Key via `pass amr/claude_api`, runtime-injected, never in tree. Model haiku (small on purpose); sonnet-5 arm
  pending for G1/G2. Local libs: bare-agent 0.23.0, bareguard 0.10.1, litectx 0.26.1.
