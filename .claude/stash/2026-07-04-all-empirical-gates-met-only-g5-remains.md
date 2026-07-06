# relayfact — G1/G2/G3/G4 ALL met; lib fixes verified-shipped; only G5 remains (2026-07-04)

**Status:** Still POC (no `src/`). Continues `2026-07-03-g2-realtask-pass-ba10-shipped-bg3-ba11-filed.md`.
**Graduation gate (PRD §8.2):** **G1 ✅ · G2 ✅ · G3 ✅ · G4 ✅ — every empirical gate met. Only G5 (graduated
PRD) remains, then the graduate-or-archive call.**
**3 COMMITS THIS SESSION (all on `master`, no remote):** `143f905` (G2 stock-libs), `2b256cd` (G3), `b8aff49`
(G1 sonnet + adversarial hunt). Working tree clean except the usual `.claude/friction/*` + `.claude/memory/*`
auto-gen churn (deliberately left uncommitted) and gitignored `poc/run-probe*.jsonl` logs.
**Local lib versions (all verified-by-running this session):** **bareguard 0.11.1** · **bare-agent 0.25.0** ·
litectx 0.26.1.

## What happened this session (the arc)

### 1. Lib fixes SHIPPED + VERIFIED-BY-RUNNING (token-free), override removed
- **BG-3** (bareguard 0.11.0) — `content` deny/ask patterns now strip the write payload (`PAYLOAD_FIELDS =
  ["content","contents"]`) before matching. **Verified: `poc/probe-19-bg3-verify-shipped.mjs` 5/5**,
  control-can-fail: payload code-vocab incl. literal `DROP TABLE` → allow/`default`; `DROP TABLE`/`rm -rf` in a
  bash `cmd` → deny; `method:DELETE` → ask (via the audit's pre-human askHuman line).
- **BA-11** (bare-agent 0.25.0) — Loop short-circuits a governance deny-spin (`maxConsecutiveDenials`, default 3).
  **Verified: `poc/probe-20-ba11-verify-shipped.mjs` 4/4**, load-bearing negative control (stub provider, no LLM):
  default stops at 3, `=5` stops at 5, OFF (`Infinity`/`0`) spins to the stub cap (13).
- **BG-4/F37** (bareguard 0.11.1) — factual bug: 0.11.0 said "`PAYLOAD_FIELDS` is a new export" but the import
  threw. Owner chose **Option A** (export read-only + `Object.freeze` + reword), **declined** my option-2 config
  key (zero demand, tail-wags-dog). **Verified 4/4:** import reachable, value `["content","contents"]`,
  `Object.isFrozen` true, `.push` throws + unchanged.
- **Override REMOVED** from `poc/probe-16` (`content:{askPatterns:[]}` gone) and **G2 re-ran GREEN both arms on
  stock defaults** (F36 re-run): sonnet-5 $0.095/4 calls (BA-10 temp-fallback fired+recovered), haiku $0.088/7.

### 2. G3 — the come-back (NEW, `poc/probe-17-comeback.mjs`, F38) — PASS
- **(a) Escalation artifact (token-free):** 5 §5 stop-classes each assemble ONE decision-ready `run.escalate`
  report `{goal, whatWasTried[], blocker, decisionNeeded{question,options}, receipts, costSpent}` — every stop
  forced by REAL execution (real `refine` history / real bareguard `budget.maxCostUsd` halt / real BA-11
  deny-spin at 3 / §5 rubric-residue / pre-flight decline at 0 spend). **Control-can-fail:** `isDecisionReady`
  rejects a bare `{incomplete}`, a <2-option report, and an attempt-bearing stop with empty `whatWasTried`.
  Observer (G4) renders the `run.escalate`.
- **(b) Pre-flight `{proceed|clarify|decline}` (real haiku ~$0.05):** the two SAFETY corners held — coherent
  NEVER declined (returned `clarify`, safe HITL-open), nonsense NEVER proceeds (`decline`); soft middle fuzzy
  ("make it better" → `decline`, reported not gated) = the §5 residue from the pre-flight side.
- **Design note (parallels F32):** `recurse` persists only the `refineLeaf` summary, NOT `refine.history` —
  relayfact self-captures `(attempt,verdict,gap)` via the sensor it OWNS (`opts.evaluate`), no lib dependency.

### 3. G1 sonnet arm + adversarial fit-to-pass HUNT (`poc/probe-15`, F33 update)
- **Sonnet arm** (previously unrun, unblocked by BA-10): both base fixtures **honest + GOLD-correct** —
  money 4/4 (1 iter), csv 4/4 (3 iters). On the SAME under-spec csv haiku over-constrained, sonnet cleared it
  GOLD-correct → **under-spec→HITL boundary is model-modulated** (stronger worker needs less spec completeness).
- **Adversarial hunt** (2 NEW fixtures added to probe-15, oracle self-checked offline first): `truncate` (subtle
  "ellipsis counts toward max" length invariant) → **haiku honest 3/3**; `titleCase` (un-exampled "lowercase the
  rest" clause) → **haiku OVER-CONSTRAINED→escalate SAFE** (suite followed convention `"don't"→"Don't"` vs the
  spec's apostrophe/digit-as-separator rule `"Don'T"`; the "a correct impl must pass" reference gate FIRED),
  **sonnet honest 3/3**.
- **Sharpened mechanism (the durable claim):** a self-authored close fails EITHER by **over-constrain**
  (reference-gate-guarded — now empirically FIRED on a fresh adversarial case) OR **fit-to-pass**
  (independent-GOLD-guarded — the only guard for the mode the reference gate can't see). Across EVERY G1 run
  (money/csv/truncate/titlecase × haiku/sonnet) the ONLY failures were over-constraint, all SAFE; **fit-to-pass
  NEVER fired even on a fixture built to bait it.** Bound honestly: **unobserved ≠ impossible** (2 models, small
  fixtures) — **KEEP the independent GOLD as the standing arbiter.**
- verify-by-running caught a HARNESS bug mid-hunt (bash apostrophe-quoting artifact falsely failed the offline
  oracle-check; the fixture was sound) — the offline oracle-check discipline paid off.

## NEXT (in order)
1. **G5 — the graduated PRD** (the LAST gate item; a spec-before-build doc, not a code probe). Encodes the
   G1–G4 numbers + explicit descopes, then the **graduate-or-archive** call. **OPEN QUESTION for the user
   (asked, not yet answered):** frame G5 as a **graduate** recommendation / **archive** / **neutral decision
   memo**? My read from the evidence is **graduate-leaning** (all 4 empirical gates met, on stock libs, no
   papering-over), but that judgment is the user's.
2. After G5: the graduate-or-archive decision. If graduate → `src/` is a REWRITE (never ship the POC).

## DOCTRINE REMINDERS honored (keep honoring)
- Verify-shipped-vs-spec by RUNNING, never by reading source/trusting the maintainer note (caught BG-3/BA-11/BG-4
  all shipped correctly; caught a harness bug). Oracle self-checks OFFLINE before every token spend.
- No fit-to-pass; controls that can FAIL (isDecisionReady rejects junk; adversarial fixtures oracle-checked).
- Claim only at the altitude the construction supports; name every fail-mode; fit-to-pass unobserved ≠ excluded.
- Surface→fix-at-the-lib→verify (BG-4 filed + fixed same day). Key via `pass amr/claude_api` runtime-injected;
  GPG pinentry expires mid-session — run token probes back-to-back while warm. `poc/` is throwaway.
- Doc source-of-truth updated every step: FINDINGS (F35/36/37/38 + F33 update), UPSTREAM-FIXES (BG-3/BG-4/BA-11),
  PRD §8.2 (G2/G3/G1) + NEW §8.3 (build-to-date inventory + pipe diagram), CHANGELOG (dated entries).
