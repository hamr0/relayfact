# relayfact — PRD

**Status:** v1 locked + POC-validated (2026-06-25). **v2 re-planned around `bareagent`'s `recurse()` as
the driving engine (2026-06-26); `recurse()` DELIVERED (v0.21.1) and RECONCILED against the shipped API
(2026-06-29).** **v2 spike plan now MID-FLIGHT (2026-06-30):** replay-through-recurse ✅ + Spike 1
(grounding seam) ✅ done; the F16 security blocker (BA-1) shipped + verified in v0.22.0; the two seams the
memory-loop needs — **BA-8 `refineLeaf` + BA-9 `context`** — shipped in **v0.23.0 and verified-shipped
(F21, `poc/probe-05`)**. **Memory-loop (§8.1 spike 2): wiring proven; first results RETRACTED, honest redo
done.** probe-06/07/08 (F22–F24) were **FIT TO PASS** — withdrawn to "the recall→thread→retry wiring works"
(see the `no-fit-to-pass-tests` memory). The honest redo **probe-09/F25** — lesson is a transferable rule the
agent does NOT already have the answer to, discovered in run 1, re-applied to a different entity in run 2,
with a misleading near-distractor threaded — first read **haiku n=4: blind 0/4, recall 4/4**. **That win was
then HARDENED (probe-10/11, F26–F27) and it largely did NOT survive:** with an **equally-rich** wrong
distractor, lexical BM25 ranks two *wrong* rules **above** the right one (F26 — the length confound is
confirmed, not killed; and no embeddings tier can fix it since retrieval ranks on similarity, not
correctness). Decomposed across 5 entities (F27): naive top-3 recall **starves** the worker (right note
falls out of top-k) → **0/5**; thread top-4 so the right note is present and the **worker discriminates** it
from the wrong ones → **4/5**. **Then FIXED + validated (probe-13, F29): naive 0/5 → fixed 5/5.** The fix is
the thesis operationalized — the grounded close *drives* recall (widen the candidate window on each failed
attempt; frame notes as "unverified candidates, the test decides") + a **rule-framed lesson**; the worker
then discriminates the right rule from the higher-ranked wrong ones. (The F27 `auditBadge` "structure
transfer" failure was **my fixture underspecifying** — the output shape lived only in the hidden test; made
fair, the fixed loop passes it too.) **Net:** the memory loop's value lives in the **worker + grounded
close**, and the fix makes recall *reliably surface* the right note to them rather than trusting rank —
*recall proposes, executable verification disposes*. **Spike 3 (boundary at depth) DONE + CORRECTED (probe-12,
F28/F31):** the grounding seam holds — grounded coverage = the ROOT only (1/3), the global top predicate
catches a fault owned by an ungrounded child. F28's "haiku won't nest" was a probe misconfig (`opts.count`
forces flat workers); with Family A the depth is task-tractability + model-choice bounded (haiku splits
shallow, sonnet solves at the root) — and "depth-2 reach" is **ill-posed**: the global close covers the whole
artifact regardless of tree depth. **All three v2 spikes are run; the memory blocker is fixed, cost-control is
verified (F30), and the eval-grounding boundary is mapped.** **Graduation is now gated on §8.2 (added
2026-07-02):** the validated evidence covers the loop's *middle* (worker + close + decomposition + memory +
caps); the two ends of the stated goal — taking a prose request IN (who authors the close? G1) and coming
back to a human (escalation artifact, G3) — plus one real-task e2e (G2) remain unproven. **G4
(observer-as-artifact) is POC-validated (2026-07-02, `poc/observer.mjs` + `probe-18`, F32) — built first,
token-free, the microscope for the rest.** G1/G2/G3/G5 open. No shippable `src/` yet — still POC. The single PRD that guides development; within this doc a bare `§N`
refers to a section here. The validation companion is `benches-prd.md`.

**relayfact** is an experiment: an autonomous "senior dev" runner **assembled** from the bare suite —
`bareagent` (the loop), `litectx` (the memory substrate), `bareguard` (the leash). It builds **no
primitives**. It relays a request through those libraries, grounds the loop on **executable
verification** (things that can *fail*), and **narrates itself** as an event stream. It either
**graduates** into its own thing or gets **archived** as an experiment. That bar is the point.

---

## 0. The decision that shapes this PRD (read first)

**`recurse()` is relayfact's v2 driving engine — consumed, not built.** bareagent's RLM PRD
(`bareagent/docs/01-product/RLM_PRD.md`) introduces `recurse(task, ctx, opts)`: one primitive that
**decomposes → fans out over fresh-context workers → verifies against a setpoint → synthesizes**, with a
single depth knob (`maxDepth=1` ⇒ flat fan-out; `>1` ⇒ bounded recursion). That is exactly — and more
than — what relayfact's v2 outer loop was going to hand-wire from `Planner`+`runPlan`. So v2 **adopts
`recurse()` as the outer loop** instead of rebuilding it. That is the whole point: relayfact builds no
primitives (§2), and being `recurse()`'s **first real consumer** is the primary goal (§1).

**Division of labor, fixed:**
- **recurse() owns** the decompose / fan-out / synthesize / bounded-recursion control flow, worker
  isolation (copy-on-return), the guards (via bareguard), and whole-tree receipts (RLM-PRD RC-10).
- **relayfact owns** the one thing recurse leaves to the caller and that relayfact exists to get right:
  the **`opts.evaluate` slot** — its executable-verification close (predicate/agentic; rubric advisory
  only, §5). recurse provides the machinery; relayfact provides the *definition of done*. Plus the
  senior-dev worker persona (§6) and the observer over recurse's tree receipts (§7).

**Two consequences this PRD is built on:**
1. **`recurse()` has DELIVERED (bareagent v0.21.1) — the build is unblocked and the shape is reconciled.**
   v1 (the single-task worker + grounded close) was always recurse-independent and is POC-validated (§8).
   The v2 shape was provisional pending delivery; on delivery it was reconciled against the shipped API
   (verify-shipped-vs-spec doctrine). Reconciliation outcome (details §5.1/§8.1): **(a)** the load-bearing
   seam holds — `opts.evaluate` is honored over recurse's default rubric Evaluator and runs on the
   *synthesized* result (`recurse.js:870`); **(b)** delegated children **strip** `contract`/`evaluate`, so
   the grounded close runs **once at the top node**, not per intermediate node (documented bareagent
   behavior, not a defect); **(c)** the senior-dev persona is injectable via `opts.persona` (shipped
   v0.21.0 — augments, never replaces, the decomposition policy; carries down the tree; **not** applied to
   the isolated verifier); **(d)** caps remain bareguard's, fully wired into workers via `ctx.policy` +
   `ctx.onLlmResult` (`recurse.js:357-358`). No blocking mismatch found.
2. **The experiment gets richer, not different.** Mapping the grounding/HITL boundary (§1) now runs **per
   node across a recursion tree**, with recurse's RC-10 receipts as the ledger — boundary-mapping,
   tree-structured, still "counted, not vibes."

---

## 1. Purpose & goals

**Primary — learn + validate.**
1. Understand how context engineering actually works by building a loop that uses it end-to-end.
2. Be the first real consumer of `bareagent` + `litectx` + `bareguard` and answer, with evidence:
   are their primitives **useful, complete, and proper**? Every gap is a finding (§9), never a workaround.

**Secondary — probe a research question.** Can an agent build/repair its own framework — Manus-style
autonomy, self-healing loops? Framed falsifiably, the answer hinges on one thing:

> **An autonomous loop can self-heal exactly to the degree its acceptance criteria compile to
> *grounded* evals (a `predicate` or `agentic` check that can fail). Where criteria bottom out in
> `rubric`-only judgment, the loop cannot safely self-certify — that is the HITL boundary and the
> honest ceiling on the self-bootstrapping dream.**

relayfact's real experiment is **mapping where that boundary falls** on real tasks. "It felt autonomous"
is not a result; "N of M acceptance criteria grounded to executable checks; the rest needed a human" is.

This PRD obeys `.claude/memory/AGENT_RULES.md` (Spec→Verify→Environment, POC-first, prove-don't-assert,
dependency hierarchy, surgical changes, security invariants). Where this doc disagrees with AGENT_RULES,
**AGENT_RULES wins**.

---

## 2. Non-goals / Don'ts

- **Build no primitives.** The loop, planner, evaluator, memory, gate, transports all exist in the libs.
  If relayfact needs a primitive, that is a finding against the lib (§9), not a thing to grow here.
- **Never close the loop on LLM self-judgment.** R-S8 + the GAN-eval result are settled: there is no
  usable per-query confidence threshold. `rubric` is advisory only and is safe solely via bareagent's
  adversarial *isolation*; it is never the sole stop condition.
- **No agenticSeek-shaped breadth.** No query router across many specialist agents, no Docker/Redis/
  SearxNG infra. One domain (senior dev), single process, single-file storage.
- **No web UI before the loop closes** (§7). The event stream is the deliverable; UIs are listeners.
- **Don't leak responsibility back into the libs.** relayfact owns glue, grounding-wiring, observability,
  and the verify-command compilation — nothing that belongs in a primitive.
- **Don't ship the POC.** `poc/` is throwaway; graduating it means a rewrite (AGENT_RULES).

---

## 3. Architecture & shape

A thin **consumer** over the bare suite. One-way dependency: relayfact → {bareagent (incl. `recurse()`),
litectx, bareguard}. ESM consumes CJS bareagent via `createRequire` (proven in bareagent's `.mjs` examples).

```
request ─▶ recurse(request, ctx, { contract, evaluate, synthesize, maxDepth })   outer engine (v2, consumed §0)
             │  decompose   Family A (model-driven, default) · Family B forced fan-out (opt-in, known-parallel)
             │  fan-out     fresh-context workers over litectx handles  ◀ each worker = relayfact's senior-dev Loop
             │  verify      opts.evaluate  ◀ relayfact's EXECUTABLE close (predicate/agentic; rubric advisory) §5
             │  synthesize  one result
             └  recurse a node only on measurable slice-overflow (≤ maxDepth ≤ bareguard limits)
         ─▶ { result, verdict, receipts }  |  { incomplete, best, receipts }   (honest non-convergence)
                                      │
                           every node emits ──▶ event stream ──▶ {CLI renderer, web dual-pane observer}

depth-0 base case (= v1, recurse-independent):  refine(attempt = senior-dev Loop, evaluate = exec verify)
```

- **Event-stream spine.** The engine emits a sequenced, append-only event log (`JsonlTransport`). Every
  UI is a pure listener. "A loop that narrates itself," not "a web app with an agent in it."
- **Storage / memory.** litectx mounts as bareagent's `Store` via `liteCtxAsStore` (one-line swap),
  giving ranked, graph-aware recall + `assemble` to fit context + `scoped` per-worker isolation; recurse
  hands each worker these as fetch-on-demand **handles** (never the whole corpus).
- **Observability.** recurse's whole-tree receipts (RC-10: spawn lineage, per-node gap report, cost/node)
  plus litectx `contextgraph` (`observe(ctx)`) feed the observer pane (§7) — now a recursion-tree microscope.

---

## 4. The loop

**Inner loop / worker (v1) — `bareagent.refine`, and recurse's depth-0 base case.** `refine({ attempt,
evaluate, contract, maxIterations })` drives generate → evaluate → regenerate until `satisfied`, terminal
`failed`, or the iteration cap. relayfact supplies:
- `attempt({ iteration, lastResult, critique })` → a bareagent `Loop` (shell/edit tools, senior-dev
  persona §6, bounded by a bareguard `Gate`) makes a change.
- `evaluate(result)` → runs the step's verify command and returns a `Verdict` (§5).

`refine` retries on `needs_revision` (feeding `critique`/`contract` forward) and stops on `satisfied` or
terminal `failed`; exhausting `maxIterations` = **escalate** (§5 HITL). This single-task loop is recurse's
**depth-0 base case unchanged** — at depth 0, relayfact *is* v1, with no recurse dependency.

**Outer engine (v2) — `bareagent.recurse` (consumed, §0). BLOCKED on delivery.** `recurse(request, ctx,
{ contract, evaluate, synthesize, maxDepth })` decomposes the request, fans workers out over fresh-context
litectx handles, verifies each node against the contract, and synthesizes one result — recursing a node
only on measurable overflow, bounded by `maxDepth` and bareguard. relayfact does **not** hand-wire
`Planner`/`runPlan`; recurse composes them internally. relayfact's contribution is three plug-ins: the
**worker** (its senior-dev Loop, above), the **`opts.evaluate`** close (its executable verification — the
doctrine anchor, §5), and optionally `opts.synthesize`. Family B forced fan-out (`opts.mode:'fanout'`)
covers known-parallel work ("these five files"); Family A (default) lets the model decompose under budget.

**Recitation (anti-drift).** The contract + the gap-report-so-far are re-injected each turn — recurse
feeds the Evaluator's gap report forward (not the full transcript) via litectx `assemble`, so the Manus
lesson is native to the engine rather than relayfact's to bolt on.

---

## 5. Eval & grounding model — the crux

The PRD-as-contract supplies "definition of done." relayfact **compiles** each acceptance criterion into
exactly one bareagent `Evaluator` criteria, **ranked by groundedness**:

| Eval | What it is | Grounded? | Role |
|------|-----------|-----------|------|
| `predicate` | deterministic check, no tokens (run tests → exit code, typecheck, build, lint, file exists) | **Yes** — can fail | **Primary close condition** |
| `agentic` | a tool-running critic that *exercises* the artifact (barebrowse/baremobile: open it, click, read output) | **Yes** — grounded by running | Close condition where no static check exists |
| `rubric` | an LLM scores prose criteria, in an *isolated* adversarial context | **No** — LLM judgment (R-S8 trap) | **Advisory signal only**, never the sole close |

Rule: **compile to `predicate` wherever an executable check exists; to `agentic` where the thing must be
exercised; to `rubric` only for the irreducibly subjective residue** ("readable", "matches the PRD's
intent"). A criterion that can only be judged by `rubric` and is uncertain is exactly where **HITL** fires.

**HITL trigger model** — ask only when:
1. PRD ambiguity that materially changes scope (batch up front, at plan time).
2. A decision with no safe default AND hard to reverse (auth model, persistence schema, destructive op).
3. All grounded evals pass but a `rubric`-only criterion is uncertain (intent ungroundable by tools).
4. A bareguard budget/trust trip-wire fires.

A **mechanical** AGENT_RULES violation (disallowed dep, broke ESM, out-of-scope file) is caught by a
`predicate` (lint/check) — no model judgment. A **semantic** drift ("violates the spirit") is `rubric`
territory; mitigated (not eliminated) by recitation + cheap checkpoints. We do **not** oversell "it asks
when it's wrong" — it asks when it's *stuck* or a *grounded check fails*; wrong-but-confident in the
rubric residue is the honest residual, and benches-prd measures how large that residue is.

**The recurse integration — the load-bearing seam (§0). CONFIRMED against shipped v0.21.1.** recurse's
verify slot (`opts.evaluate`) defaults to bareagent's `Evaluator`, which is *rubric-capable*. relayfact
**overrides it** with the executable close above — predicate/agentic first, rubric advisory only — or it
forfeits its own thesis. Verified in source: `verify()` honors a supplied `opts.evaluate` over the default
rubric (`recurse.js:870`), and runs it on the **synthesized** result, so the close survives the reduce
step. This is the single non-negotiable integration constraint: recurse owns decomposition; relayfact owns
"done." It aligns cleanly (recurse's own RC-8 is a deterministic-first ladder, predicate before rubric),
so the doctrine is the *same* at two scales.

**Reconciled nuance — the close runs at the TOP node, not per intermediate node.** Delegated children run
a fresh `recurse` that **strips** the parent's `contract`/`evaluate` (documented bareagent behavior:
"set `contract`/`evaluate` once at the top; they do not — and should not — re-run per intermediate node").
So relayfact's executable close grades the **synthesized top result**, not each slice. This is sound when
the top setpoint is a **global predicate** (the whole verify command / full test suite): a child that
faked its slice is caught at the top because the global check still fails. The standing question (§8.1
spike 1) is exactly whether a global top-level predicate suffices when intermediate nodes are *not*
individually grounded — and the synthesis close must itself be predicate/code-reduce, **never `'merge'`
(LLM)-only**, or a rubric-only reduce re-introduces the very LLM-self-judgment close §2 forbids. The
grounding/HITL boundary is therefore measured at the **top + synthesis** (grounded) and read from RC-10
receipts at intermediate nodes (where child verdicts are recurse's rubric-or-null default).

### 5.1 Ownership map — what relayfact consumes vs owns (recurse era)

RLM-PRD style: every capability maps to an owner; relayfact's net-new surface is minimized to the
grounding seam, the persona, the PRD→evals/verify-command compilation, and the observer.

| Capability | Owner | Source |
|---|---|---|
| Decompose → fan-out → synthesize → bounded recursion | **consume** | bareagent `recurse()` (RLM-PRD NB-1…NB-5) |
| Worker isolation (copy-on-return, fresh window) | **consume** | recurse / `spawn` |
| Termination guards (depth/budget/wall-clock/calls) | **consume** | bareguard via `wireGate` |
| Whole-tree receipts / parent→child lineage | **consume** | recurse RC-10 (Stream/JsonlTransport/metrics + audit) |
| Context-as-handle (`recall`/`get`/`assemble`/`scoped`) | **consume** | litectx |
| Worker **Loop construction** (fresh-window worker build) | **consume** | recurse builds the worker Loop internally (`recurse.js:354`) — relayfact no longer hand-wires it |
| **The close: `opts.evaluate` = executable verification** | **relayfact** | predicate/agentic compiler (§5) — *the doctrine anchor*; applied at the top/synthesis node (§5 nuance) |
| Senior-dev worker **persona** | **relayfact** | `opts.persona` string (shipped v0.21.0); augments the decomposition policy, carries down the tree — relayfact owns the *stance*, recurse owns the *Loop* |
| `opts.tools` (the worker's `edit_file` handle) | **relayfact** | throwaway write tool (F6/F8) passed as `opts.tools` |
| PRD-criteria → evals compilation; verify-command mapping | **relayfact** | glue (§5) |
| `opts.contract` (definition-of-done) | **relayfact** | PRD-as-contract (optionally recurse's `rlm.md` front-door, NB-6) |
| Observer over the recursion tree | **relayfact** | event listeners (§7) over RC-10 receipts |

**Reconciled (v0.21.1):** the v1-era phrase "relayfact owns the worker (its senior-dev Loop)" is now
split — recurse **builds** the worker Loop; relayfact supplies its **persona + tools + close + synthesize**.
If relayfact ever wants to *build* anything in a "consume" row, that is a finding against `recurse()`
(§9), not code to grow here — the §2 rule, unchanged.

---

## 6. Persona

The `attempt` Loop runs under a **senior-dev system prompt**: reads before writing, makes the smallest
change that satisfies the contract, respects AGENT_RULES (dependency hierarchy, surgical changes), and
prefers proving over asserting. The persona is **partly important** — it shapes behavior but is not the
moat; the grounded evals (§5) are what actually keep the loop honest. Persona lives in the system prompt,
versioned in-repo; it is not a primitive.

---

## 7. Observability

Two listeners over one event stream. **CLI first; web only after the inner loop closes** (§2).

- **CLI renderer (v1).** Reads the JSONL event log, one colored line per event. Persisted + diffable —
  the same artifact is the live microscope *and* the A/B evidence log (diff a grep-run vs a recall-run).
- **Web dual-pane (v2+, lightweight).** Left = conversation (the few HITL touchpoints). Right = the
  observer: live event stream with the plan/todo pinned (recitation visible), surfacing what `recall`
  returned, what `assemble` dropped to fit budget, which episode fired — a context-engineering
  microscope, fed by litectx `contextgraph`. **Responsive/mobile by default** the moment it graduates
  past POC (AGENT_RULES hard requirement).

The engine never imports a UI. Adding a listener never changes control flow.

---

## 8. Phased scope & milestones

**v1 — the inner loop on one task.** No Planner, no router, no web. `refine` + `attempt` (real Loop +
gate) + `evaluate` (predicate) on one real task with a real verify command, narrated to the CLI.
- *Exit criteria (gate v2):* (a) closes a genuinely-failing real task to green autonomously; (b) **fails
  honestly** — an unsolvable task escalates rather than faking success (already shown with a fake `attempt`
  in `poc/`); (c) bareguard caps cost and halts cleanly; (d) litectx mounted as the store with at least
  one recall actually consumed; (e) ≥1 grounded finding recorded against the libs (or an explicit "none").

**v2 — full request → e2e, on `recurse()`. UNBLOCKED — recurse() delivered (v0.21.1, §0); all blocking
upstream asks now shipped + verified through v0.23.0.**
relayfact calls `recurse(task, ctx, opts)` as the outer engine — no hand-wired `Planner`/`runPlan`. The
shipped seams relayfact plugs into: **`opts.evaluate`** (the executable close, §5, the doctrine anchor),
**`opts.persona`** (the senior-dev stance, v0.21.0), **`opts.tools`** (the `edit_file` handle),
**`opts.context`** (BA-9, v0.23.0 — read-only working-context/paths threaded to every worker; replaces the
persona-laundering workaround, F19/F21), **`opts.refineLeaf`** (BA-8, v0.23.0 — a leaf becomes a bounded
sense→regenerate loop with a deterministic sensor + escalating temperature; the seam the memory-loop plugs
into, F21), optional `opts.synthesize`, `opts.contract` (PRD→contract), with
`ctx = { provider, policy, onLlmResult }` (the bareguard leash) — and the **tree observer** (§7) over RC-10
receipts. Family B forced fan-out for
known-parallel work; Family A by default. Measured against benches-prd floors, per-node across the tree.
- *Reconciled (2026-06-29):* the provisional shape held against the shipped API with no blocking mismatch
  (§0 consequence 1; §5.1). Net surface relayfact owns shrank to persona + tools + close + synthesize +
  observer; recurse owns the worker Loop. Findings logged, none stop us.
- *Spike sequence below (§8.1)* is the de-risking path before graduating to `src/` (Testing Trophy).

Each phase works end-to-end before the next starts (walking skeleton + vertical slices, AGENT_RULES).

### 8.1 Do the existing POCs re-run after adopting recurse? (mostly no — new spikes, not re-runs)

The recurse adoption is **additive at the outer level and leaves the worker contract untouched**, so the
existing probes stay valid; what's needed is a thin reconciliation plus new spikes for the layer recurse
introduces — never a wholesale re-POC.

- **probe-01 / probe-02 / probe-02-gate-check — NOT re-run.** They validate the *worker + grounded close +
  gate*, which is exactly recurse's **depth-0 base case** and its `opts.evaluate` plug-in. recurse wraps
  decomposition *around* this contract; it does not change it. These remain the v1 evidence as-is.
- **One cheap reconciliation pass, on delivery — *replay-through-recurse*.** Run the existing probe tasks
  *through* the shipped `recurse()` at `maxDepth=1` (single task = depth-0) and confirm the worker still
  closes green / fails honestly. This is the verify-shipped-vs-POC reconciliation (benches-prd doctrine),
  not a fresh validation of the worker.
- **Replay-through-recurse (the cheap reconciliation) — ✅ DONE (probe-03, 2026-06-29).** Wrapped the
  probe-02 close as `opts.evaluate`, the senior-dev stance as `opts.persona`, `edit_file` as `opts.tools`;
  ran sum/csv/stuck at `maxDepth:1` under a bareguard `Gate`. Confirmed green→green and the budget-cap
  clean `{ incomplete }` path — recurse halts **cleaner** than refine because it is single-pass (the
  **F11-improves** result, recorded as F17). Verify-shipped-vs-POC, not fresh validation.
- **New spikes — for what recurse newly introduces (its own riskiest assumptions), all gated:**
  1. **The grounding seam across nodes — ✅ DONE (probe-04, 2026-06-29). Doctrine validated.** A 3-slice
     fixture (`multi`, one slice unsatisfiable; `multi-ok` control) through forced flat fan-out: the
     **global top predicate caught the ungrounded slice** (top `pass:false`, never faked green) while
     children were `verdict=null` (ungraded — F13 confirmed empirically); the control converged GREEN.
     Synthesis was `'concat'` (no LLM merge). Surfaced F18 (over-decomposition at depth), F19 (decomposition
     strips path context → re-inject via persona), F20 (small-model self-healing ceiling — 6 scaffolds for a
     trivial task; the close held throughout). See `FINDINGS.md` ✅ Spike-1 RESULT + F18–F20.
  2. **Memory-as-self-improvement — retry-with-recall at the leaf.** *Reframed (2026-06-30):* the old
     "fan-out-with-handles" framing is **subsumed** by this — BA-8 + BA-9 shipped + verified (v0.23.0, F21),
     so the seam exists. Wired it: a definite leaf runs as `opts.refineLeaf` with relayfact's **deterministic
     sensor** (its executable close); on a failed attempt the GAP is fed forward (built-in) **and** relayfact
     enriches it with an error-keyed litectx **`recall`** (bareagent stays litectx-agnostic — the handle is the
     caller's). **⚠️ First attempts (probe-06/07/08) were FIT TO PASS and their results are RETRACTED** (the
     recalled "lesson" contained the literal answer; run 1 was handed the value; "transfer" was a renamed
     sibling; far distractors). They stand only as: **the wiring works** and memory-presence changes the
     outcome; plus one durable rule — **store lessons as `kind:'fact'`** (a fact ranks; an `episode` scored 0).
     See F22–F24 (corrected) + the `no-fit-to-pass-tests` memory.
     **✅ HONEST RESULT (probe-09, F25):** the lesson is a transferable RULE that does NOT contain run-2's
     answer; run 1 (`userId`) DISCOVERS it by reading a scoped runbook; run 2 (`orderId`, a different entity)
     must RE-APPLY the rule (new prefix + check letter); a near, WRONG distractor (`legacy-id-format`) is
     threaded alongside the right rule; the query is derived from the failure. **Measured (haiku, n=4): blind
     0/4 pass, recall 4/4 pass** — the current rule ranked #1 over the threaded legacy rule every time and the
     model adapted it correctly. A **real, scoped** win: recall of a transferable lesson lets the agent solve a
     project-specific task it cannot do blind. **Honest limits (NOT closed):** one fixture + one small model,
     n=4 (not a rate across tasks); lexical BM25 (embeddings off) and the right lesson is a longer/richer doc
     than the terse distractor — a length/TF confound not controlled; same-domain transfer; "learning" =
     remember-what-worked, not novel induction.
     **✅ HARDENED (probe-10/11, F26–F27) — and the F25 win largely did NOT survive the controls:**
     - *Length confound CONFIRMED (F26, zero-token, deterministic):* add an **equally-rich** wrong
       distractor and BM25 ranks two *wrong* rules **above** the right one under the same failure-derived
       query (twin 2.808 / legacy 2.128 / right 1.737). The F25 "#1" was a length/TF artifact. No embeddings
       tier can fix it — a word-for-word wrong "twin" embeds to ~the same vector; **retrieval ranks on
       similarity, not correctness**.
     - *Decomposed rate across 5 entities (F27):* `blind 0/5` (control holds, not guessable); `recall3 0/5`
       — naive top-3 **starves** the worker (right note ranks #3, falls out of top-k → it copies a wrong
       rule); `recall4 4/5` — thread top-4 so the right note is present and the **worker discriminates** it
       from the two higher-ranked wrong rules and converges. The **structurally-distant** transfer
       (`auditBadge`, wrapped output) fails even in recall4 — reuse copies the lesson's return shape.
     - **Net (the durable, honest claim):** the memory loop's value is **not in ranking** — naive lexical
       recall can starve or mislead. It is in the **worker + grounded close**: given the right note in
       context, a small model picks it over higher-ranked wrong ones and the executable close converges
       (4/4 same-structure). *Recall proposes, executable verification disposes.* Embeddings-on (paraphrase)
       left unrun — F26 shows it cannot solve the correctness-vs-similarity problem that bounds this.
  3. **Boundary mapping at depth** — read RC-10 receipts (`out.receipts.spawned`). Caveat: child verdicts
     are rubric-or-null (recurse default), top verdict is relayfact's grounded close — so the map is
     grounded at top+synthesis, rubric/absent at children. Does the rubric/HITL residue grow/shrink/move
     as tasks decompose? The *secondary-goal* measurement (§0/§1), now tree-structured.
     **✅ DONE (probe-12, F28):** a 6-fn/2-module toolkit under one global suite, `maxDepth:2`. Both arms
     held the doctrine at **organic** decomposition (not Spike 1's forced flat fan-out): the grounded close
     ran **exactly once** (`groundedCalls=1`, confirming F13 from receipts), **grounded coverage = the ROOT
     only (1/3)**, every descendant `verdict=null` (the ungrounded residue), and the **global top predicate
     caught a fault owned by an ungrounded child** (RED `pass=false`) while the control converged (GREEN).
     **Honest limit:** the tree never nested past depth 1 — haiku, given inline specs, has each module child
     *do* its functions rather than re-decompose (`opts.count` forces width only at the node it is set on, not
     children). **Depth is model-bounded, not mechanism-bounded** (mirror of F18's over-decomposition);
     **depth-2 reach is UNPROVEN with this model**. The residue's *safety* is carried entirely by the global
     root close; its *size* is set by how far the model decomposes.

**Cross-cutting (non-negotiable):** every spike runs under a bareguard `Gate` with `maxDepth`/`maxChildren`/
`budget` caps — the recurse "cost is open by design" ⚠️ is proven real (a weak model over-decomposed to
40–117 calls; a wired gate cut it to 4–5). Net: the worker POCs carry forward untouched; recurse adds the
replay-reconciliation + three gated spikes. **No existing POC is invalidated.**

**Validation status (2026-06-25).** All five v1 exit criteria (a–e) have been **demonstrated in the
`poc/` probes** — probe-01 (verify half), probe-02 (real gated attempt + litectx store), probe-02-gate-
check (enforcement). This closes the `POC` step of `POC → design → build`: the design is de-risked and
the three libs are proven usable together (findings F1–F11, `docs/00-context/FINDINGS.md`; F5 resolved).
**No shippable `src/` exists yet** — `poc/` is throwaway (§2), so v1-as-a-product is still a build ahead,
not done. Next: design → build v1 proper (Testing Trophy), graduating the probes' proven shape. The
honest residue to carry in: only a small model was exercised, and the `rubric`/HITL boundary (§5) was not
yet stress-mapped — that is v2's measurement against benches-prd.

**v2 spike progress (2026-06-30).** Still POC — no `src/`, nothing committed. Done: replay-through-recurse
(probe-03), Spike 1 grounding seam (probe-04), the upstream unblocking — BA-1/F16 security fix verified
(v0.22.0), BA-8 `refineLeaf` + BA-9 `context` verified-shipped (v0.23.0, probe-05/F21) — and **Spike 2's
memory-loop MECHANISM** (probe-06/F22: error-keyed recall flips fail→pass, litectx ranks the right lesson
over distractors). **⚠️ probe-06/07/08 were FIT TO PASS — results RETRACTED to "the wiring works"** (recalled
lesson held the literal answer; value handed over; renamed-sibling transfer; far distractors). The honest redo
**probe-09/F25** (lesson = a transferable rule NOT containing the answer; discovered via runbook; re-applied to
a new entity; near-wrong distractor threaded) first read **haiku n=4: blind 0/4, recall 4/4**. **HARDENED
(probe-10/11, F26–F27) and the win largely did NOT survive:** an **equally-rich** wrong distractor makes BM25
rank two *wrong* rules **above** the right one (F26 — length confound confirmed, zero-token/deterministic; no
embeddings tier can fix it — retrieval ranks on similarity, not correctness). Across 5 entities (F27): naive
top-3 recall **starves** the worker → 0/5; thread top-4 so the right note is present and the **worker
discriminates** it from the wrong ones → 4/5; the **structurally-distant** transfer fails even then. **Durable,
honest takeaways:** (a) store lessons as `kind:'fact'`; (b) the memory loop's value lives in the **worker +
grounded close**, never in ranking — *recall proposes, executable verification disposes*. **Spike 3 DONE
(probe-12, F28):** grounding seam holds under organic decomposition (grounded coverage = root only; global
predicate catches an ungrounded child's fault), but depth is model-bounded — haiku won't nest past depth 1,
so depth-2 reach is unproven. **All three v2 spikes are run.** The eval-grounding boundary has been mapped (F20/F26/F27/F28): the grounded
close is the only thing that closes the loop; retrieval and rubric are advisory; the worker (model) is the
ceiling. **The graduate-vs-archive decision now runs through the §8.2 gate** — the spikes above validated the
loop's middle; §8.2 covers the unproven ends (request-in, come-back-out) before any `src/` is scaffolded.

### 8.2 Graduation gate (gate v3) — what must hold BEFORE scaffolding `src/`

**Why this gate exists (2026-07-02).** The stated goal is: *take input from a human once, go try to achieve
it, come back and stop if the POC fails / the goal can't be met / it doesn't make sense — otherwise keep
going.* The v1/v2 spikes validated the loop's **middle** (worker + grounded close + decomposition + memory +
caps + redaction) on hand-authored fixtures with hand-authored verify commands. The **two ends** of that
sentence — the prose request coming IN, and the coming-back-to-a-human — have zero evidence, and both are
where the thesis is most exposed. Graduation = all five criteria below met (or explicitly descoped in
writing, with the honest claim shrunk to match). Each is a POC-first spike or a written artifact, per
AGENT_RULES; each test must be able to FAIL (no fit-to-pass — the `no-fit-to-pass-tests` memory applies to
the agent's own outputs too).

- **G1 — the self-authored close is honest (Spike 4: PRD→evals compilation) — `poc/probe-15-selfauthored-close.mjs`.**
  *The crux.* Every probe so far was handed its predicate; nobody has tested who WRITES it. If the agent
  authors its own test suite, the R-S8 trap relocates one level up: a weak/rigged suite closes green on a
  wrong artifact and the global predicate grounds nothing (the agent-side fit-to-pass failure mode).
  **Shape — two phases, so "propose the close BEFORE implementing" is structurally enforced, not hoped:**
  *Phase A (propose):* feed a **prose request only** (no test in the fixture); the worker's single tool is
  `write_test` (`edit_file` with `fs.writeScope` restricted to `*.test.js`) — it authors an executable
  `node --test` suite pinning the acceptance criteria. *The relayfact-owned adversarial gate (deterministic,
  zero rubric)* then runs on the produced suite: **(a) stub-fail** — the suite must exit non-zero against a
  no-op stub (a suite green on a stub is rejected); **(b) mutation-catch** — relayfact holds a hidden
  *reference* impl and generates k mutants (k=5: one no-op + **four SUBTLE** — off-by-one, wrong pad width,
  wrong sign, truncate-not-round); the suite must kill **≥4/5** (the subtle mutants are the real teeth — an
  easy mutant set makes "honest close" hollow); **(c) N/M count** — the worker emits a criteria→eval map;
  relayfact counts N grounded (predicate/agentic) of M total (the §1 secondary-goal number, reported not
  gated). *Phase B (implement):* only if the suite passes (a)+(b), run the normal `refine`/close loop with
  that validated suite as the executable close.
  *Arms/controls that can fail:* ≥2 distinct prose requests (`money-cents → "$X.XX"`; a CSV-field parser
  with quoted commas). Honest-fail paths, all reported: suite green on stub → G1 fails; can't kill subtle
  mutants → G1 fails; low N/M → claim SHRINKS to "autonomous once a human authors the definition of done."
  *Fixtures:* `poc/fixtures/g1-*/` = `prose.md` + hidden reference impl + mutant generator + stub.
  *Run:* `ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-15-selfauthored-close.mjs money-cents`
  (then `csv-field`); sonnet arm via `RELAYFACT_MODEL`.
- **G2 — one real-task e2e integration run (the whole pipe, once, for real) — `poc/probe-16-realtask-e2e.mjs`.**
  No probe has run request → contract → decompose → workers → synthesize → close → deliver-or-escalate
  **as one program**, and every fixture was a toy (3-function toolkits, ID conventions). F20's "the worker
  is the ceiling" was measured on haiku + trivia; the graduated build's regime is unknown.
  **Shape:** the uncrafted source is a **small real repo pinned at a commit** whose child commit fixed a bug
  by adding/repairing a HUMAN-written test — check out the **parent**, task = "make the suite pass." The test
  and the answer are not mine to author (uncrafted by construction); prefer a recent/obscure commit so the
  fix is not trivially memorized. The pipe runs as one program with **G1's compiled close** (or, if probe-15
  fails, the repo's own suite as a human-authored close — noted honestly), under a bareguard `Gate`, event
  stream on, observer (G4) attached. **Measured, not vibed:** scaffolding interventions (F20 baseline 6 on
  trivia — **pass bar ≤2**; if a real task needs comparable hand-holding, persona/context is reworked BEFORE
  `src/`), cost/task, close verdict, N/M on this task's criteria. **Production model = sonnet-class; haiku =
  the A/B control** (the contrast IS the datapoint). *Pass:* delivers green or escalates honestly with ≤2
  interventions, cost within gate. *First benches-prd datapoint for the graduated shape.*
  *Run:* `ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_MODEL=<sonnet> node poc/probe-16-realtask-e2e.mjs`
  (then a haiku run).
- **G3 — the come-back: escalation artifact + pre-flight sanity check — `poc/probe-17-comeback.mjs`.** The
  goal sentence is an interaction pattern; only its budget-halt corner has ever fired. Two deliverables:
  **(a) Escalation artifact (the "comes back" shape):** when the loop stops — close exhausted, cap tripped,
  rubric-uncertain, pre-flight declined — the human receives ONE structured report, not a raw
  `{incomplete}`: `{ goal, whatWasTried (per-attempt: artifact-delta + verdict + gap), blocker
  (which HITL trigger fired, §5), decisionNeeded (a concrete question with options), receipts (RC-10 refs),
  costSpent }`. It is emitted on the event stream like everything else (a terminal `run.escalate` event) and
  rendered by the CLI listener. *Pass:* probe forces each stop-class and asserts the artifact is complete +
  decision-ready (a human can answer it without reading the JSONL).
  **(b) Pre-flight "doesn't make sense" check:** BEFORE spending on decomposition, a bounded plan-time pass
  classifies the request `{ proceed | clarify(questions) | decline(reason) }`. This is rubric territory and
  that is FINE under the doctrine — **rubric may OPEN HITL (stop/ask); it may never CLOSE green** (§5
  unchanged). Ambiguity questions are batched here (HITL trigger 1). *Pass:* a probe with 3 request classes
  — coherent / underspecified / impossible-or-nonsense — routes each correctly, with a control that can fail
  (the coherent one must NOT be declined).
- **G4 — the observer is an artifact, not a rollup — `poc/observer.mjs` + `poc/probe-18-observer.mjs`.**
  "Observable" is in the goal's name and is the least-built part: F15 relocated the taps (audit + RC-10
  receipts + `ctx.stream`), but every probe hand-rolls its own counters; no coherent renderer exists.
  **Shape:** ONE reusable CLI listener module (`poc/observer.mjs`, still `poc/`-grade) that consumes the
  event stream (`run-*.jsonl`) + audit + receipts of any recurse run and renders: the tree (per-node status
  + verdict incl. the `verdict=null` ungrounded residue), the recitation (contract + gap-so-far per turn),
  memory activity (recall candidates threaded, widen steps, which note the worker used), gate activity
  (denies/halts/cost), and the terminal deliver/escalate line. Pure listener — zero control-flow coupling
  (§7 invariant); it never imports the engine. *Pass:* replay it over ≥2 EXISTING probe logs (probe-12,
  probe-13) + the G2 run without modifying the engine side; a reviewer can narrate what happened from the
  render alone. **Built FIRST (token-free) so it instruments every probe after it.**
  *Run:* `node poc/observer.mjs poc/run-probe13.jsonl` (replay); `node poc/probe-18-observer.mjs` (the
  self-check that asserts the render covers the required facets over the two existing logs).
- **G5 — the graduated PRD exists before the rewrite (spec-before-build).** This document is now a
  spike changelog; the `src/` build needs its own spec.
  **Shape:** a v3/graduated PRD whose exit criteria are the goal sentence made testable — *"given a prose
  request and a repo, relayfact produces a contract, compiles a close (G1 shape), runs gated, and either
  delivers green or returns a G3 escalation — demonstrated on ≥N real tasks with the grounded/rubric split
  counted per task"* — and which **explicitly scopes** the known descopes so the eval table stops
  overselling: the `agentic` tier has never been run (predicate-only evidence); embeddings tier unrun
  (F26 argues it can't fix correctness-vs-similarity); memory widening needs a cap or real retrieval at
  store scale (F29 caveat); only the bare-`refine` terminate nuance documented (F30). Each is IN (with a
  spike) or OUT (with the claim shrunk) — no silent gaps.

**Build & run order (revised 2026-07-02 to fit the harness):**
1. **G4 `probe-18` / `observer.mjs` FIRST** — token-free, and it instruments every probe after it.
2. **G1 `probe-15`** — the crux; if it fails hard the archive path opens and G2's close-source changes.
3. **G2 `probe-16`** — consumes G1's close; most expensive; run sonnet then haiku back-to-back.
4. **G3 `probe-17`** — cheap; parallelizable with G4.
5. **G5 PRD** — last, encoding the numbers G1–G4 produced.

All spikes gated (bareguard), all in `poc/` (throwaway), all findings to FINDINGS.md. **Operational (from
prior sessions):** the `pass amr/claude_api` key expires mid-session — run token probes back-to-back while
the cache is warm; every probe persists `poc/run-probe*.jsonl` (gitignored) as the observer's + FINDINGS'
artifact. **Two places this plan itself could still paper over, treated as first-class when building:**
probe-15's mutant SUBTLETY (easy mutants make "honest close" hollow) and probe-16's REPO choice (a
memorized fix makes "real" soft — prefer recent/obscure). **Archive path stays live:** if G1 fails hard
(self-authored closes can't be kept honest) and the human-authored-close claim isn't worth a build,
archiving IS the honest outcome — that bar is the point (§0).

---

## 9. Findings discipline — no papering over

The second deliverable (after a working agent) is an honest verdict on the three libs. Rules:
- Every friction point is logged in `docs/00-context/FINDINGS.md`, grounded in source (`file:line`), and either fixed
  upstream (at the lib, propagating from the `hamr0` origin where relevant) or it **stops us** — never a
  silent workaround. (Log: `docs/00-context/FINDINGS.md`.)
- "Works as intended" is a finding too. Refuted assumptions get recorded against the author (see F1).
- Claims about the libs' value are **benched, not asserted** — see `benches-prd.md`, which carries the
  validation discipline and prior findings from litectx so relayfact doesn't re-learn them.

---

## 10. Open questions & risks

- **recurse() delivery — RESOLVED (v0.21.1, 2026-06-29).** Delivered and reconciled with no blocking
  mismatch (§0/§5.1): `opts.evaluate` honored over the default rubric and run on the synthesized result;
  `opts.persona` provides the worker stance; caps wired via `ctx.policy` + `ctx.onLlmResult`. Residual: the
  close is top-node-only (children strip `evaluate`) — carried into §8.1 spike 1, not a blocker.
- **Does the grounding doctrine survive synthesis/decomposition (§5)? — ✅ RESOLVED (probe-04, §8.1 spike 1).**
  Yes: a **global top-level predicate** catches an ungrounded intermediate node even though children strip
  `evaluate` (`verdict=null` in the receipts); the control converges green; synthesis ran as `'concat'` (no
  LLM merge). The new limiting factor is **not** grounding but the **worker** — small models self-heal only
  under heavy scaffolding (F20), and decomposition strips concrete context the worker needs (F19).
- **`onToolResult` not threaded into recurse workers — N/A for relayfact.** Caps are bareguard's, not
  bareagent's, and the cost paths (`ctx.policy` + `ctx.onLlmResult`, incl. tool-internal LLM calls) are
  wired; `onToolResult` only adds per-principal audit accounting, moot for a single-process single-tenant
  loop. Logged, not carried as live friction.
- **The hard problem (§5):** how reliably can prose acceptance criteria be compiled into grounded
  predicates? This is the secondary-goal experiment; expect the `rubric` residue to be the limiting factor.
- **Provider/cost:** the real loop needs an API key (FINDINGS F5 — no key-free path exercises the
  substrate). Config via env per twelve-factor; no secrets in the tree.
- **CJS/ESM:** proven fine via `createRequire`, but watch for sharp edges as surface grows.
- **Scope creep into a primitive:** the standing risk. Guard with §2 every time relayfact "needs" something.
- **Does litectx beat grep in *this* loop?** Don't assume — benches-prd treats it as an A/B, not a given.
