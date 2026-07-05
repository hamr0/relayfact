# Changelog

All notable changes to relayfact are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); relayfact is pre-release (`0.0.0`) and
versioning starts at its first graduated build. Until then, entries are grouped by phase
(`POC → design → build`, per AGENT_RULES). Library friction is logged separately in
[`docs/00-context/FINDINGS.md`](./docs/00-context/FINDINGS.md) (F-numbers referenced below).

## [Unreleased]

Phase: **`src/` build UNDERWAY (the graduated rewrite; `poc/` discarded, §2) — build steps 1–4 shipped +
the pipe ASSEMBLED end-to-end + D3 (memory widening) done.** Against `relayfact-prd-v3-graduated.md` §6:
step 1 (spine+observer) ✅ · step 2 (close+honesty+author) ✅ · step 3 (gated worker) ✅ + **D3 close-driven
recall widening** ✅ · step 4 (pre-flight+escalation) ✅ · **the pipe assembled into one `runRequest`
(prose+repo → deliver|escalate, live e2e green)** ✅ · **step 5 `agentic`-tier close spike (D1) done** ✅ · **benches cohort (D7) UNDERWAY — shape signed off,
all THREE task oracles built + token-free pre-check green across predicate & agentic tiers** 🔨.
**Remaining: two token-free pipeline wiring gaps + the live cohort run** — then retire `poc/` and cut
`0.1.0`. Every step
live-verified where it spends tokens; every load-bearing control fail-capable. _(prior phase:)_ **graduation gate (§8.2
G1–G5) COMPLETE — G1/G2/G3/G4 met, G5 written → the call was GRADUATE.**
_(prior:)_ **v2 spikes complete + graduation gate IN PROGRESS — G1/G2/G3/G4 met, G5 open.** v1 POC
complete; v2 de-risked on shipped `recurse()`. The earlier "no open blockers / graduate-or-archive" framing was
**premature** — the validated spikes covered the loop's MIDDLE (worker/close/decomposition/memory/caps); the
two ends of the goal (request-IN = who authors the close = G1; come-back-OUT = escalation = G3) had no evidence,
so graduation is now gated on §8.2. **Done: G4 observer (token-free microscope, built first), G1 self-authored
close (honest-to-spec-completeness, `probe-15`/F33), G2 real-task e2e (whole pipe green on an uncrafted repo,
both models, `probe-16`/F36). Two real lib bugs surfaced + shipped + verified-by-running en route: BA-10
(temperature, 0.24.0/F34) and BG-3 (content payload false-fire, 0.11.0/F35) + its sibling BA-11 (deny-spin
short-circuit, 0.25.0). G2 now stands on STOCK library defaults (override removed).** Remaining: **G3**
(come-back/escalation, `probe-17`), **G5** (graduated PRD), + the still-unrun G1 sonnet arm. Earlier de-risking:
replay-reconciliation + Spike 1 (grounding); **Spike 2 = memory-loop wiring proven,
then HARDENED — and the probe-09 positive largely did NOT survive the controls** (probe-06/07/08 fit-to-pass +
RETRACTED; probe-09 honest redo; probe-10/11 hardening, **F26–F27**). The honest end-state: lexical recall
ranks on *similarity, not correctness* (an equally-rich wrong rule outranks the right one), so naive top-k can
starve/mislead the worker; the memory loop's value is in the **worker + grounded close**, not ranking.
**Spike 3 (probe-12/F28)** held the grounding seam at organic decomposition (grounded coverage = root only;
global predicate catches an ungrounded child's fault) but found depth is **model-bounded** — haiku won't nest
past depth 1, so depth-2 reach is unproven. All blocking upstream asks shipped + verified through bareagent
v0.23.0 / bareguard v0.10.x. **All three v2 spikes are run; next is the graduate-or-archive call.** No
shippable `src/` yet, by design.

### Added — D7 cohort: Tasks 2 (semver §11) + 3 (/echo agentic) oracles built + pre-check across both tiers (2026-07-05)

- **Task 2 — semver §11 precedence** (`test/fixtures/d7/semver/`, predicate, the sonnet arm). Reference is
  §11-correct (verified by running the canonical precedence chain + build-ignored + core-precedence cases);
  stub returns `0` always; 4 subtle mutants = lexical-only / forget-no-pre>pre / build-affects-order /
  reversed field-count tie-break (three guarded patches + one explicit `mutant-build.mjs`). GOLD = the §11
  chain + fresh pairs (an equal-build pair, a numeric pair). Fail-capability proven per-mutant.
- **Task 3 — /echo service** (`test/fixtures/d7/echo/`, **AGENTIC tier** + one **rubric residue**). The close
  is an EXERCISE harness that DEPLOYS the artifact (`server.listen(0)`) and probes it over real HTTP (exit
  code = truth), mirroring D1/F41 — reference verified GREEN by booting + probing. 4 grounded mutants
  (healthz-shape / count-zero / malformed-not-400 / unknown-not-404); the rubric criterion ("the 400 message
  is developer-friendly") is un-grounded and carries NO mutant. Split = **5 grounded / 6 total**.
- **Pre-check generalized** (`test/d7-cohort.test.js`): `goldRunnerFor` now runs each task's own close command,
  so the same shipped `validateSuite`+`runClose` path validates predicate (`node --test`) and agentic
  (`node exercise.mjs`) oracles alike; a new test asserts the per-task grounded/rubric split via shipped
  `countGrounded()`. Fail-capability shown on every task by weakening a GOLD case → a mutant survives → red.
- **Two live-run wiring gaps flagged** (both token-free, to close alongside the run): `criteriaSplit()`
  hardcodes `1/1` (→ route through `countGrounded`); `pipeline.mjs` hardcodes the `node --test` close command
  (→ thread a per-task close command so the agentic task runs its exercise harness).
- Suite: **76 tests / 67 pass / 9 live-skip / 0 fail** (token-free). No live budget spent.

### Added — D7 benches cohort: signed off + Task 1 (real-repo bug) oracle built + token-free pre-check (2026-07-05)

- **Sign-off decisions** (`docs/plans/d7-cohort-plan.md`): the cohort is 3 tasks — a **real-repo bug** (swapped
  in for the original RFC `Range` task), semver §11, and a `/echo` agentic service; **haiku ×3, sonnet on the
  semver arm** (model-modulation datapoint); **one rubric-residue criterion** on the agentic task so the
  grounded/rubric split is non-trivial (~5 grounded / 6 total).
- **Task 1 source locked:** `sindresorhus/filenamify` **#46** ("handle Windows reserved names with
  extensions", merged 2026-06-16 — **post knowledge-cutoff**, human-authored regression test = GOLD). ESM,
  single-file impl, one data-dep (`filename-reserved-regex`) **vendored inline** so the fixture is
  `node_modules`-free/offline (only the regex data is vendored; the bug, fix, and locking assertions are all
  the maintainer's — nothing crafted).
- **Oracle** (`test/fixtures/d7/filenamify/`): `reference.mjs` (post-#46, verified correct by running against
  every GOLD + control case), `stub.mjs` (identity), 4 subtle mutants derived by **guarded** single-substring
  patches in `task.mjs` (each throws if its anchor goes stale — no silent no-op mutants), and `gold.test.mjs`
  = the maintainer's regression assertions ported verbatim ava→`node:test`. Prose gives only the `CON.txt`
  example; GOLD's `NUL.tar.gz`/`COM1.log`/`LPT9.csv` cases are **fresh** discriminators the prose never lists.
- **Token-free pre-check** (`test/d7-cohort.test.js`): via shipped `validateSuite`+`runClose`
  (replay-through-shipped-code) it proves GOLD passes the reference, catches the stub, and **kills all 4
  mutants** — catching a mis-built oracle for free before any live budget. **Fail-capability proven:** drop
  GOLD's `NUL.tar.gz` assertion and `m3-lastindexof` survives → the pre-check goes red (that maintainer case
  is load-bearing, not decoration).
- **Wiring gap flagged for the live run:** `pipeline.mjs::criteriaSplit()` is hardcoded `1/1`; Task 3's real
  ~5/6 split must route through the existing `validity-gate.mjs::countGrounded()` before the cohort runs.
- Suite: **73 tests / 64 pass / 9 live-skip / 0 fail** (token-free). No live budget spent.

### Added — `src/` step 5, D1: the `agentic` eval tier proven (deploy + probe the real artifact) (F41, 2026-07-05)
- **The strongest close tier (§5) exercised for the first time — NO new relayfact primitive.** The result:
  `runClose` is already tier-agnostic, so an agentic close is just an EXERCISE harness (`node exercise.mjs` —
  boot `server.listen(0)`, probe `/health` over real HTTP with a timeout + watchdog, exit code = truth) in
  place of a `node --test` suite. The worker is write-scoped to the artifact, never the exercise (same
  uncheatable shape). All three tiers flow through the one `opts.evaluate` seam relayfact owns. `npm test`
  = 63 pass / 9 live-skip.
  - **`test/agentic-close.test.js` (token-free, real TCP, controls that can FAIL):** correct deploy → GREEN;
    wrong body / never-responds (caught by the 2.5s timeout, not a hang) / boot-throws → each RED; and **the
    strongest-tier case — unit-GREEN but integration-RED:** an artifact whose `health()` unit-passes but whose
    `createApp()` never routes `/health` is caught RED by the agentic close (the integration gap a source test
    structurally cannot see) — this is the evidence §5's "strongest tier" claim needed.
  - **`test/integration/agentic-close.live.test.js` — LIVE (haiku, n=1 named):** same `src/worker.mjs`, same
    leash, ONLY `closeCommand` changed to `['node','exercise.mjs']`. **deliver:** the worker implemented
    `createApp()` from prose → deploy+probe close drove **red→green, DELIVERED** (1 iter). **CONTROL:** a
    contradictory probe (no live server answers `/health` both `{ok:true}` and `{ok:false}`) →
    **escalated-red, delivered=false** — a live green cannot be faked.
  - **Descope D1 shrinks:** the eval table may now list **predicate- AND agentic-tier both proven on a real
    artifact**; the "designed, not evidenced" caveat is lifted for this artifact class (bound: n=1, one model,
    a stdlib `node:http` server, in-process listen + localhost probe — a real TCP round-trip, not a
    separate-process/networked deploy). **Step 5 remaining: the ≥3-real-task cohort (D7).**

### Added — `src/` D3: close-driven recall widening over a bounded set (F40, 2026-07-05)
- **D3 (the step-3 memory follow-on) shipped — graduates probe-13's fix (F26/F27/F29) into `src/`.** relayfact
  OWNS the widening POLICY + candidate FRAMING + the BOUND; litectx owns the store + BM25 (consumed). `npm test`
  = 58 pass / 7 live-skip.
  - **`src/memory.mjs`** — `makeWidener` (on each FAILED close the recall window widens `base 3 → cap 6` over a
    BOUNDED candidate set — the close drives recall, not rank), `frameCandidates` ("unverified — the TEST
    decides"), `rememberLesson` (rule-framed litectx `fact`), `windowFor` (pure schedule). **THE BOUND (D3):**
    sound only for a bounded pool; unbounded-store retrieval stays an open caveat (F26/F27) — this reaches
    *past* rank within the bound, it does NOT fix rank.
  - **`src/worker.mjs`** — an OPTIONAL `memory` seam: it augments the retry SENSOR only, NEVER the top
    `opts.evaluate`, so a note can never close the loop — only the test can. Default off ⇒ existing worker/pipe
    behavior byte-identical. `src/pipeline.mjs` threads it and emits `recall` events; `observer.mjs` renders them.
  - **`test/memory.test.js` (token-free, real BM25, controls that can FAIL):** over the adversarial store
    (2 length-matched wrong "twins" + far notes + the right rule) the failure query BURIES the right note at
    **rank 3** (verified-by-running, pinned); a rank-trusting base window MISSES it (starvation real), a
    non-widening widener never reaches it (fail-capability shown directly), close-driven widening surfaces it;
    a fit-to-pass guard asserts the surfaced note carries no literal answer.
  - **`test/integration/memory.live.test.js` — LIVE A/B (n=1, haiku): memory is LOAD-BEARING.** Same task, same
    4-temperature budget, ONLY memory differs; a leak-proof suite (failure output reveals no `AUDIT`/`000006`/
    `<<` — verified) + a leak-free task (convention withheld). **BLIND** starves (`delivered=false`);
    **MEMORY** delivers — attempt 1 window 3 = wrong twins (buried → RED), attempt 2 window 6 surfaces the
    right rule → GREEN. *Recall proposes (rank-first = wrong), the executable close disposes, widening rescues.*
  - **The control CAUGHT a confound (the session's whole discipline).** A first live draft leaked the convention
    via a worked task example AND gave the arms unequal attempts — the memory arm "passed" on wrong-only notes;
    the "widening must reach window ≥6" assertion FAILED and exposed it. Fixed both, then the honest A/B held.
    Also re-confirmed F26 firsthand (an abbreviated distractor store lost the burial). n=1/haiku named; the
    token-free test carries the policy claim, the live A/B carries the load-bearing claim.

### Added — `src/` the PIPE ASSEMBLED: prose+repo → deliver|escalate as one program (F39, 2026-07-05)
- **The capstone: build steps 1–4 composed into one top-level `src/pipeline.mjs::runRequest` (§5/§5.1/
  G5-EXIT).** A prose request + a repo dir go IN; a DELIVERED green artifact or a decision-ready `run.escalate`
  comes OUT, every step narrated to the event log. Builds no new engine — only composes. `npm test` = 52 pass /
  6 live-skip.
  - **Pipe:** ① pre-flight (rubric OPENS HITL, never closes) → ② compile the grounded close (worker
    self-authors, validity-gate TRUSTS it) → ③ gated worker on `recurse()` (same close = top predicate +
    leaf sensor) → ④ **D5 GOLD arbiter** → deliver green OR a G3 escalation. Two escalation stop-classes the
    assembly needed added to `escalation.mjs` (`close-untrustworthy`, `gold-mismatch`) — both decision-ready.
  - **Two gates by design:** the author writes ONLY the suite; the worker writes ONLY the impl (write-scope
    EXCLUDES the suite) — own-green is uncheatable. **D5 stays the standing arbiter:** own-green + GOLD-red ⇒
    NEVER deliver (fail-capable, proven token-free with a deliberately-wrong impl).
  - **`src/observer.mjs`** gains `renderRun` — a pure listener (still `node:fs`-only, §7 contract intact) that
    renders the pipe's event vocabulary; unknown event types surfaced verbatim, never silently dropped.
  - **`test/pipeline.test.js` (token-free, all branches):** the three token-spending stages injected as fakes,
    the D5 GOLD arbiter run FOR REAL; every escalation asserted decision-ready; the fit-to-pass tripwire
    (own-green/GOLD-red ⇒ no deliver) exercised. **`test/integration/pipeline.live.test.js` — LIVE e2e (haiku,
    n=1 named):** proceed → close trusted (5/5 mutants) → worker red→green → INDEPENDENT GOLD green on fresh
    values → DELIVER 1/1; the observer rendered the whole timeline from the log alone.

### Added — `src/` build STARTED: step 1, the event-stream spine + observer contract (2026-07-04)
- **First shippable `src/` code (the graduated rewrite begins; `poc/` stays throwaway, §2).** Build-order
  step 1 from `relayfact-prd-v3-graduated.md` §6 — token-free, and it instruments everything after it (same
  reason G4 was built first). **`npm test` → 10/10 green.**
  - **`src/event-log.mjs`** — the event-stream spine (PRD §7): append-only JSONL, every event stamped
    `{ ...payload, type, seq, ts }` with spine fields LAST so a stray payload key can't clobber sequencing
    (a hardening over the POC `emit`); monotonic in-process `seq` (single-process doctrine); injectable
    clock for deterministic tests. Built on **stdlib `node:fs`**, NOT bare-agent's `JsonlTransport` — an
    append-only log is stdlib in <100 lines (AGENT_RULES dependency hierarchy) and decoupling the narration
    substrate from the engine IS the §7 invariant.
  - **`src/observer.mjs`** — the observer CONTRACT: a pure listener that reads only the persisted log and
    tolerates a corrupt trailing line (crashed-run discipline, graduated from `poc/observer.mjs`). The rich
    facet analyzer/renderer graduates in a later step.
  - **`test/` (Testing Trophy, controls that can FAIL)** — spine: monotonic seq, ts/type stamping, the
    payload-can't-clobber control, append-only byte-check, valid-JSONL, closed-log + bad-input rejection;
    observer: round-trip, corrupt-line survival, and the **§7 pure-listener invariant** (imports are
    node-builtin-only) — proven fail-capable by injecting a spine import (went red, then reverted green).

### Added — `src/` step 4: pre-flight + escalation (the come-back), live-verified (2026-07-04)
- **Build-order step 4 from §6 (G3): `{proceed|clarify|decline}` in, a decision-ready `run.escalate` out.**
  `npm test` = 45 pass / 5 live-skip.
  - **`src/escalation.mjs`** — the come-back artifact (graduated probe-17/F38), fully deterministic:
    `buildEscalation` assembles `{goal, blocker(§5 trigger), whatWasTried[], decisionNeeded{question,options},
    receipts, costSpent}` from a `DECISION` map of the five stop-classes. **`isDecisionReady` is the control
    that can FAIL** — rejects a bare `{incomplete}` (the thing G3 replaces), a <2-option report, an
    attempt-bearing stop with empty/gapless `whatWasTried`, and an unknown blocker; accepts a pre-flight
    decline's legitimately-empty attempts. Seven unit controls, each red on a non-actionable return.
  - **`src/preflight.mjs`** — the "does this make sense?" rubric gate (§5: rubric may OPEN HITL, never CLOSE).
    A bounded bareagent `Loop` (system prompt, NO tools — consumed exactly as probe-17 proved; I verified the
    `Loop.run` interface against the source rather than guessing a `provider.chat`). `parsePreflight` is split
    out pure with a **SAFETY property unit-tested token-free: garbage/unknown verdict NEVER yields `proceed`**
    (the only verdict that spends) — it falls back to `clarify` (safe HITL-open).
  - **`test/integration/preflight.live.test.js` — LIVE (haiku), both SAFETY corners held:** a coherent
    request ("reverse a string") → **`proceed`** (never false-blocked); nonsense ("banana telephone louder
    than purple") → **`decline`** (never false-goes). The soft `clarify` middle is reported, not pass-gated.

### Added — `src/` step 3 (core): the gated worker on `recurse()`, live-verified with the grounding control (2026-07-04)
- **Build-order step 3 from §6 — the single-file gated implement loop, closed by a test that can fail.**
  `npm test` = 34 pass / 3 live-skip (token-free by default).
  - **`src/worker.mjs` (`implementAgainstClose`)** — drives a `maxDepth:0` recurse worker whose only mutating
    tool (`edit_file`) is write-scoped by a bareguard `Gate`. The SAME deterministic close is both the global
    top predicate (`opts.evaluate`) and the leaf sensor (`refineLeaf.sensor`); a failed attempt feeds its gap
    forward and retries. The final close is **re-run authoritatively** on the delivered artifact (never trust
    the loop's own report). `deliveryDecision` is a pure helper (unit-tested): delivers ONLY when the final
    close is green AND the run is not incomplete — green-but-incomplete and never-green both escalate.
  - **`test/integration/worker.live.test.js` — LIVE (haiku), both cases passed:**
    - **deliver:** a satisfiable close went **red→green, DELIVERED** through the gate (1 iter, final close green).
    - **🎯 the load-bearing CONTROL:** an **UNSATISFIABLE** close (`double(2)` asserted both `4` and `5`) →
      **`escalated-red`, delivered=false, final close red.** A real worker tried and the deterministic close
      **refused to certify it** — and it could not fake green because the gate write-scopes it to the impl,
      NOT the suite. The close grounds the loop; if this had delivered "green", step 3 would have FAILED.
  - **Deferred WITHIN step 3 (logged, not silently dropped):** multi-file `resolveIn` targeting (probe-16's
    `shell_read` + path resolution for real repos) and the litectx close-driven recall widening (**D3**) —
    both are follow-ons; this cut is the gated single-file implement loop.

### Added — `src/` step 2 (deterministic half): the grounded close + G1 honesty guards (2026-07-04)
- **Build-order step 2 from §6 — the token-free half (the LLM prose→suite arm is held for a warm key).**
  `npm test` → **26/26 green.**
  - **`src/close.mjs`** — the grounded close (§5 doctrine anchor), the ONE primitive relayfact owns. Runs a
    real command (array form, NO shell = no injection surface) and maps exit code → bareagent's `Verdict`
    (consumed, not reinvented): `0 → satisfied` (close GREEN), `nonzero → needs_revision` (RETRYABLE, the
    failure output fed back as `critique`/the gap), `spawn-error|signal|null → failed` (TERMINAL — the close
    couldn't produce a verdict, so refine STOPS and relayfact escalates instead of spinning). `verdictFromExit`
    is split out pure so the retryable/terminal mapping is unit-tested without spawning; proven fail-capable
    by mutation (inverting nonzero→satisfied turned 3 tests red incl. the anti-inversion control).
  - **`src/validity-gate.mjs`** — the G1 honesty machinery (probe-15/F33) in shipped form, pure over an
    injected suite-runner: `validateSuite` (stub-catch + reference-gate "a correct impl MUST pass" +
    mutant-kill ≥4/5 — the two failure modes over-constraint/fit-to-pass each guarded); `countGrounded`
    (the N/M grounded-vs-rubric-residue split, reported not gated); `arbitrate` (the standing GOLD arbiter,
    descope **D5** — own-green + GOLD-green ⇒ deliver, own-green + GOLD-RED ⇒ **fit-to-pass, never delivered**).
  - **`test/close.test.js` + `test/validity-gate.test.js`** — controls that FAIL on a dishonest suite:
    a stub-green suite rejected, an over-constrained suite rejected (the SAFE G1 mode), a weak 3/5-mutant
    suite rejected, and the own-green/GOLD-red fit-to-pass tripwire.
  - **`src/compile-close.mjs`** — the prose→close ORCHESTRATION (G1 request-IN end): author (INJECTED —
    real = a recurse worker, fake = a canned suite) → `validateSuite` → a NAMED verdict
    (`trusted|vacuous|over-constrained|weak-grounding|no-suite`, probe-15's taxonomy). Verified token-free
    with a fake author over REAL on-disk suites (actual `node --test` runs); `test/compile-close.test.js`
    controls: honest→trusted, stub-green→vacuous, over-constrained→caught (SAFE G1 mode), no-suite→never
    trusted.
  - **🔴 Correctness fix caught BY RUNNING (`runClose` env isolation).** Under `node --test`, the parent
    sets `NODE_TEST_CONTEXT`; a spawned `node --test` close INHERITS it, DEFERS reporting to the parent, and
    **exits 0 even when its tests FAIL** — the close would silently map RED → satisfied (a fit-to-pass-class
    hazard against the close's "exit code = truth" contract). Fix: `runClose` strips `NODE_TEST_CONTEXT`
    from the child env. Pinned by a regression test (a failing `node --test` child must report red under a
    test-runner parent) proven fail-capable — removing the strip turns it red. Reading the source would
    never have surfaced this; only running the close under a test-runner parent did.
  - **`src/author.mjs` (`authorSuiteViaRecurse`) — the LLM author, VERIFIED BY A LIVE RUN (step 2 COMPLETE).**
    Drives a `maxDepth:0` recurse worker whose only tool (`write_test`) is write-scoped by a bareguard `Gate`;
    relayfact supplies the persona (senior-engineer, suite-only), the fixed write path (F19/F20), and the
    deterministic leaf `sensor` (suite exists AND a correct impl passes it — the in-loop over-constraint
    guard, not a model judge). Graduated from probe-15. **Live run (haiku, `test/integration/compile-close.live.test.js`,
    self-skips unless `RELAYFACT_LIVE=1`):** a real worker self-authored a suite from prose alone and
    relayfact's gate found it **`trusted`** — stub caught, reference passes, **5/5 mutants killed**, 656-byte
    suite. End-to-end `authorSuiteViaRecurse → compileClose → validateSuite` on a real model reproduces G1's
    shipped shape. `npm test` = 31 pass / 1 skip (the live test), still token-free by default.

### Added — G5: the graduated PRD, and the GRADUATE call (2026-07-04)
- **G5 written (`docs/01-product/relayfact-prd-v3-graduated.md`) — the last §8.2 gate item, a spec-before-
  build artifact, not a code probe.** With G1/G2/G3/G4 all met **on stock library defaults** (bareguard
  0.11.1 · bare-agent 0.25.0 · litectx 0.26.1) with no papering-over, the documented verdict is
  **GRADUATE**: scaffold `src/` as a rewrite (never ship the POC, §2). The doc encodes the G1–G4 numbers,
  makes the goal sentence testable (**G5-EXIT:** prose+repo → pre-flight → grounded close w/ independent
  GOLD arbiter → gated `recurse()` → deliver-green-or-decision-ready-escalation, narrated to the event log,
  **demonstrated on ≥3 real tasks with the grounded/rubric split counted per task**), and draws **7 explicit
  descopes** so the eval table stops overselling — D1 `agentic` tier (IN, first `src/` spike; claim shrunk
  to predicate-tier until run), D2 embeddings (OUT — F26: can't fix correctness-vs-similarity), D3 memory
  widening (IN with a hard store cap — F29 bounded-pool caveat), D4 bare-`refine` terminate (OUT/N/A —
  `refineLeaf` halts clean, F30), D5 fit-to-pass (IN — standing independent-GOLD guard for the
  unobserved-not-impossible mode), D6 depth (OUT — global close covers any depth, F13/F28/F31), D7 scale
  (IN via the ≥3-task cohort). The **archive path stayed live and was not chosen** — the answers are
  positive and the residue is bounded/named, not silenced (that doc's §7). **No `src/` yet; the graduate
  decision is the user's, recorded here as the evidence-backed recommendation.**

### Added — G1 sonnet arm (the previously-unrun production-model arm) (2026-07-03)
- **G1 sonnet arm run (`probe-15`, `RELAYFACT_MODEL=claude-sonnet-5`, F33 update; unblocked by BA-10).** Both
  fixtures **honest + GOLD-correct, `failModes=[]`** — money 4/4 grounded (1 Phase-B iter), csv 4/4 (3 iters).
  The notable delta: on the **same under-specified `csv` prose that haiku over-constrained** (2/5 honest, 3/5
  over-constrained-and-caught), sonnet authored a 4/4-grounded suite and drove its own close to a GOLD-correct
  impl — GOLD uses fresh values the prose never lists, so it got the *convention* right, not memorized values.
  **The under-spec → HITL-residue boundary is model-modulated:** a stronger worker needs less spec completeness
  to stay honest (F20 from the request-IN side). **Fit-to-pass STILL unobserved — now on the capable end too
  (0/2 sonnet + 0/8 haiku = 0/10);** the two seen directions are over-constrain (safe) and clean-pass, neither
  the unsafe own-green/GOLD-red — the honest next G1 probe is a more adversarial/shallow-inviting spec. BA-10
  re-verified through this probe (temperature fallback fired each phase, every leaf ran). Graduation gate:
  G1/G2/G3/G4 met; only **G5** (graduated PRD) remains before the graduate-or-archive call.
- **Adversarial fit-to-pass HUNT (F33 update).** Two fully-specified but shallow-inviting fixtures added to
  `probe-15` to actually bait own-suite-green/GOLD-red (oracle self-checked offline first): `truncate` (a subtle
  "ellipsis counts toward `max`" length invariant) and `titleCase` (an un-exampled "lowercase the rest" clause).
  **Fit-to-pass STILL never fired.** truncate/haiku honest (3/3); **titleCase/haiku over-constrained → escalate
  (SAFE)** — its suite followed convention over a counterintuitive literal spec, and the "a correct impl must
  pass" reference gate fired and caught it; titleCase/sonnet honest (3/3). Sharpened mechanism: a self-authored
  close fails either by over-constraint (reference-gate-guarded — now empirically fired on a fresh case) or
  fit-to-pass (independent-GOLD-guarded — the only guard for the mode the reference gate can't see); every
  observed failure was the SAFE over-constraint, model-modulation confirmed twice. Fit-to-pass is unobserved,
  NOT impossible (two models, small fixtures) — GOLD stays the standing arbiter.

### Added — G3 (the come-back): decision-ready escalation + pre-flight sanity (2026-07-03)
- **G3 POC-run — PASS (`poc/probe-17-comeback.mjs`, F38).** The loop returns a bare `{incomplete}`; G3 is the
  two pieces relayfact OWNS on top (§5.1). **(a) Escalation artifact (token-free):** five §5 stop-classes each
  assemble ONE decision-ready `run.escalate` report `{goal, whatWasTried[], blocker, decisionNeeded{question,
  options}, receipts, costSpent}` — every stop forced by REAL execution (real `refine` history / real bareguard
  `budget.maxCostUsd` halt / real BA-11 deny-spin at 3 / §5 rubric-residue / pre-flight decline at 0 spend).
  **Control-can-fail:** `isDecisionReady` rejects a bare `{incomplete}`, a <2-option report, and an
  attempt-bearing stop with empty `whatWasTried`. **(b) Pre-flight `{proceed|clarify|decline}` (real haiku,
  ~$0.05):** the two safety corners held — a coherent request is NEVER declined (`clarify`, a safe HITL-open),
  nonsense NEVER proceeds (`decline`); the soft middle is model-calibrated + fuzzy ("make it better" → `decline`,
  reported not gated) = the §5 residue from the pre-flight side. **Design note (parallels F32):** `recurse`
  persists only the `refineLeaf` summary, not `refine.history` — relayfact self-captures `(attempt,verdict,gap)`
  via the sensor it owns (`opts.evaluate`), no lib dependency. Graduation gate now: G1/G2/G3/G4 met, G5 open.

### Verified-shipped — BG-3 + BA-11; G2 now stands on stock library defaults (2026-07-03)
- **BG-3 verified-shipped (bareguard 0.11.0, `poc/probe-19-bg3-verify-shipped.mjs`, token-free 5/5,
  control-can-fail).** `serializeForMatch` strips the write payload (`content`/`contents`) before matching, so
  the default `content` guards no longer false-fire on code vocabulary. Verified by RUNNING: payload code-vocab
  incl. literal `DROP TABLE` bytes → **allow/`default`**; `DROP TABLE`/`rm -rf` in a bash `cmd` → **deny**;
  `method:DELETE` → **ask** (proven via the audit's pre-human askHuman line — the strip doesn't blind operation
  fields). **relayfact's disclosed override (`content:{askPatterns:[]}`) REMOVED from probe-16.**
- **BA-11 verified-shipped (bare-agent 0.25.0, `poc/probe-20-ba11-verify-shipped.mjs`, token-free 4/4).** The
  Loop short-circuits a governance deny-spin (`new Loop({ maxConsecutiveDenials })`, default 3) instead of
  burning to the cap. Verified with a STUB provider (no LLM) + deny-all policy = the spin: guard default → stops
  at exactly 3 (`error:'denied:edit_file'`); `=5` → stops at 5 (not hardcoded); **negative control** OFF
  (`Infinity`/`0`) → spins to the stub cap (13 calls) — the ON-vs-OFF contrast proves the guard is load-bearing.
- **G2 re-run WITHOUT the override — both arms green (F36 re-run).** Default content guards ON: **sonnet-5**
  `$0.095`/4 calls (BA-10 temperature-fallback fired + recovered), **haiku** `$0.088`/7 calls; both `g2.PASS`,
  `interventions=0`, close+GOLD green, `fitToPass=false`, `groundedCalls=1`, `maxDepth=0`, baseline RED first.
  The whole pipe now delivers a gold-correct real-repo fix on **stock bareguard/bareagent defaults**.
- **F37 / BG-4 (factual export bug) — filed AND resolved same day (bareguard 0.11.1).** 0.11.0's changelog
  claimed "`PAYLOAD_FIELDS` is a new export," but `import { PAYLOAD_FIELDS } from 'bareguard'` **threw** (exported
  only from `src/primitives/content.js`, not `index.js`; deep import `exports`-blocked). Owner chose **Option A**
  and **declined** relayfact's option-2 config key (zero demand, no adopter hit it, `["content","contents"]` is
  complete for every shipping write tool → a permanent 1.0 config surface for a loose changelog line is the tail
  wagging the dog; the fix for a dead-config *implication* is to stop implying the knob, not build it). Shipped:
  re-export from `index.js` for read-only introspection + **`Object.freeze`** (mutate-the-global fails by
  construction) + reworded docs. **Verified-shipped by RUNNING (4/4):** import reachable, value
  `["content","contents"]`, `Object.isFrozen` true, `.push` throws + unchanged.

### Hardened — memory-loop result corrected under controls (2026-06-30)
- **probe-10 (ranking isolation, F26)** — zero-token, deterministic. Length-matched **wrong** distractors
  (`wrong-rich-legacy`, `wrong-rich-twin`) seeded into probe-09's store. Under the same failure-derived query,
  BM25 ranks both wrong rules **above** the right one (twin 2.808 / legacy 2.128 / right 1.737). **The probe-09
  "#1 ranking" was a document-length artifact — confound CONFIRMED.** Retrieval ranks on similarity, which is
  not correctness, so the embeddings tier cannot fix it either (left unrun, dep not installed).
- **probe-11 (discrimination rate, F27)** — 5 entities (incl. a structurally-distant `auditBadge`), haiku,
  grounded `node --test` close. **blind 0/5** (control holds — not guessable); **recall3 0/5** (right note
  ranks #3 → starved out of top-k → worker copies a wrong rule); **recall4 4/5** (right note threaded with the
  wrong ones → the **worker discriminates** and converges). Distant transfer fails even in recall4 (reuse copies
  the lesson's output shape). **Durable claim:** *recall proposes, executable verification disposes.*

### Added — graduation push: memory fixed, F11, depth corrected, cost-control verified (2026-07-01)
- **Memory loop FIXED + validated (probe-13, F29)** — naive rank-trusting top-3 **0/5** → fixed **5/5**. Fix:
  close-driven recall widening (widen the candidate window on each failed close) + "unverified candidates,
  the test decides" framing + a **rule-framed lesson**. Corrected F27's `auditBadge` "structure-transfer"
  failure — it was my fixture underspecifying (the output shape was only in the hidden test); made fair, the
  fixed loop passes it too.
- **F11 tested (probe-14, F30)** — under the bare `refine` primitive, `{decision:'terminate'}` **sticks**
  (`gate.terminated`, a clean stop-signal) but does **not self-stop** the spend (4 calls, same as `deny`) —
  the caller still needs probe-02's latch. **But relayfact's actual loop is `refineLeaf`, which halts cleanly
  after exactly 1 over-cap call** (verified by running) — so cost-control is sound; no latch needed there.
- **Depth CORRECTED (probe-12, F31)** — F28's "haiku won't nest" was a probe misconfig (`opts.count` forces
  flat Family-B workers). With Family A: haiku splits shallow (d1), sonnet solves at the root (d0); depth is
  task-tractability + model-choice bounded, and `assessComplexity` is a keyword heuristic (not model-driven).
  "Depth-2 reach" is ill-posed — the global close covers the whole artifact regardless of tree depth. Doctrine
  held in every config.
- **BG-1 verified-shipped by running** — bareguard 0.10.1 masks secrets in the audit by field
  (`[REDACTED:key=apiKey]`) and value pattern (`[REDACTED:pattern=sk-a...]`), incl. `_ctx.provider.apiKey`.

### Added — Spike 3: boundary-mapping at depth (2026-07-01)
- **probe-12 (Spike 3, F28)** — a 6-function/2-module toolkit under one global suite, `maxDepth:2`,
  `synthesize:'concat'`, gated. Both arms **held the doctrine at organic decomposition**: relayfact's
  executable close ran **exactly once** (top only, confirming F13 from receipts), **grounded coverage = the
  root only (1/3)**, and the **global top predicate caught a fault owned by an ungrounded child** (RED
  `pass=false`) while the control converged (GREEN). **Honest limit:** the tree never nested past depth 1 —
  haiku, given inline specs, does each module's work in-worker rather than re-decompose (`opts.count` forces
  width only at its own node). **Depth is model-bounded, not mechanism-bounded** (mirror of F18);
  **depth-2 reach is UNPROVEN with this model.** All three v2 spikes are now run — next is graduate-or-archive.

### Added — v2 spikes executed + upstream verified-shipped (2026-06-29 → 06-30)
- **Replay-through-recurse (probe-03)** — ran the probe-02 tasks through shipped `recurse()` at `maxDepth:1`:
  green→green, and a budget cap halts **cleaner** than refine because recurse is single-pass (**F17**; F11
  doesn't reproduce here). Verify-shipped-vs-POC, not fresh validation.
- **Spike 1 — grounding seam across decomposition (probe-04)** — a 3-slice fixture (one slice unsatisfiable
  by construction; `multi-ok` control) through forced flat fan-out, `synthesize:'concat'` (no LLM merge). The
  **global top predicate caught the ungrounded slice** (top `pass:false`, never faked green) while children
  were `verdict=null`; the control converged GREEN only when all slices were genuinely correct (failed RED 6×
  first — proof it can fail). **Doctrine validated.** Surfaced **F18** (over-decomposition at depth → `maxDepth:1`),
  **F19** (decomposition strips path context), **F20** (small-model self-healing ceiling — the *worker* is the
  limit, the grounded close held through all 6 failures).
- **Upstream verified-shipped:** **BA-1/F16** (the API-key-in-audit security leak) fixed + verified in
  bareagent **v0.22.0** (`auditSafeCtx` strips the provider; audit grepped clean); **BG-1** key-aware audit
  redaction in bareguard **v0.10.0**. **BA-8 `refineLeaf` + BA-9 `context`** shipped in **v0.23.0** and
  **verified-shipped (probe-05, F21)** — recover arm `iterations=2,passed=true,temps=[0.2,0.7]` with a
  critique-only token proving gap-feedback; never arm `passed=false` (honest non-recovery); BA-9 context arm
  reads the abs path, no-context control denied (reproduces F19). All blocking asks now 🟢 (UPSTREAM-FIXES.md).
- **Spike 2 — memory-as-self-improvement (probe-06/07/08, then the honest redo probe-09).** Wires relayfact's
  deterministic sensor into the verified `refineLeaf` seam; on failure the gap is enriched with an error-keyed
  litectx `recall` (bareagent stays litectx-agnostic — the handle is the caller's via `opts.tools`).
  - **⚠️ probe-06/07/08 (F22–F24) were FIT TO PASS — results RETRACTED.** The recalled "lesson" literally
    contained the answer string (ON tested copy-paste); run 1 was HANDED the value via `context` (not
    learning); "transfer" was a renamed sibling needing the same constant; distractors were far (`nHits=2`).
    They stand ONLY as: the recall→thread→retry **wiring works** and memory-presence changes the outcome. One
    durable takeaway survives: **store lessons as `kind:'fact'`** (a fact ranks; an `episode` scored 0). See
    the `no-fit-to-pass-tests` memory.
  - **Honest result (probe-09, F25).** Every rig removed: the lesson is a transferable RULE that does NOT
    contain run-2's answer; run 1 (`userId`) DISCOVERS it by reading a scoped runbook; run 2 (`orderId`, a
    different entity) must RE-APPLY it (new prefix + check letter); a near, WRONG distractor is threaded
    alongside the right rule; the query is derived from the failure. **Measured (haiku, n=4): blind 0/4,
    recall 4/4** — the current rule ranked #1 over the threaded legacy rule each time; the model adapted it.
    A **real but scoped** win. **Not closed:** one fixture/model, n=4; lexical BM25 length/TF confound
    (the right lesson is a richer doc than the terse distractor); same-domain transfer; "learning" =
    remember-what-worked. To harden: equally-rich wrong distractor; multiple fixtures/models for a rate;
    distant transfer; embeddings on.
- **Findings F12–F23** logged; PRD (§0/§5/§5.1/§8/§8.1/§10) + CLAUDE.md reconciled to shipped `recurse()`;
  UPSTREAM-FIXES.md tracks BA-1…BA-9 + BG-1 to 🟢.

### Changed — v2 UNBLOCKED: reconciled against shipped `recurse()` (bareagent v0.21.1, 2026-06-29)
- `recurse()` **delivered** and the provisional v2 shape **reconciled** against the shipped API with no
  blocking mismatch. PRD status/§0/§5/§5.1/§8/§8.1/§10 updated from *blocked/provisional* to
  *unblocked/reconciled*.
- **Reconciliation outcomes:** (a) the load-bearing seam holds — `opts.evaluate` is honored over recurse's
  default rubric Evaluator and runs on the *synthesized* result (`recurse.js:870`); (b) delegated children
  **strip** `contract`/`evaluate`, so the grounded close is **top-node-only** (documented behavior, F13);
  (c) the senior-dev persona is injectable via **`opts.persona`** (shipped v0.21.0; F12); (d) caps remain
  bareguard's, fully wired via `ctx.policy` + `ctx.onLlmResult` (F14 — `onToolResult` N/A here).
- **Ownership amended (§5.1):** recurse **builds** the worker Loop; relayfact owns **persona + tools +
  close + synthesize + observer**, not the Loop construction.
- **Spike plan firmed (§8.1):** replay-through-recurse first (`maxDepth:1`), then three gated spikes
  (grounding-seam across nodes incl. synthesis; fan-out-with-handles vs flat; boundary-mapping at depth);
  every spike runs under a bareguard `Gate` (the "cost open by design" ⚠️ is proven real).
- **Findings F12–F14** logged (`FINDINGS.md`): persona seam shipped upstream; children-strip is
  works-as-intended + documented; `onToolResult` N/A.
- CLAUDE.md loop one-liner + phased scope updated to match.

### Changed — v2 re-planned around `recurse()` (2026-06-26)
- PRD §0 added: **bareagent's `recurse()` is now relayfact's v2 driving engine**, consumed not built —
  it subsumes the hand-wired `Planner`+`runPlan` outer loop and adds verify + synthesize + bounded
  recursion. relayfact owns the **`opts.evaluate`** executable close (the doctrine anchor), the worker
  persona, and the tree observer; recurse owns decomposition/fan-out/synthesis/guards/receipts.
- PRD §3/§4 (architecture + loop) recast around `recurse()`; §5 adds the load-bearing `opts.evaluate`
  seam + per-node boundary mapping; §5.1 adds an RLM-PRD-style consume-vs-own ownership map; §8 v2
  replanned and **BLOCKED on `recurse()` delivery** (pre-POC); §10 adds the delivery dependency +
  the "does grounding survive synthesis?" risk. v2 shape is **provisional**, reconciles on delivery.
- **POC-rerun decision (PRD §8.1):** existing probes do **not** re-run — they validate the worker +
  grounded close = recurse's depth-0 base case. Added: one cheap *replay-through-recurse* reconciliation
  on delivery, plus **new** spikes for the decomposition layer (grounding-seam across nodes incl.
  synthesis; fan-out-with-handles vs flat; boundary-mapping at depth). No existing POC invalidated.
- CLAUDE.md loop one-liner + phased scope updated to match.
- relayfact build **pauses until `recurse()` is delivered** (user decision, 2026-06-26).

### Added — POC: inner loop (probe-01)
- `poc/probe-01-inner-loop.mjs` — the verify half, no LLM: bareagent `refine` + `Evaluator` predicate
  + `JsonlTransport` event spine. Modes `fake` (→ `loop.done`, exit 0) and `noop`
  (→ `loop.escalated`, exit 1) prove the harness closes on green **and fails honestly**.
- `poc/fixtures/sum/` — trivial red fixture; exit code is the predicate truth.

### Added — POC: real gated attempt + memory (probe-02)
- `poc/probe-02-real-attempt.mjs` — swaps the fake `attempt` for a real bareagent `Loop` (senior-dev
  persona) editing files through a bareguard `Gate`, with litectx mounted as the store via
  `liteCtxAsStore`. Fixtures `sum` / `csv` / `stuck`; `RELAYFACT_MAX_COST_USD` knob for the cost-cap halt.
- `poc/probe-02-gate-check.mjs` — gate-enforcement negative controls (no tokens): out-of-scope
  read/write (incl. the sibling test file), destructive-pattern floor, allowlist, and shell-meta denial.
- `poc/fixtures/csv/` — a fiddly single-line CSV parser (real difficulty).
- `poc/fixtures/stuck/` — **unsatisfiable by construction**; the real-attempt analog of probe-01's
  `noop`, proving honest escalation with a model genuinely working the problem.
- `edit_file` — the one tool relayfact supplies (gated `action.type:'write'`), pending upstream (F6/F8).

### Validated (v1 exit criteria, PRD §8 — in throwaway POC code)
- **(a)** closes a genuinely-failing real task autonomously (`sum`, `csv`: red→green).
- **(b)** fails honestly with a real attempt (`stuck` → `loop.escalated`, exit 1; no faked green).
- **(c)** bareguard caps cost and **halts cleanly** (`maxCostUsd=0.0001` → `loop.halted` at iter 1);
  enforcement proven across fs/bash axes by `probe-02-gate-check`.
- **(d)** litectx mounted as the store; a ranked recall consumed (relevant fact ranked over distractors).
- **(e)** grounded findings recorded — see below.

### Findings (against the three libs)
- **F1–F5** — libs are mature (assumed gaps refuted); Evaluator/refine mapping; F5 (API key) resolved
  via `pass amr/claude_api`, injected at runtime, never in the tree.
- **F6** — bareagent ships no file-write tool a coding agent needs.
- **F7** — `wireGate`'s default translator doesn't activate the bash/fs primitives; the shipped example's
  `bash.allow`/`fs.readScope` are dead as written. relayfact passes a custom `actionTranslator`.
- **F8** — gating edits *through the shell* is impractical (redirection is a metachar that force-denies);
  the real fix is a write tool emitting `action.type:'write'`.
- **F9** — bareguard enforcement is layered and correct (works-as-intended).
- **F10** — litectx 0.21 `LiteCtx` requires `{ root }`; the bareagent example is stale (`{ dbPath }`).
- **F11** — a bareguard halt via `humanChannel`-deny does not stop the loop; the adopter must latch it.

### Notes / honest residue
- Only `claude-haiku-4-5` exercised; `csv` solved in 1 iter — honest difficulty for honest-fail rests on
  the `stuck` control, not organic difficulty.
- F11's cleaner fix (`{decision:'terminate'}`) is logged but unverified (rate-limited before confirming).
- No Planner/`runPlan`, no web — those are v2.

## [Phase 0] — context & spec
### Added
- PRD locked (`docs/01-product/relayfact-prd.md`), `CLAUDE.md` doctrine, `benches-prd.md` (carried from
  litectx), `FINDINGS.md` discipline.
