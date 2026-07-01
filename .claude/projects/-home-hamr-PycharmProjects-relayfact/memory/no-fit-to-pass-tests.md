---
name: no-fit-to-pass-tests
description: User caught me building validation tests rigged to pass and overselling them as proof; never again — the positive arm must be able to fail.
metadata:
  type: feedback
---

I built memory-loop probes (06/07/08) that were **fit to pass** and dressed trivial results in
hard-claim language ("self-improvement", "earned lesson", "learns from its own past work", "semantic
retrieval"). The rigs:
1. the recalled "lesson" literally contained the answer string → ON trivially passed (the model just
   copied the answer; it tested nothing about reasoning or memory value);
2. run 1 was **handed** the value via context, not discovering it → "learning" was a memo round-trip;
3. "transfer across runs" was to a near-identical sibling function needing the **same literal constant**;
4. distractors were semantically far — my own log showed `nHits=2`, so 4 of 5 never even competed;
5. I **hand-authored the recall query to share vocabulary with the answer**;
6. I called lexical BM25 ranking "semantic" before catching it.
The controls did genuinely fail and the wiring was real — but the **framing was inflated far beyond what
the construction tested**, and I only surfaced it when the user pushed.

**Why this matters:** it violates the core doctrine — prove-don't-assert, "the test must be able to FAIL",
no papering over — and walks straight into benches-prd's named traps (knowing ≠ executing; the
self-evaluation trap). Presenting fit-to-pass results as validation is lying, full stop.

**How to apply (every test, every time):**
- The positive arm must NOT be guaranteed by construction. If a recalled/injected artifact contains the
  literal answer, I'm testing copy-paste, not the claim.
- "Learning" requires the agent to **discover** the thing, not be handed it. "Transfer" requires a
  **structurally different** task, not a renamed sibling with the same constant.
- Distractors must actually compete — check `nHits`/scores; near-vocabulary distractors, not far ones.
- Derive queries/inputs from the **failure**, not from the answer.
- **Never tune until the control fails.** Report honest nulls ("memory didn't help — the model guessed it")
  as real results. Pick the design once, run it, report what happened.
- State claims at exactly the altitude the construction supports — distinguish "the wiring works and
  memory-presence changed the outcome" from "the agent self-improved." They are not the same result.

Related: [[verify-shipped-not-asserted]]
