# relayfact — probe-02 complete (v1 POC closed) + v2 replanned on recurse() (2026-06-29)

**Status:** v1 POC fully validated end-to-end (all 5 exit criteria, live, with controls that can fail).
v2 outer engine **re-planned around bareagent `recurse()`** (consumed, not built). **Build now PAUSED
pending recurse() delivery** (user decision). Continues
`2026-06-25-relayfact-prd-locked-and-poc-inner-loop.md` (that stash = v1 PRD lock + probe-01).

## What relayfact is (unchanged)
Experiment: autonomous "senior dev" runner **assembled** from bareagent (loop) + litectx (memory) +
bareguard (leash). Builds **no primitives**. Grounds the loop on **executable verification** (checks that
can fail). Narrates itself as a JSONL event stream. Graduates or gets archived.
- Repo: `~/PycharmProjects/relayfact` == `~/Documents/PycharmProjects/relayfact` (same inode, shared state).
- Primary goal: learn CE + validate the 3 libs (useful/complete/proper?). Secondary (falsifiable): a loop
  self-heals exactly to the degree its acceptance criteria compile to GROUNDED evals (predicate/agentic);
  rubric-only+uncertain = the HITL boundary. relayfact MAPS where that boundary falls (counted, not vibes).

## This session — what got built & proven (poc/, all throwaway)

**probe-02-real-attempt.mjs** — the real gated attempt, swaps probe-01's fake `attempt` for a bareagent
`Loop` (senior-dev persona) that edits files through a bareguard `Gate`, with litectx mounted as the store.
Fixtures `sum`/`csv`/`stuck`; `RELAYFACT_MAX_COST_USD` knob. The ONLY tool relayfact supplies is
`edit_file` (gated `action.type:'write'`). Run: `ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-02-real-attempt.mjs <fixture>`.

**probe-02-gate-check.mjs** — gate-enforcement NEGATIVE controls (no tokens): proves the gate DENIES
(not just allows) — out-of-scope read/write incl. sibling test file, `rm -rf /` floor, unlisted `cat`,
shell-metachar smuggle. It failed first (my assertions too narrow), then passed for the right reasons.

**Fixtures:** `sum` (trivial smoke), `csv` (fiddly CSV parser, real difficulty), `stuck`
(**unsatisfiable by construction** — one value asserted == 'even' AND == 'odd'; writes scoped to the
source file so the agent can't edit the test → honest-fail control with a REAL attempt).

### v1 exit criteria (PRD §8) — ALL met, live:
- (a) closes real failing task autonomously — sum + csv red→green, exit 0.
- (b) **fails honestly** with a real attempt — `stuck` → `loop.escalated maxIterations`, exit 1, agent
  diagnosed "genuinely impossible," never faked green.
- (c) bareguard caps cost + **halts cleanly** — `maxCostUsd=0.0001` → `loop.halted` at iter 1, ~$0.0021,
  no retry; enforcement proven by gate-check negatives.
- (d) litectx mounted via `liteCtxAsStore` + **ranked recall consumed** — seeded 3 facts, relevant CSV
  lesson ranked top@3.681 over 2 distractors, injected into prompt.
- (e) ≥1 grounded finding — six (F6–F11).

## Findings logged this session (FINDINGS.md F6–F11)
- **F6** — bareagent ships no file-write tool a coding agent needs (→ relayfact's `edit_file`; upstream candidate).
- **F7** — `wireGate` default translator emits `{type:toolName}` and does NOT activate bash/fs primitives;
  the shipped `with-bareguard.mjs` example's `bash.allow`/`fs.readScope` are **dead as written**. Fix:
  custom `actionTranslator` (shell_read→read, shell_run→bash{cmd}, edit_file→write{path}).
- **F8** — gating edits THROUGH the shell is impractical (redirection is a metachar that `bash.allow`
  force-denies) → the real fix is a write tool emitting `action.type:'write'`. F6+F8 = a real completeness gap.
- **F9** — bareguard enforcement is layered & correct (denyPatterns floor → ask → allowlist).
- **F10** — litectx 0.21 `LiteCtx` requires `{ root }` (NOT `{ dbPath }`); the bareagent example is stale → threw.
- **F11** — a bareguard halt via `humanChannel`-deny does NOT throw/stop the loop (the Loop denies one
  action & returns normally → refine retries & keeps spending). Workaround: latch a `halted` flag in
  humanChannel, throw from `attempt` so refine exits at iter 1. OPEN/unverified: `{decision:'terminate'}`
  may be the intended HaltError path (rate-limited before confirming).

## Key API ground-truth (verified from source this session)
- tool object shape: `{ name, description, parameters:{JSONSchema}, execute:async(args)=>res }`; Anthropic
  provider maps `parameters→input_schema`. Default model `claude-haiku-4-5-20251001` (used on purpose: small).
- `createShellTools()` → `shell_read`/`shell_grep`/`shell_run`(argv)/`shell_exec`(raw). No write tool.
- `new Loop({ provider, system, policy, onLlmResult, onToolResult, onToolCall, onError })`;
  `loop.run(messages, tools, {system})`. System message extracted by provider.
- `wireGate(gate, { actionTranslator })` → `{ policy, onLlmResult, onToolResult }`. bareguard checks fire
  only on `action.type` `bash`/`read`/`write`/`edit` with top-level `cmd`/`path` (`bareguard/src/gate.js:228`,
  `primitives/bash.js:28`, `primitives/fs.js:49,76`). `within(p,b)= p===b || p.startsWith(b+'/')` → can
  scope writeScope to ONE file.
- `refine` breaks on `verdict.status==='failed'` (terminal) or pass; HaltError "propagates as clean exit,
  never caught" (`refine.js:30`) — but see F11 (humanChannel-deny doesn't throw).
- litectx: `new LiteCtx({ root })`, `await lc.ready()`, `new Memory({ store: liteCtxAsStore(lc) })`,
  `memory.store(text,meta)` / `memory.search(q)` → `[{id,content,metadata,score}]`.
- bareguard 0.9.0 exports `Gate`; litectx 0.21.0 exports `LiteCtx`/`liteCtxAsStore`/`Memory`-store/`assemble`.

## THE BIG PIVOT — v2 replanned on recurse() (RLM_PRD)
Read `~/PycharmProjects/bareagent/docs/01-product/RLM_PRD.md`. `recurse(task, ctx, opts)` =
decompose→fan-out(fresh-context workers)→verify→synthesize, one depth knob (`maxDepth=1`⇒flat fan-out).
Pre-POC in bareagent (drafted 2026-06-26). **User decision: WAIT for its delivery before resuming; use its
PRD style; recurse is the driving engine.**

**The fit (now in relayfact PRD §0):** recurse() SUBSUMES relayfact's hand-wired v2 `Planner`+`runPlan`
outer loop and adds verify+synthesize+bounded-recursion.
- **recurse owns:** decomposition / fan-out / synthesis / worker isolation / guards (bareguard) / tree receipts (RC-10).
- **relayfact owns:** the **`opts.evaluate` slot** = its executable close (predicate/agentic; rubric
  advisory) — THE load-bearing seam & doctrine anchor; the senior-dev worker persona; PRD→evals
  compilation; the tree observer. recurse's RC-8 ladder ALIGNS (predicate before rubric) — same doctrine,
  two scales. The grounding/HITL boundary is now mapped PER-NODE across the tree (richer experiment).
- v1 (single-task worker+refine) = recurse's **depth-0 base case, unchanged, recurse-independent**.
- CRITICAL constraint: relayfact MUST override recurse's rubric-capable default Evaluator with its
  executable evaluate — INCLUDING at synthesis (a rubric-only reduce = the self-judgment close §2 forbids).

## POC-rerun decision (PRD §8.1) — answered for the user
Existing probes do **NOT** re-run (they validate the worker+grounded close = recurse's depth-0 base case).
On delivery: ONE cheap *replay-through-recurse* reconciliation (maxDepth=1) + THREE new spikes for the
decomposition layer: (1) grounding seam holds across nodes incl. synthesis [riskiest, POC first];
(2) fan-out-with-handles vs flat (co-validates recurse spike-1); (3) boundary-mapping at depth. No POC invalidated.

## Docs updated this session
- `docs/01-product/relayfact-prd.md` — §0 added (recurse decision, RLM-PRD style); §3/§4 recast on
  recurse; §5 + §5.1 (opts.evaluate seam + ownership table); §8 v2 replanned BLOCKED-on-delivery + §8.1
  (POC-rerun answer); §10 risks. v2 shape flagged **provisional** (reconciles vs shipped API).
- `CHANGELOG.md` — STARTED this session (Keep a Changelog); Unreleased has POC entries + the recurse replan + build-pause.
- `README.md` — status line (paused pending recurse), probe-02 run section.
- `CLAUDE.md` — loop one-liner + phased scope updated to recurse.
- `.gitignore` — fixture working copies (csv.js/classify.js), `.litectx/`, `poc/.litectx-*/`.

## Open items / next (when recurse ships)
1. **NOTHING COMMITTED** — entire tree still untracked (`?? .claude/ .gitignore CHANGELOG.md CLAUDE.md
   README.md docs/ package.json poc/`). User's call on initial commit granularity.
2. Cross-contamination still present (flagged earlier, not mine): `docs/plans/2026-06-12-graph-substrate-design.md`
   is a LITECTX doc sitting in relayfact — user's call to delete.
3. On recurse() delivery: §8.1 reconciliation + spike-1 (grounding seam) first; reconcile provisional v2
   vs shipped API, log mismatches as findings. Verify F11 `{decision:'terminate'}` hypothesis.
4. Honest residue: only haiku tested; csv solved in 1 iter (less hard than hoped) — honest-fail rests on
   `stuck` control. rubric/HITL boundary not yet stress-mapped (that's the v2/tree measurement).

## Doctrine reminders
- Consume, don't build. recurse is a bareagent primitive → relayfact CONSUMES it (wanting to build a
  "consume" row = a finding, not code). poc/ is throwaway. Surface issues to FINDINGS, no papering over.
- API key via `pass amr/claude_api`, injected at runtime, NEVER in tree (F5 resolved).
