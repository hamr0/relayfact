# relayfact — graduation push: memory FIXED, F11 tested, depth corrected, cost-control + BG-1 verified (2026-07-02)

**Status:** All v2 spikes run AND the prior "not build-ready" blockers cleared. **No open graduation
blockers.** Still POC (no `src/`). **Now 2 commits** on branch `master` (first commits ever this session):
- `0cbdb51` Initial commit: whole POC tree (probes 01–12, fixtures, docs, .claude/, memory).
- `7f6e9f0` Graduation push: memory fix (probe-13), F11 (probe-14), depth correction (probe-12 Family A),
  BG-1 + budget verification, doc updates.

Continues `2026-06-30-ba89-verified-memory-loop-fit-to-pass-corrected.md`. This session did the hardening
(probe-10/11 → memory claim OVERTURNED then FIXED) and closed graduation blockers.

## What relayfact is (unchanged)
Experiment: autonomous "senior dev" runner ASSEMBLED from bareagent (loop/recurse) + litectx (memory) +
bareguard (leash). Builds NO primitives. Grounds the loop on EXECUTABLE verification (checks that can FAIL).
Secondary goal: map where the eval-grounding/HITL boundary falls. Local libs: bare-agent 0.23.0,
bareguard 0.10.1, litectx 0.26.1 (mounted from ~/PycharmProjects/{bareagent,bareguard,litectx}).
API key via `pass amr/claude_api` (GPG-locked; keeps expiring mid-session — user must re-auth via pinentry;
run probes back-to-back while the cache is warm). Model: haiku-4-5 (small on purpose); tested sonnet-5 once.

## THE ARC THIS SESSION (memory claim: hardened → overturned → fixed)
1. **probe-10 (ranking isolation, F26, ZERO-token, deterministic):** added an EQUALLY-RICH wrong distractor
   (length-matched, shared vocab, wrong rule). Under probe-09's own query, two WRONG rules outrank the right
   one (twin 2.808 / legacy 2.128 / right 1.737). **Length confound CONFIRMED** — probe-09's "#1 ranking" was
   a doc-length artifact. Retrieval (lexical OR semantic) ranks on SIMILARITY, not CORRECTNESS — the near-
   identical "twin" defeats embeddings too. So ranking can NEVER be the correctness discriminator.
2. **probe-11 (discrimination rate, F27):** 5 entities, adversarial store. blind 0/5; recall-top3 0/5 (right
   note ranks #3 → STARVED out of the slate → worker copies a wrong rule); recall-top4 4/5 (right note present
   → worker discriminates). Ranking starves; the WORKER discriminates when it sees the note.
3. **probe-13 (THE FIX, F29): naive 0/5 → fixed 5/5.** Fix = the thesis operationalized:
   - FIX-1 retrieval: DON'T trust rank. The grounded close DRIVES recall — widen the candidate window on each
     failed close (3→6, cap), framed "unverified candidates; the TEST decides which applies."
   - FIX-2 lesson form: store an explicit RULE + example (not verbatim code). A rule ranks better on a
     "what's the convention" query AND transfers across output structure.
   - **Corrected F27:** `auditBadge`'s "structure-transfer" failure was MY fixture underspecifying — the
     `<<…>>` wrapping lived ONLY in the hidden test, so the worker couldn't know it. Per-function output
     SHAPE is a task spec, NOT memory. Made fair (shape in task, neutral example, no answer leak) → passes.
   - Scaling caveat (logged): widening works for a bounded pool; a big store needs real retrieval or a hard cap.

## OTHER GRADUATION BLOCKERS — all cleared, verified by RUNNING
- **F11 (probe-14, F30):** two wrong probe versions first (single Loop finishes in 1 round; Loop catches
  HaltError internally so it never reaches the caller). Correct test uses the bare `refine` primitive:
  `terminate` STICKS (`gate.terminated` becomes the halting rule for later iters — clean stop-SIGNAL) but does
  NOT self-stop the spend (fresh Loop per iter calls the LLM before the gate is consulted → 4 calls, same as
  `deny`). So bare-`refine` callers still need probe-02's latch. **BUT relayfact's actual loop is `refineLeaf`,
  which halts cleanly after EXACTLY 1 over-cap call (verified directly) → cost-control is SOUND.** My earlier
  "9× overspend under refineLeaf" (probe-14 v2) was a measurement artifact, corrected.
- **Depth (probe-12, F31 — CORRECTS F28):** F28's "haiku won't nest, model-bounded" was MY MISCONFIG —
  `opts.count` forces flat Family-B workers that never re-decompose (recurse.js:391 recurseFanout). With
  Family A (no count) children run `recurse(…,depth+1)` (recurse.js:936). Re-ran: Family-A haiku = depth 1
  (2 module children, each solves in-worker); Family-A sonnet-5 = depth 0 (root solves all 6); hard/complex-
  noun framing = depth 0. CANNOT induce natural depth-2 (weak/strong model, any framing). ALSO corrected:
  decomposition depth is driven by `assessComplexity` — a PURE KEYWORD HEURISTIC, NOT the model (canSpawn =
  depth<maxDepth && level!=='simple'). So "stronger model for depth" was wrong. **"Depth-2 reach" is ILL-POSED:
  the global close covers the whole artifact regardless of tree depth. Doctrine HELD in every config.**
- **BG-1 (bareguard secret redaction) VERIFIED-shipped by running:** a `gate.check` on an action carrying a
  fake `sk-ant-…` key masks it in the audit by field (`[REDACTED:key=apiKey]`) AND value pattern
  (`[REDACTED:pattern=sk-a...]`), incl. `_ctx.provider.apiKey`; raw key absent. bareguard 0.10.1, default-on.

## Durable lessons (survive as findings/memory)
- **recall proposes, executable verification disposes** — the memory loop's value is in worker+close, never
  ranking. The FIX = close-driven recall widening + rule-framed lessons. (memory:
  `recall-ranks-similarity-not-correctness`, updated with the fix.)
- Retrieval ranks on similarity, not correctness — no tier (BM25 or embeddings) fixes that.
- recurse depth: `count` = flat Family-B (no nesting); omit `count` = Family A (children recurse).
  `assessComplexity` is keyword-based, model-independent. Capable models solve tractable tasks shallowly.
- Verify-by-running caught THREE of my own wrong inferences this session (F27 auditBadge, F28 depth, probe-14
  v1/v2). Prove-don't-assert works; state claims at the altitude the construction supports.

## Findings ledger now F1–F31 (docs/00-context/FINDINGS.md)
F26 length confound; F27 discrimination rate; F28 (CORRECTED by F31) depth; F29 memory FIX; F30 F11; F31 depth
corrected. UPSTREAM-FIXES: BG-1 → 🟢 SHIPPED+VERIFIED 0.10.1; BA-6 → nuance verified (F30).

## Probes (poc/, throwaway)
- probe-10-ranking-isolation.mjs (zero-token, deterministic)
- probe-11-discrimination-rate.mjs (blind/recall3/recall4 across 5 entities; fixtures/idfmt-multi/)
- probe-13-memory-fixed.mjs (naive vs fixed; the FIX)
- probe-14-terminate-halt.mjs (F11 via `refine`; env RELAYFACT_MODEL/MAX_ITER)
- probe-12-spike3-depth.mjs (depth; env RELAYFACT_HARD, RELAYFACT_TOP_COUNT, RELAYFACT_MODEL, RELAYFACT_MAX_DEPTH;
  fixtures/depth + depth-ok; generators fixtures/gen-*.mjs)
- Generated fixture working-copies + run-*.jsonl + .litectx-* are gitignored.

## NEXT / open decision
1. **Graduate or archive** — the bar is met: memory fixed, cost-control verified, doctrine robust, boundary
   mapped (F20/F26/F27/F28/F29/F31). User's call. If graduate → scaffold real `src/` (a REWRITE; poc/ never
   ships). Offered; awaiting decision.
2. Honest residuals (non-blocking): memory-fix widening SCALING caveat (big store needs real retrieval/cap);
   `terminate`-doesn't-self-stop-bare-`refine` nuance (doc note; relayfact uses refineLeaf so N/A to it).
3. Embeddings tier (@huggingface/transformers) NEVER installed/tested — F26 argues it can't fix the
   correctness-vs-similarity problem anyway; left unrun (honest).

## Doctrine reminders (VIOLATED-then-corrected this session — don't repeat)
- Verify by RUNNING before claiming; my inferences from source/config were wrong 3×. No fit-to-pass. State
  claims at the altitude the construction supports. Surface issues to FINDINGS/UPSTREAM; poc/ is throwaway.
- Commit only when the user asks (they did, twice). End commits with the Co-Authored-By trailer.
