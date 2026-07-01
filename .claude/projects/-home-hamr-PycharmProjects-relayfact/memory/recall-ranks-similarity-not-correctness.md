---
name: recall-ranks-similarity-not-correctness
description: relayfact's memory-loop "win" was overturned under a length-controlled test — lexical/semantic recall ranks on similarity, not correctness; the worker+grounded close is the discriminator.
metadata:
  type: project
---

relayfact probe-09 claimed a memory-loop win (haiku n=4: blind 0/4, recall 4/4 — "recall ranked the
right rule #1 over a threaded distractor"). Hardening it (probe-10/11, FINDINGS F26–F27, 2026-06-30/07-01)
**overturned the ranking part of that claim**:

- **F26 (zero-token, deterministic):** add an *equally-rich* WRONG distractor (length-matched, shares
  the vocabulary, wrong rule) and BM25 ranks two wrong rules ABOVE the right one under the same
  failure-derived query (twin 2.808 / legacy 2.128 / right 1.737). probe-09's "#1" was a document-length
  / term-frequency artifact, because its lone distractor was terse. **No embeddings tier fixes this:** a
  word-for-word wrong "twin" embeds to ~the same vector. **Retrieval — lexical or semantic — ranks on
  textual/semantic SIMILARITY, which is not CORRECTNESS.**
- **F27 (5 entities, haiku, grounded `node --test` close):** `blind 0/5` (not guessable), `recall3 0/5`
  (right note ranks #3 → naive top-k STARVES the worker → it copies a wrong rule), `recall4 4/5` (thread
  top-4 so the right note is present → the WORKER discriminates it from the higher-ranked wrong ones and
  the close converges). A structurally-distant transfer fails even in recall4 (reuse copies the lesson's
  output shape, not just the rule).

**Durable takeaway:** a retrieval-based memory loop's value is NOT in the ranking — naive top-k can
starve or actively mislead. It lives in the **worker + the grounded close**: *recall proposes,
executable verification disposes.* When you measure a "memory helps" result, the load-bearing control is
an **equally-rich wrong distractor** (kills the length confound) and **multiple instances for a rate**,
not n on one easy fixture. This is the [[no-fit-to-pass-tests]] discipline applied to retrieval: the
positive arm must be unable to win by construction (here, by being the longest doc).
