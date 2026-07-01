# relayfact — Agent Context

**relayfact** is an experiment: an autonomous "senior dev" runner **assembled** from the bare suite —
`bareagent` (the loop), `litectx` (memory substrate), `bareguard` (the leash). It builds **no
primitives**. It relays a request through those libraries, grounds the loop on **executable verification**
(checks that can *fail*), and **narrates itself** as an event stream. Primary goal: learn context
engineering and validate the three libs' primitives (useful? complete? proper?). Secondary: probe whether
an agent can self-heal / build its own framework — answered by mapping where the eval-grounding boundary
falls. It either **graduates** or gets **archived**. That bar is the point.

## Source of truth — read these first

These govern; this CLAUDE.md only adds relayfact-specific doctrine. When anything here disagrees with
them, **they win**.

1. **`.claude/memory/AGENT_RULES.md`** — parent standard: Spec→Verify→Environment, POC-first,
   prove-don't-assert (the test must be able to fail), dependency hierarchy (vanilla → stdlib → external),
   simple-over-clever, surgical changes, the Testing Trophy, security invariants, responsive-web-once-graduated.
2. **`docs/01-product/relayfact-prd.md`** — the single PRD that guides development (goals, non-goals,
   architecture, the loop, the eval/grounding model, phased scope). Sections are cited as `§N`.
3. **`docs/01-product/benches-prd.md`** — the validation guide **carried from litectx**, holding prior
   bench learnings (single-run lift is narrow; cross-session persistence is the qualified win; knowing ≠
   executing; the self-evaluation trap) so relayfact doesn't re-learn them. Honor its method (controls
   that can fail, real uncrafted data, replay-through-shipped-code).
4. **`docs/00-context/FINDINGS.md`** — the running, no-papering-over log of friction with the three libs
   (grounded in `file:line`); "works as intended" is a finding too.

`.claude/memory/LIBRARY_CONVENTIONS.md` is mostly **N/A** — relayfact is an application/experiment, not a
published library. It applies only if relayfact ever graduates into a shipped lib; until then take from it
only the always-true hygiene (pure ESM, JSDoc, no secrets).

## relayfact doctrine — the dos & don'ts

- **Consume, don't build.** loop/planner/evaluator/memory/gate/transports all exist. If relayfact "needs"
  a primitive, that's a finding against the lib, not something to grow here.
- **Ground the loop on executable verification.** `predicate` (deterministic, can fail) and `agentic`
  (exercises the artifact) are the close conditions. **`rubric` (LLM judgment) is advisory only, never
  the sole close** — R-S8 + GAN are settled. (PRD §5.)
- **Self-healing ceiling = the rubric residue.** A loop self-heals only as far as criteria compile to
  grounded evals; rubric-only + uncertain = the HITL boundary. Mapping that boundary is the experiment.
- **No agenticSeek shape.** No query router, no Docker/Redis/SearxNG, one domain (senior dev), single process.
- **Event-stream spine.** Engine emits a sequenced append-only JSONL log; every UI is a pure listener.
  No web UI before the inner loop closes. (PRD §7.)
- **Surface issues, no papering over.** Log to `FINDINGS.md`; fix upstream at the lib (propagate from the
  `hamr0` origin where relevant) or stop — never a silent workaround. Log path: `docs/00-context/FINDINGS.md`.
- **`poc/` is throwaway.** Never ship the POC; graduating it is a rewrite.

## The loop (one line)

**v2 outer engine = bareagent `recurse()` (consumed, not built — PRD §0; DELIVERED v0.21.1, reconciled).**
`recurse(task, ctx, opts)` decomposes → fans out → verifies → synthesizes; recurse **builds the worker
Loop**, relayfact plugs in **`opts.persona`** (senior-dev stance) + **`opts.tools`** (`edit_file`) +
**`opts.evaluate`** (the executable close — the doctrine anchor, honored over recurse's default rubric and
run on the *synthesized* result), with `ctx = { provider, policy, onLlmResult }` (the bareguard leash).
Reconciled nuance: children strip `contract`/`evaluate`, so the grounded close is **top-node-only** — it
must be a **global predicate** (the whole verify command); synthesis must never close on `'merge'` alone.
The depth-0 base case **is** v1: `refine(attempt, evaluate)` — `attempt` = a bareagent `Loop` (senior-dev
persona, litectx store, bareguard gate); `evaluate` = run the verify command → `Verdict` (exit code = truth).

## Phased scope (PRD §8)

- **v1** — inner loop / worker on one task: `refine` + real `attempt` + predicate `evaluate`, narrated to
  CLI. No recurse, no web. **POC-validated** (a–e met in `poc/`); recurse-independent.
- **v2** — full request → e2e on **`recurse()`**; relayfact supplies `opts.persona` + `opts.tools` +
  grounded `opts.evaluate` + optional `opts.synthesize` + tree observer. **UNBLOCKED — `recurse()`
  delivered (bareagent v0.21.1) and the provisional shape reconciled** (PRD §0/§5.1; findings F12–F14).
  Existing worker POCs do **not** re-run — see PRD §8.1: replay-through-recurse first (`maxDepth:1`), then
  three **gated** spikes (grounding-seam incl. synthesis; fan-out-with-handles vs flat; boundary-mapping at
  depth). Every spike runs under a bareguard `Gate` (recurse is "cost open by design").

## Dev Rules (from AGENT_RULES.md — mandatory)

**POC first.** Validate logic with a ~15min POC aimed at the riskiest assumption before building. Prove,
don't assert — measure anything you call "cheap"/"fast"; the test must be able to FAIL (real uncrafted
data, not a fixture authored to contain the result). POC works → design → build with tests. Never ship the POC.

**Build incrementally.** Small independent modules, each working end-to-end before integrating.

**Dependency hierarchy — strict:** vanilla → stdlib → external (only when stdlib can't in <100 lines).
External deps must be maintained, lightweight, widely adopted; vetted libs for security-critical code.

**Lightweight over complex. Surgical changes only. Open-source only.** No secrets in the tree (env at
runtime; only `.env.example` committed). Responsive/mobile-by-default for any web UI once past POC.

<!-- MEMORY:START -->
@.claude/memory/MEMORY.md
<!-- MEMORY:END -->
