# Autonomous "senior dev" agent — design discussion (no code)

**Date:** 2026-06-25
**Status:** Open design discussion. No code written, no decisions locked. Discussion-mode (user: "no one shot suggestions on design choices").

## The idea

User wants to design a **full automation agent** — a "senior software developer" that:
- takes a user request → builds a PRD → then keeps iterating in a loop/workflow to deliver
- **maximum autonomy**, minimum HITL — asks only when it **can't solve** something or hits a **contradiction** with its governing principles
- delivers against **predefined principles**: AGENT_RULES.md + the PRD as the contract
- one interface, few questions
- **stated goal: a learning vehicle** — "try context engineering and get a feel for agentic automation and creation." (This reframes priorities: observability > raw autonomy.)

## Where it lives (the 3-lane split does the architecture for free)

- **bareagent owns the loop** (plan → act → verify → replan). The autonomous driver IS bareagent. This is the lane the generator/evaluator carrier brief (2026-06-22 stash) already put it in.
- **litectx is the substrate** — PRD, task graph, decisions, "what I already tried" all live as memory (`remember`/`recall`, episodes, `scoped` per-task isolation, `assemble` to fit context, `contextgraph` to trace). **No LLM inside litectx** (moat) — it supplies substrate, adds no loop code.
- **bareguard is the leash** — token budget, trust gates, "stop and ask" trip-wires.

## The one tension that governs everything

A naive "agent builds → grades own work → loops until satisfied" is **already falsified**: R-S8 (no usable per-query confidence threshold) + the GAN-eval result. **The loop cannot be closed by LLM self-judgment.**

→ The loop must be **grounded by executable verification**: tests / typecheck / lint / build are the stop condition (they can *fail* — prove-don't-assert applied to the loop itself). PRD acceptance criteria should compile to executable checks. LLM-as-judge shrinks to the narrow "does this match intent" slice — and *that's* where HITL lives, not where self-grading lives.

## Loop topology (recommended)

Two nested loops, not a flat pipeline and not one undifferentiated loop:
- **Outer (planning):** request → PRD → task graph. Re-entered only when a task reveals the plan was wrong.
- **Inner (execution), per task:** implement → run that task's verification → fix → until green or budget-tripped. Tasks isolated via `scoped` so failures don't bleed.

Skeleton already exists: the `1-create-prd` / `2-generate-tasks` / `3-process-task-list` Claude Code subagents = the AI-Dev-Tasks flow. Autonomy work = rip out their per-task human approval, replace with the executable gate. **Lean: reuse those three as phases inside the loop, don't rewrite.**

## HITL trigger model — ask gated by reversibility + groundability

Asks only when:
1. PRD ambiguity that materially changes scope — **batch up front** (create-prd already does discovery).
2. A decision with **no safe default** AND **hard to reverse** (auth model, persistence schema).
3. Verification passes but intent ungroundable by tools.
4. bareguard budget/trust trip-wire fires.

Caveat surfaced: "contradicts the principles" splits —
- **Mechanical** AGENT_RULES violation (disallowed dep, broke ESM/JSDoc rule, out-of-scope file touch) → catchable by lint/check, no model judgment.
- **Semantic** drift ("violates spirit of the PRD") → LLM judgment = R-S8 territory, unreliable. Mitigated (not eliminated) by **recitation** + cheap periodic checkpoints. Don't oversell "it'll ask when it's wrong" — it asks when it's *stuck* or a *check fails*; wrong-but-confident is the residual.

## Research findings — pi.dev + Manus (2026-06-25)

**pi.dev** = minimal coding-agent harness. One core, four front-ends: interactive TUI, `pi -p` print/JSON, RPC over stdin/stdout, SDK. Explicitly **human-steered** (steering msgs interrupt after current tool; follow-ups wait; rewindable tree history; mid-session model switch). Context = AGENTS.md + auto-compaction + skills + RAG extensions.
→ Useful as the **harness shape** (one core, many front-ends — confirms: build engine as lib+SDK, hang CLI/TUI/web off it). NOT an autonomy model; autonomy comes from the loop + grounding, not the harness.

**Manus** context-engineering lessons map ~1:1 onto litectx's CE primitives:
- Offload to **filesystem** ("ultimate context — unlimited, persistent") ↔ **Write** (litectx SQLite graph, but *queryable* not grep'd)
- Reduce (compaction) ↔ **Compress** (`compress`/`assemble`)
- Retrieve (file-search) ↔ **Select** (`recall`/`get`, ranked not grep)
- Isolate (multi-agent) ↔ **Isolate** (`scoped`)
- Cache (KV-cache) ↔ harness concern

Three Manus lessons shaping the loop:
1. **Recitation beats drift** — continuously rewrite + re-inject `todo.md` so the plan stays in recent attention. For us: PRD/AGENT_RULES + task graph recited every iteration via `assemble`, not loaded once and forgotten 40 tool-calls deep. *The* anti-drift mechanism.
2. **KV-cache is a hard constraint** (avg 100:1 in:out, ~50 tool calls/task): stable prompt prefix, append-only context, **don't add/remove tools mid-run** (mask instead). Cheap now, expensive to retrofit. Argues against per-task toolset reshaping.
3. Frontier models for cache infra (already on Claude).

Headline: **litectx is the spine, not a side-feature.** Manus re-greps; litectx recalls (ranked). Same "external memory" move, better substrate.

## Interface decision

Thin entry, heavy engine. The thing the user *runs* = one line (`bareagent build "<request>"` CLI or `/build` slash). The thing that *runs* = a **Claude Agent SDK headless loop** that owns control flow + checkpoints state to litectx + resumes. NOT the interactive Claude Code session as driver (context grows unbounded, dies on crash); NOT the Workflow tool (one-turn fan-out, wrong shape for long-running resumable human-checkpointed loop).

**Web UI = for OBSERVABILITY, not autonomy.** You can't *feel* a headless loop, and "get a feel for context engineering" is the stated goal. Paradigm (Manus/Devin): **dual-pane** — left conversation (few HITL touchpoints), right live "computer" (tool calls streaming + plan/todo pinned showing recitation). For us the right pane is a **context-engineering microscope**: surface what `recall` returned, what `assemble` dropped to fit budget, which episode fired. Architecture stays clean: **engine emits an event stream** (plan updated, tool called, recall returned, verification passed/failed, escalation raised); UIs (web + CLI) are just listeners. Build "a loop that narrates itself," not "a web app with an agent in it."

## Open forks (not yet decided — pick up here)

1. **Memory substrate, day one vs proven swap** — commit to litectx as the agent's external memory immediately (recall/assemble in loop), OR start with the dumb-but-proven Manus move (write everything to files + grep) and swap litectx in once the loop works? *I leaned*: dumb-files-first for the first working loop, then **prove** litectx beats grep on the same loop (prove-don't-assert → a real A/B, not an assumption the graph helps).
2. **First front-end** — TUI (fastest, terminal-native) vs web dual-pane (slower, but the actual "feel CE" instrument)? *I leaned*: build **event-stream + barebones web pane** before a pretty TUI, because the microscope is the point.

**Next prompt to user was:** nail the loop's control structure, or sketch the event-stream/UI contract? — awaiting steer.

## Sources
- https://pi.dev
- https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- https://www.zenml.io/llmops-database/context-engineering-strategies-for-production-ai-agents
- https://rlancemartin.github.io/2025/10/15/manus/
