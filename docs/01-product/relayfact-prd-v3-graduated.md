# relayfact — Graduated PRD (v3)

**Status:** GRADUATE recommendation (2026-07-04). This is the **G5** deliverable of the §8.2 graduation
gate — the spec-before-build document for the `src/` rewrite. It supersedes nothing: the v1/v2 PRD
(`relayfact-prd.md`) remains the **spike changelog and rationale**; this doc is the **build spec**. It
encodes the G1–G4 numbers, makes the goal sentence testable, and draws every known descope explicitly
(IN-with-a-spike or OUT-with-the-claim-shrunk — no silent gaps).

> **The gate that had to hold before this doc could exist (§8.2):** G1 ✅ · G2 ✅ · G3 ✅ · G4 ✅ — all
> four empirical gates met, on **stock library defaults**, with **no papering-over**. G5 (this document)
> is the fifth and final gate item, and is a written artifact rather than a code probe. The
> **archive path stayed live** through all of it (§0); it is not chosen — the evidence below is why.

**Local lib versions this verdict rests on (all verified-by-running, not by reading source):**
bareguard **0.11.1** · bare-agent **0.25.0** · litectx **0.26.1**. Model tiers exercised: **haiku-4-5**
(control / small-on-purpose) and **sonnet-5** (production-class). Nothing runs on a relayfact workaround —
the three bugs the pipe surfaced (BA-10, BG-3, BA-11 + BG-4) shipped upstream and were re-verified.

---

## 0. The verdict, in one paragraph

relayfact set out to answer three questions (§0 of the v1 PRD): are the three bare libs' primitives
**useful / complete / proper**, and **how far can a loop self-heal** before a human is required. All three
are answered with evidence that can fail. The libs are **usable together, unmodified**: the whole pipe
delivered a gold-correct fix to an uncrafted real-repo bug on stock defaults (G2). The self-healing
ceiling is **mapped, not asserted**: a loop closes only as far as "done" compiles to a test that can fail;
beyond that — vague or judgment-only criteria — a human is required, and relayfact **counts** where that
line falls rather than pretending it isn't there (G1/G3, F20/F26/F28). The thesis' two most exposed ends —
who authors the close (request-IN, G1) and how the loop comes back (come-back-OUT, G3) — now have direct
evidence, and both failed only in the **safe direction**. **Recommendation: graduate** — scaffold `src/`
as a rewrite (never ship the POC, §2), against the exit criteria in §3 and the descopes in §4.

---

## 1. What graduation means here (and what it does not)

- **Graduate = build `src/`.** A clean-room rewrite of the proven POC shape into a shippable application
  package (pure ESM, JSDoc, no secrets — the always-true hygiene from `LIBRARY_CONVENTIONS.md`), under the
  Testing Trophy, consuming bareagent/litectx/bareguard as dependencies. **`poc/` is discarded, not
  promoted** (§2 doctrine; the memory `poc/ is throwaway` applies).
- **Graduate does NOT mean "the experiment is fully de-risked."** It means the empirical gate cleared and
  the residue is bounded and written down (§4). Every honest limit carried into the build is a first-class
  entry in the descope table, not a footnote — the eval table stops overselling here.
- **relayfact still builds no primitives** (the founding doctrine). If the `src/` build discovers it
  "needs" a primitive, that is a **finding against the lib**, filed to `FINDINGS.md`/`UPSTREAM-FIXES.md` and
  fixed at the `hamr0` origin — never grown locally.

---

## 2. The evidence the verdict rests on (G1–G4, numbers not vibes)

Every row is a POC-run under a bareguard `Gate`, findings logged, controls that can fail. Full detail lives
at the cited F-numbers in `docs/00-context/FINDINGS.md` and §8.2 of the v1 PRD.

| Gate | What it proves (the goal-sentence end it covers) | Result — the numbers | Honest limit carried forward |
|---|---|---|---|
| **G1** — self-authored close is honest (`probe-15`, F33) | *request-IN:* who WRITES the close, not just who runs it | Across money/csv/truncate/titleCase × haiku/sonnet: **fit-to-pass 0/10** (0/8 haiku + 0/2 sonnet). Every failure was **over-constraint, caught by the "a correct impl must pass" reference gate → escalate SAFE** (haiku csv 2/5 honest, 3/5 caught; haiku titleCase caught). Stronger model needs less spec → **model-modulated** (sonnet money 4/4, csv 4/4 gold-correct on fresh values). | Honesty tracks **spec completeness**; the unsafe own-green/GOLD-red mode is **unobserved, not impossible** (2 models, small fixtures). **Independent GOLD stays the standing arbiter** in `src/`. |
| **G2** — one real-task e2e, the whole pipe once for real (`probe-16`, F36) | the middle wired end-to-end as one program on uncrafted data | Repo `flightlog @ d60011a` (parent of a real 2026-06-01 jq-hint bug; human-written test). **Both arms delivered green, first attempt, GOLD-correct, 0 interventions** (F20 trivia baseline was 6; bar ≤2). Stock libs: **sonnet-5 $0.095 / 4 calls** (BA-10 temp-fallback fired+recovered), **haiku $0.088 / 7 calls**. `groundedCalls=1` (F13), `maxDepth=0`, `fitToPass=false`, under the $1 cap. | **n=1**, one localized single-file bug (**no organic decomposition** here — that's probe-04/12); the close here was **human-authored** (self-authored = G1); **`agentic` tier unrun** (predicate-only). |
| **G3** — the come-back: escalation artifact + pre-flight (`probe-17`, F38) | *come-back-OUT:* the human receives a decision, not a raw `{incomplete}` | **(a)** five §5 stop-classes each assemble ONE **decision-ready** `run.escalate` `{goal, whatWasTried[], blocker, decisionNeeded{q,options}, receipts, costSpent}`, every stop **forced by real execution**; control-can-fail: `isDecisionReady` **rejects** a bare `{incomplete}`, a <2-option report, an attempt with empty `whatWasTried`. **(b)** pre-flight (real haiku ~$0.05): coherent **never declined** (→`clarify`), nonsense **never proceeds** (→`decline`). | **n=1/class**, one model; the soft proceed/clarify/decline **middle is fuzzy** ("make it better" → `decline`, reported not gated) — the §5 residue from the pre-flight side. rubric-uncertain stop is a deterministic stub (routing under test, not rubric calibration). |
| **G4** — the observer is an artifact, not a rollup (`observer.mjs` + `probe-18`, F32) | *observable* is in the goal's name | ONE reusable **pure-listener** CLI (never imports the engine, §7) renders the tree (incl. `verdict=null` ungrounded residue), recitation, memory activity, gate activity, deliver/escalate line — replayed over `probe-12`, `probe-13`, and the G2 log without touching the engine. Its self-check (control = declare a facet **ABSENT**, never fabricate) **caught 3 real bugs in itself**. | Still `poc/`-grade; renders what probes **emit** — the worker `Stream`/receipts-tree isn't persisted by default, so `src/` must emit a `receipts` event for full-tree rendering (memory: observer caveat). |

**The one big honest finding across all of it:** the loop self-heals only as far as "done" compiles to a
test that can fail. Retrieval (BM25 or embeddings) ranks on **similarity, not correctness** (F26), so
ranking can never be the discriminator; rubric may **open** a stop/ask but may **never close** green (§5);
the worker (model) is the **ceiling**, and the grounded close held through **every** observed failure.
*Recall proposes, executable verification disposes.*

---

## 3. Exit criteria for the `src/` build (the goal sentence made testable)

The founding goal (§8.2): *take a prose request once, go try to achieve it, come back and stop if it fails /
can't be met / doesn't make sense — otherwise keep going.* Graduated and made testable, the `src/` build is
DONE when:

> **G5-EXIT.** Given **a prose request and a repo**, `src/` relayfact: (1) runs a **pre-flight** that
> classifies `{proceed | clarify | decline}` (rubric may open HITL, never close it); (2) compiles the
> request into a **grounded close** — the G1 shape, with the **independent GOLD** as arbiter and the
> reference-gate validity check retained; (3) runs **gated** on `recurse()` (bareguard caps depth/children/
> budget; the grounded close is the **top-node-only global predicate**, F13); (4) **either delivers green**
> (close exit code = truth) **or returns a G3 decision-ready escalation** — never a bare `{incomplete}`,
> never a rubric-declared "done"; (5) narrates every step to an **append-only event log** a pure-listener
> observer renders. **Demonstrated on ≥3 real (uncrafted) tasks**, with the **grounded/rubric split
> counted per task** (N grounded of M criteria — the §1 secondary-goal number, reported not gated).

Each of (1)–(5) already has a passing POC (G1–G4); `src/` re-earns them **as shipped code under tests**,
not as throwaway probes. The `≥3 real tasks` raises G2's `n=1` to a small real cohort (the first
benches-prd datapoints for the graduated shape — honor the benches method: controls that can fail, real
uncrafted data, replay-through-shipped-code).

**Controls that must be able to fail in the `src/` suite** (the `no-fit-to-pass-tests` memory applies to
the build's own tests too): a suite green on a no-op stub → rejected; a close that passes a known-wrong
mutant → rejected; an escalation missing `decisionNeeded`/`whatWasTried` → rejected; a "delivered green"
whose independent GOLD is red → rejected (fit-to-pass tripwire).

---

## 4. Descopes — drawn explicitly so the eval table stops overselling

Each known limit is either **IN** (a named `src/` spike) or **OUT** (scope removed, the claim shrunk to
match). No silent gaps.

| # | Descope | Status | The honest claim after shrinking |
|---|---|---|---|
| **D1** | **`agentic` eval tier never run.** All closes to date are **predicate-tier** (`node --test`, exit code = truth). The `agentic` tier (a close that *exercises* the deployed artifact — the strongest close per §5) is unexercised. | **IN — first `src/` spike.** Cheapest high-value gap; the grounded-close doctrine claims it as the strongest tier, so the build must exercise it once on a real artifact before the eval table lists it. | Until that spike passes: **"grounded close = predicate-tier proven; agentic-tier is designed, not evidenced."** Do not list `agentic` as validated. |
| **D2** | **Embeddings retrieval tier unrun**, and F26 argues it **cannot** fix the correctness-vs-similarity problem (a word-for-word wrong "twin" embeds to ~the same vector). | **OUT — deliberately.** Memory ships **lexical BM25 + close-driven widening** (the F29 fix: widen the candidate window on each failed close, framed "unverified candidates — the test decides"). Embeddings is **not a dependency** and not a claimed upgrade path. | **"Recall is lexical; its value is surfacing the right note to the worker+close, never ranking correctness."** Embeddings is explicitly not relied upon (F26). |
| **D3** | **Memory widening only works for a BOUNDED pool** (F29 caveat). At store scale, naive top-k can **starve** the worker (right note falls out of top-k, F27) or be misled by an equally-worded wrong note (F26). | **IN — with a hard constraint.** `src/` must **cap the store** (or gate widening to a bounded candidate set) so widening stays sound; solving unbounded real retrieval is **out of scope**. Lessons stored as litectx **`kind:'fact'`** (BM25-rankable; `episode` scored 0). | **"Memory self-improvement holds for a capped/bounded store."** Unbounded-store retrieval is an open caveat, not a claim. |
| **D4** | **The bare-`refine` `terminate` nuance** (F30): `terminate` sticks as a stop-signal but does **not** self-stop an in-flight over-cap call in the bare primitive. | **OUT — N/A to relayfact.** relayfact's real loop is **`refineLeaf`**, which halts cleanly after exactly one over-cap call (F30, verified). Documented so a future bare-`refine` caller isn't surprised. | **"Cost-control is sound under `refineLeaf` (relayfact's loop)."** The bare-`refine` latch is a caller-side concern relayfact doesn't hit. |
| **D5** | **Fit-to-pass (own-suite green + independent GOLD red) is UNOBSERVED, not excluded** (0/10 across 2 models + small fixtures, G1). | **IN — standing guard, not a one-time spike.** `src/` **keeps the independent GOLD as the arbiter of "delivered green"** permanently (not a probe you retire). The reference-gate guards over-constraint; **only GOLD guards the one mode it can't see.** | **"Self-authored closes are honest to the degree the spec is complete; the unsafe mode is guarded, not proven-absent."** |
| **D6** | **Depth-2+ organic decomposition is model-bounded** (F28/F31): haiku splits shallow, sonnet solves at the root; "depth-2 reach" is **ill-posed** — the global close covers the whole artifact regardless of tree depth. | **OUT — not a build blocker.** The residue's *safety* is carried entirely by the **global root close** (F13); its *size* is set by how far the model decomposes. `src/` does not need to force depth. | **"Grounding is top-node-only and holds at any depth; decomposition depth follows task tractability + model choice, not a target."** |
| **D7** | **Scale of evidence:** most spikes are **n=1** on small fixtures / two models. | **IN — the §3 `≥3 real tasks` cohort** raises n and produces the first graduated-shape benches datapoints. | **"POC-validated on a small cohort; benches-grade rate is a build deliverable, not yet in hand."** |

---

## 5. Architecture the build inherits (unchanged from the proven POC shape)

No new machinery. `src/` re-implements, as shipped code, exactly the assembled pipe the POCs proved:

```
prose request
  → pre-flight: proceed | clarify | decline            (rubric may OPEN HITL, never CLOSE)      [G3]
  → compile request → a grounded CLOSE (test that can fail; independent GOLD as arbiter)         [G1]
  → recurse(): decompose → fan out workers → each edits files through the bareguard gate         [v2]
  → run the CLOSE (exit code = truth); on failure, feed the gap forward + retry (refineLeaf)     [F13/F21]
  → deliver GREEN, or come back with a decision-ready run.escalate                                [G3]
       …every step appended to the event log the pure-listener observer renders                   [G4/§7]
```

- **The seams relayfact owns** (everything else is the libs): `opts.persona` (senior-dev stance),
  `opts.tools` (`edit_file`, gated `action.type:'write'`), **`opts.evaluate`** (the executable close — the
  doctrine anchor, run on the synthesized top result, a **global predicate**, F13), optional
  `opts.synthesize` (concat/predicate, **never `'merge'`-only**, §5), `opts.context` (BA-9 working-context),
  `opts.refineLeaf` (BA-8 sense→regenerate leaf), and the **tree observer** (§7).
- **The leash:** `ctx = { provider, policy, onLlmResult }` — bareguard caps and redaction (BG-1 verified)
  default-on.
- **The iron rule (§5, non-negotiable):** the model's rubric may open a stop/ask; only a deterministic test
  closes the loop. Mapping where that line falls **is** the experiment, carried into `src/` as the per-task
  N/M count.

### 5.1 Where each eval falls — the two-placement rule

There are **exactly two** places judgment (rubric) is allowed, and **one** place that can ever declare the
work done. This is the single clearest statement of the iron rule, and the `src/` build must preserve it:

```
YOUR PRD / prose request
      │
      ▼
①  PRE-FLIGHT          ◄── RUBRIC (LLM judgment) — relayfact-owned
    "does this make sense / is it coherent?"
    → proceed | clarify | decline
    ⚠ can only OPEN a stop/ask. It can NEVER say "done".
      │ proceed
      ▼
②  COMPILE THE CLOSE   → an executable test that can FAIL (a PREDICATE) — relayfact-owned
      │                   (agent self-authors it from the PRD; independent GOLD guards it)
      ▼
③  RECURSIVE SELF-HEALING LOOP   ◄── bareagent (recurse / refine / refineLeaf)
    attempt → run the CLOSE on the OUTCOME → exit code = truth
        ✅ pass  → deliver green
        ❌ fail  → feed the gap back, try again
        🛑 stuck / cap hit / genuinely uncertain → stop, escalate
    ⚠ the eval HERE is DETERMINISTIC and runs on the OUTCOME (the produced artifact),
      never the model's say-so. This is the ONLY thing that closes the loop.
      │                          (the whole loop runs inside the bareguard leash: caps/halts/redaction)
      ▼
④  DELIVER green   OR   come back with a decision-ready escalation
```

| Eval type | Where it lives | Owner | What it's allowed to do |
|---|---|---|---|
| **Rubric** (LLM judgment) | Pre-flight (①); advisory "I'm uncertain" signal | **relayfact** | Only **open** a stop/ask/escalation. **Never** declare work done. |
| **Predicate / deterministic** (test, exit code) | The close, run inside the loop (③) on the outcome | **relayfact** (authored) / **bareagent** (runs it as `opts.evaluate`) | The **only** thing that can close the loop green. |

**Lib ownership, stated once so it stops being ambiguous:** the **loop** (recurse/refine/refineLeaf — the
"rlm") is **bareagent**; the **evals** (the deterministic close *and* the pre-flight rubric) are
**relayfact-owned** (the one thing relayfact builds — the PRD→close compilation); the **leash** around the
loop (cost/depth/children caps, halts, write-gating, secret redaction) is **bareguard** — it never judges
"done"; **memory** (recall/remember) is **litectx**. bareguard is *not* the evaluator; relayfact is.

---

## 6. Build order for `src/` (POC-first still applies to the rewrite)

Each module works end-to-end before the next (walking skeleton + vertical slices, AGENT_RULES). The
`src/` build is itself gated — the first slice that can't hold a control that fails stops the build.

1. **Event-stream spine + observer contract** — the append-only JSONL log and the pure-listener interface
   first (it instruments everything after it, exactly as G4 was built first). Persist the `receipts` event
   so the full tree renders (D-note from G4).
2. **The grounded close + independent GOLD** (G1 shape) — compile prose → close, reference-gate validity
   check, GOLD arbiter. **D5 lives here permanently.**
3. **The gated worker on `recurse()`** — persona + `edit_file` + `opts.evaluate` global predicate + gate
   caps; `refineLeaf` at the leaf with close-driven recall widening over a **capped** store (**D3**).
4. **Pre-flight + escalation** (G3) — `{proceed|clarify|decline}` in, `run.escalate` out.
   **↳ ASSEMBLED (F39):** steps 1–4 composed into one `src/pipeline.mjs::runRequest` (prose + repo →
   deliver-green | decision-ready escalation, every step on the event log; observer renders it). Live e2e
   green on real haiku, n=1/double (named). D5 GOLD stays the standing arbiter; D3 memory NOT wired yet.
5. **The `agentic`-tier close spike (D1)** and the **≥3-real-task cohort (D7)** — the benches datapoints
   that turn §3's exit criteria green as shipped code. **(next; D3 recall-widening precedes it, own session.)**

Then: retire `poc/` (throwaway, §2), and the build carries its own CHANGELOG entries under a real version
(`0.1.0`+ per the CHANGELOG's "versioning starts at the first graduated build").

---

## 7. The archive path, stated honestly (why it was NOT chosen)

The archive outcome was live and legitimate (§0: "It either graduates or gets archived. That bar is the
point."). It would have been the honest call if **G1 had failed hard** — self-authored closes that can't be
kept honest, with the human-authored-close claim not worth a build. That is not what the evidence shows:
G1's only failures were **safe-direction over-constraint, caught**; fit-to-pass never fired even on
fixtures built to bait it; and the whole pipe (G2) delivered gold-correct on stock libs. The experiment
**answered its questions** either way — that's the win regardless of the branch. Graduation is chosen
because the answers are **positive and the residue is bounded and named** (§4), not because archiving would
have been a failure. If the `src/` build surfaces that the residue is worse than §4 records, the archive
path re-opens — the bar does not move.
