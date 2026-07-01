# relayfact — recurse() shipped + verified, Spike 1 (grounding) DONE, memory-loop design (2026-06-30)

**Status:** v2 UNBLOCKED — bareagent `recurse()` delivered (`bare-agent@0.22.0`), reconciled, verify-shipped.
Spike 1 (grounding seam across decomposition) **PASSED conclusively**. Designed the memory-as-self-improvement
loop; logged 2 new bareagent asks (BA-8/BA-9). Continues `2026-06-29-probe-02-complete-and-recurse-replan.md`.

## What relayfact is (unchanged)
Experiment: autonomous "senior dev" runner ASSEMBLED from bareagent (loop/recurse) + litectx (memory) +
bareguard (leash). Builds NO primitives. Grounds the loop on EXECUTABLE verification (checks that can fail).
Primary goal: validate the 3 libs + learn CE. Secondary (falsifiable): a loop self-heals only as far as
criteria compile to GROUNDED evals; rubric-only+uncertain = HITL boundary. Map where that boundary falls.
- Repos symlinked: relayfact node_modules/bare-agent → ~/PycharmProjects/bareagent (0.22.0), bareguard → 0.10.0.
- API key: `pass amr/claude_api`, injected at runtime, NEVER in tree. Model tested: claude-haiku-4-5 (small, on purpose).

## Lib fixes DELIVERED + VERIFIED this session (verify-shipped-vs-spec, not asserted)
bareagent **0.22.0** + bareguard **0.10.0**, both installed (symlinked), confirmed by source grep + behavior:
- **BA-1 (F16 🔴 security) VERIFIED:** recurse was writing the live provider (apiKey) into the bareguard audit
  `_ctx` in PLAINTEXT. Fixed via `auditSafeCtx()` (strips provider). Re-ran probe-03 → audit `_ctx={"depth":0}`,
  NO `sk-ant` key. (The grep would have printed a key; it didn't.)
- **BG-1 (F16 defense-in-depth) VERIFIED (source):** bareguard `secrets.js` now default-on key-aware redaction
  walk: `DEFAULT_SECRET_KEYS=["apiKey","api_key","authorization"]` + `Bearer …`/`sk-…` value patterns,
  `redactKeys:false` opt-out, `cfg.keys` extend. Matches the relayfact↔bareguard settled spec exactly. Wired
  default-on at gate.js (redaction is audit-only; eval sees real action → policy-reproduction intact).
- **BA-2 shell_write** EXISTS (tools/shell.js) — gating behavior NOT re-run by me (trusted maintainer POC).
- BA-3/BA-4/BA-5/BA-6/BA-7 shipped (example fixes, persona, docs). BA-5/F15: workers DO emit
  `loop:tool_call`/`loop:tool_result` to `ctx.stream` — confirmed live in probe-04.
- **Honest gaps (trusted, not re-run by me):** bareagent's 696-pass suite; BA-2 deny path; broad no-regression.

## SPIKE 1 — grounding seam survives decomposition — PASSED (probe-04, the headline result)
`poc/probe-04-spike1-grounding.mjs` + `poc/fixtures/multi/` (one UNSATISFIABLE slice: fc(4)===true AND ===false)
+ `poc/fixtures/multi-ok/` (control, all solvable). Forced flat fan-out (count:3, **maxDepth:1**), opts.evaluate =
GLOBAL predicate (whole `node --test` suite), `synthesize:'concat'` (NO LLM merge — §2 honored), ctx.stream wired.
- **Result:** `multi` → top `pass:false` (suite RED), ungrounded slice CAUGHT, never faked green, exit 0 spike.PASS.
  `multi-ok` → top GREEN converged. **RC-10 receipts prove the mechanism: top node graded by relayfact's
  predicate; ALL 3 children `verdict=null`** (recurse strips evaluate on delegation, F13, confirmed empirically).
- **Answer to PRD §8.1 Spike-1 + §10 risk:** YES — a GLOBAL top predicate catches an ungrounded intermediate
  node even though children aren't individually graded. Doctrine validated. (Both PRD sections updated to RESOLVED.)
- **Proof it can FAIL (not rigged):** control failed RED 6 times before passing — only green when all 3 files were
  genuinely correct. Every wrong artifact → red, never faked.

## New findings this session (FINDINGS.md F12–F20; F1–F11 prior)
- **F12** persona seam was a real code gap → SHIPPED upstream as `opts.persona` (augments, carries down, not on verifier).
- **F13** recurse children STRIP contract/evaluate on delegation → grounded close is TOP-node-only (documented; works-as-intended). Confirmed empirically by Spike-1 receipts (children verdict=null).
- **F14** onToolResult not threaded to recurse workers — N/A (caps are bareguard's via ctx.policy+ctx.onLlmResult, both threaded; onToolResult only adds per-principal audit, moot single-tenant).
- **F15** recurse workers have no onToolCall hook → observe via audit + RC-10 receipts + ctx.stream (affects §7 observer).
- **F16** 🔴 the API-key-in-audit leak (see BA-1/BG-1 above). VERIFIED FIXED.
- **F17** recurse halts CLEANER than refine on budget cap — because it's single-pass (no retry to amplify the deny). F11 doesn't reproduce.
- **F18** recurse over-decomposes at maxDepth>1 w/ weak model (forced count:N doesn't bound DEPTH). Mitigation: maxDepth:1 flat.
- **F19** recurse decomposition STRIPS concrete context (abs paths/cwd) from child subtasks → child can't locate its file (workers guessed ./~//tmp). Mitigation: re-inject working dir via opts.persona (the carries-down channel).
- **F20** the self-healing CEILING, measured: haiku control took 6 scaffolds to go green (over-decomp, read-subtasks, path-mangling, read-thrashing, no-path-context, dropped `export`). **The limiting factor is the WORKER, not the close — the grounded close held through ALL 6 failures.** (Only haiku tested; stronger model = benches-prd A/B, not run.)

## litectx memory-loop design (this session's big design thread — NOT yet built)
**Q the user pushed:** litectx is for memory — why didn't it stop the 6 repeat fumbles? **A:** probe-04 had NO
litectx wired (scoped out); and the "6 tries" learning was ME editing the persona, not the system recalling.
**Maintainer framing (correct):** "notice failure + inject at right time" = 3 jobs: (1) store+recall by meaning =
litectx; (2) NOTICE failure = a judge → belongs to the LOOP (no-LLM-inside moat / R-S8); (3) INJECT proactively =
SELECT/auto-inject = litectx KILLED it (75% noise, proven negative). litectx is REACTIVE by identity: loop owns
WHEN, litectx owns WHAT-comes-back. Not a gap — two deliberate refusals + a boundary.
**My evidence-grounded sharpenings:** (a) separate "recall a durable LESSON" (memory) from "thread current
CONTEXT" (F19 — don't launder run-state through the store); (b) PERSONA (always-on) BEAT recall for my common
fumbles → memory's edge is the LONG TAIL (too many/sparse to always-state), not the common case; (c) deterministic
sensor caught 100% of fumbles (incl. forgot-export = module-load fail) → no model judge needed at the leaf.
**The capability = retry-with-recall around each leaf:** generate → verify(DETERMINISTIC first) → pass?return :
fail? recall(error-keyed lesson)+feed GAP back → retry(bounded by guards). New lesson → `remember` to litectx.

## NEW bareagent asks logged (UPSTREAM-FIXES.md) — for maintainer to build, relayfact to verify
- **BA-8 (F17) leaf retry-with-recall seam:** recurse builds+runs the leaf SINGLE-PASS, so relayfact CANNOT wrap a
  leaf in retry-with-recall today (recurse owns leaf construction, F12). Ask: let a leaf optionally be a bounded
  `refine` loop (deterministic sensor → gap-feedback + recall → retry). Without it, only TREE-level retry is
  buildable (refine AROUND recurse — re-runs the whole tree, 3× work). **The user said "add it to bareagent and I
  will verify it" → user/maintainer is BUILDING BA-8/BA-9 next.**
- **BA-9 (F19) thread read-only context blob to children:** so a sliced worker knows where its artifact lives.
  Distinct from BA-8's "lesson to recall." Workaround until then: persona re-injection.

## Ownership map of the delivered flow (told to user)
- **litectx** = memory: store+recall by meaning, reactive, never judges/pushes.
- **bareagent/recurse** = skeleton: decompose, thread context (BA-9), leaf retry loop (BA-8), guards, synthesize. Ships refine + remember as parts.
- **relayfact** = judgment/glue: contract, the deterministic close, persona, "is this a lesson?", final backstop check.
- **the model** = writes the code; the ceiling.
- Rule: memory=WHAT; loop=WHEN(ask/failed/retry); relayfact=what "done" means (deterministic, never model self-grades).
- Honesty: retry-with-recall mostly pays off ACROSS runs; in-run the deterministic check+gap does the work, recall is a nudge.

## Docs updated this session
- `docs/01-product/relayfact-prd.md` — status/§0/§5/§5.1/§8/§8.1/§10 reconciled to shipped recurse; Spike-1 marked ✅ DONE; §10 grounding-survives-decomposition RESOLVED.
- `docs/00-context/FINDINGS.md` — F12–F20 + ✅ Spike-1 RESULT + F16 verified-fixed stamp.
- `docs/00-context/UPSTREAM-FIXES.md` — BA-1..BA-7 shipped, BG-1 verified, **BA-8/BA-9 added (open, for maintainer)**. (Maintainer edits this doc live too.)
- `CHANGELOG.md` + `CLAUDE.md` — v2 unblocked/reconciled.
- `.gitignore` — added multi/multi-ok fixture working copies (ma/mb/mc.js).

## Open items / NEXT
1. **NOTHING COMMITTED** — whole tree still untracked (?? .claude/ .gitignore CHANGELOG.md CLAUDE.md README.md docs/ package.json poc/). User's call on initial commit granularity. New: poc/probe-03/04 + fixtures/multi*.
2. **User/maintainer is building BA-8 + BA-9.** On delivery: verify-shipped-vs-spec (same as BA-1: run, observe). Offered to draft relayfact-side retry-with-recall wrapper meanwhile.
3. **Remaining spikes:** Spike 2 (fan-out-with-handles — the ctx.litectx={recall} handle socket, DISTINCT from v1's liteCtxAsStore Store mount); Spike 3 (boundary-mapping at depth). Memory-loop spike (retry-with-recall) likely supersedes/merges Spike 2.
4. **Cross-cutting rule:** every recurse spike runs under a bareguard Gate with maxDepth/maxChildren/budget caps (the "cost open by design" ⚠️ is proven real — F18).
5. Stray litectx doc `docs/plans/2026-06-12-graph-substrate-design.md` still in-tree (user's call to delete).

## Doctrine reminders
- Consume, don't build. Missing primitive = a finding → UPSTREAM-FIXES → WAIT for the lib (verify-shipped on return). No workarounds grown in relayfact. poc/ is throwaway.
- Prove don't assert: the test must be able to FAIL (Spike-1 control failed 6× before passing = proof). Verify, don't assert (distinguish ran-and-saw from trusted).
- Ground on executable verification; rubric advisory only, never the sole close (incl. at synthesis → use concat/predicate, never 'merge'-only).
