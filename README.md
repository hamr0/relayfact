# relayfact

An experiment: an autonomous "senior dev" runner **assembled** from the bare suite —
`bareagent` (the loop), `litectx` (the memory substrate), `bareguard` (the leash).
It builds **no primitives**. It relays a request through those libraries, grounds the
loop on **executable verification** (tests/typecheck/build — things that can *fail*),
and narrates itself as an event stream.

Two reasons it exists:
1. Get a feel for context engineering and agentic automation end-to-end.
2. Be the first real consumer of the three libs and **surface their issues** — see [FINDINGS.md](./docs/00-context/FINDINGS.md).

It either **graduates** to its own thing or gets **archived** as an experiment. That's the bar.

**Status:** POC phase complete (`POC → design → build`, AGENT_RULES). The `poc/` probes validated all
three libs end-to-end and every v1 exit criterion (PRD §8) — in throwaway code. **v2's outer engine is now
bareagent's `recurse()`** (consumed, not built — PRD §0), which is still pre-POC, so **the build is paused
until `recurse()` ships**. Existing POCs do not re-run (PRD §8.1). See [CHANGELOG.md](./CHANGELOG.md) and
[FINDINGS.md](./docs/00-context/FINDINGS.md).

Governing docs: [`docs/01-product/relayfact-prd.md`](./docs/01-product/relayfact-prd.md) (the PRD) ·
[`CLAUDE.md`](./CLAUDE.md) · `.claude/memory/AGENT_RULES.md`.

## The loop (grounded, not aspirational)

```
request ──▶ Planner.plan ──▶ runPlan(steps, executeFn) ──▶ result      (outer loop — v2, not built)
                                         │
                              per step:  refine(attempt, evaluate)       (inner loop — probe-01/02)
                                attempt  = gated bareagent Loop edits files (probe-02)
                                evaluate = run the step's verify command → Verdict (exit code = truth)
```

The inner loop is bareagent's `refine`; the close is bareagent's `Evaluator` **predicate** path
(deterministic, no tokens). relayfact's only new code is `attempt`, the verify-command mapping,
the event stream, and the CLI observer.

## probe-01 — the inner loop, before any LLM

Proves the harness can close on green **and fail honestly**:

```sh
npm install
npm run probe:fake   # deterministic correct fix  → loop.done   (exit 0)
npm run probe:noop   # never fixes                 → loop.escalated after 3 iters (exit 1)
```

Events stream to the console (colored) and to `poc/run-probe01-<mode>.jsonl` (append-only, diffable).

## probe-02 — the real attempt, gated, with memory

Swaps the fake `attempt` for a real bareagent `Loop` (senior-dev persona) that edits files through a
bareguard `Gate`, with litectx mounted as the store. Needs an API key (FINDINGS F5), injected at runtime
and never written to the tree:

```sh
ANTHROPIC_API_KEY=$(pass amr/claude_api) npm run probe2:sum    # trivial smoke      → red→green (exit 0)
ANTHROPIC_API_KEY=$(pass amr/claude_api) npm run probe2:csv    # fiddly CSV parser  → red→green (exit 0)
ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-02-real-attempt.mjs stuck   # unsatisfiable → honest escalate (exit 1)

# cost-cap clean halt: a tiny budget halts the loop at iter 1 rather than faking success
ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_MAX_COST_USD=0.0001 node poc/probe-02-real-attempt.mjs sum

# gate enforcement (no tokens): negative controls that MUST be denied
node poc/probe-02-gate-check.mjs
```

`stuck` is an unsatisfiable-by-construction fixture: it proves the loop **fails honestly** with a real
attempt (escalates, never fakes green). The gate confines writes to the one source file (so the agent
can't rewrite the tests), caps cost, and enforces an fs/bash scope — all proven by `probe-02-gate-check`.

> `poc/` is throwaway (CLAUDE.md doctrine). It validated the design; the shippable build is a rewrite.
