# Changelog

All notable changes to relayfact are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); relayfact is pre-release (`0.0.0`) and
versioning starts at its first graduated build. Until then, entries are grouped by phase
(`POC → design → build`, per AGENT_RULES). Library friction is logged separately in
[`docs/00-context/FINDINGS.md`](./docs/00-context/FINDINGS.md) (F-numbers referenced below).

## [Unreleased]

Phase: **v2 spikes complete + graduation gate (§8.2 G1–G5) IN PROGRESS — G1/G2/G3/G4 met, G5 open.** v1 POC
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
