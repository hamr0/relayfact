```
                    ╭───────────────────────────────────────╮
                    │  ╦═╗╔═╗╦  ╔═╗╦ ╦╔═╗╔═╗╔═╗╔╦╗          │
                    │  ╠╦╝╠╣ ║  ╠═╣╚╦╝╠╣ ╠═╣║   ║           │
                    │  ╩╚═╚═╝╩═╝╩ ╩ ╩ ╩  ╩ ╩╚═╝ ╩           │
                    │   request ──→ verify ──→ deliver      │
                    │       ↑                     │         │
                    │       └─────────────────────┘         │
                    ╰──╮────────────────────────────────────╯
                       ╰── context engineering, kept light

```

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/hamr0/relayfact?label=version&color=2a4f8c" alt="version (auto from package.json)">
  <img src="https://img.shields.io/badge/license-Apache%202.0-2a4f8c" alt="license: Apache 2.0">
  <img src="https://img.shields.io/badge/built%20on-bare%20suite-2a4f8c" alt="built on the bare suite">
</p>

**Context engineering doesn't have to be heavy, locked-in, or complicated. relayfact is the lightweight counter-example — an autonomous senior-dev runner assembled from [bareagent](https://github.com/hamr0/bareagent) + [litectx](https://github.com/hamr0/litectx) + [bareguard](https://github.com/hamr0/bareguard), building no primitives of its own.**

A plain-English request goes in; a *verified* result comes out — a green artifact, or an honest, decision-ready escalation when the machine shouldn't decide alone. Under the hood it uses two things and only two things: **RLM** (recursive decompose → fan-out → verify → synthesize) to do the work, and **executable evals** (checks that can actually *fail*) to decide when it's done. Everything it does, it narrates as an append-only event stream. No framework, no orchestration plumbing, no rented infrastructure — just the three bare-suite libraries wired together and grounded on truth.

relayfact is an **experiment with a bar**: it either graduates into its own thing or gets archived. It graduated. This is the first build.

---

## Why it exists

Two questions, answered by building rather than asserting:

1. **Is the bare suite real?** relayfact is the suite's first serious consumer in a genuine context-engineering environment — every rough edge it hits is filed as a finding against the library, never papered over. *(See [FINDINGS.md](./docs/00-context/FINDINGS.md).)*
2. **Does context engineering have to be complicated?** The industry answer is heavyweight frameworks, vendor lock-in, and thousand-line config. relayfact's answer is a small assembly of composable parts where the leverage lands on you, not a platform — CE as a handful of primitives, not a product you rent.

A third, quieter goal runs underneath: **map the boundary where an agent can heal itself and where a human must step in.** A loop can close on its own exactly as far as its acceptance criteria compile down to *grounded* evals; the moment a criterion is only a matter of judgment, that's the handoff line. relayfact counts where that line falls instead of guessing.

## The thesis, in one line

> A loop is only as trustworthy as the checks that can fail it. Give it recursive reasoning for the work and executable verification for the truth — and context engineering stops needing to be heavy.

---

## What's inside

relayfact composes one pipeline — **request → deliver | escalate** — out of small pieces. Each piece consumes a bare-suite library rather than reinventing it:

| Piece | What it does | Consumes |
|---|---|---|
| **Pre-flight** | Asks "does this request even make sense?" — a bounded gate that can *open* a clarification but can never green-light the work by itself | bareagent `Loop` |
| **Close compiler** | Turns the prose spec into an *executable* acceptance test, then proves the test is worth trusting — it catches a stub, demands a correct implementation pass, and kills deliberately-broken mutants | bareagent `recurse` · bareguard gate |
| **The grounded close** | Runs a real command — tests, a typecheck, or a deployed-and-probed artifact — and takes the exit code as truth. The one thing in the system that can *fail* | bareagent `Evaluator` / `Verdict` |
| **The worker** | A gated implement loop: it edits only the source, never the test; a red close feeds the gap forward and it tries again | bareagent `recurse` · `refineLeaf` · bareguard gate |
| **Memory** | On each failed close it widens recall over a bounded store — the *test* drives what gets remembered, not similarity ranking | litectx |
| **Independent GOLD** | A hidden arbiter that catches a suite quietly fit to its own answer: own-tests-green **but** GOLD-red ⇒ never deliver | relayfact |
| **Event spine + observer** | Every step appends one JSONL line; every view is a pure listener that reads only the log — never the engine | Node stdlib |
| **Escalation** | When the evals genuinely can't close it, it hands back a *decision-ready* report — the goal, what was tried, and the exact choice it needs from you | relayfact |

The whole thing runs under one leash and narrates itself. That's the product.

---

## How it decides (RLM + evals)

The two ideas doing the heavy lifting deserve a closer look — because between them they are the entire reason relayfact can be lightweight and still be trusted.

**RLM — recursion for the work.** Hard requests aren't solved in one shot; they're *decomposed*. bareagent's `recurse` breaks a task down, fans the pieces out, verifies, and synthesizes — Recursive Language Models as a single primitive, composed *around* the worker loop rather than bolted on as a new engine. relayfact supplies only a senior-dev stance, one file-editing tool, and the close; recurse does the orchestration.

**Evals — verification for the truth.** relayfact refuses to let a model grade its own homework. Three eval tiers, in order of strength: a **predicate** (a deterministic command — no tokens, pure pass/fail), an **agentic** check (deploy the artifact and probe it live), and a **rubric** (LLM judgment). The rule that keeps the whole thing honest: **a rubric is advisory only — it can open a question, it can never close the loop.** Only a check that could have failed is allowed to certify success, and the worker is write-scoped so it *cannot* fake a green by editing the test.

Put together: recursion proposes, executable verification disposes, and the residue — the genuinely uncertain slice where no grounded check applies — is exactly where relayfact escalates to a human instead of pretending.

---

## The bare suite it's assembled from

relayfact builds **no primitives**. If it ever "needs" one, that's a finding against a library, not new code to grow here. Three libraries do all the load-bearing work:

- **[bareagent](https://github.com/hamr0/bareagent)** — the loop and the RLM engine. *Goal in → coordinated actions out.* relayfact plugs a persona, an edit tool, and its grounded close into `recurse`; bareagent builds the worker.
- **[litectx](https://github.com/hamr0/litectx)** — the memory substrate and context-engineering verbs (write / select / compress / isolate). *Query in → ranked recall out.* relayfact uses it as a close-driven memory that the failing test steers.
- **[bareguard](https://github.com/hamr0/bareguard)** — the leash. *Action in → allow / deny / ask-a-human out.* It caps cost, halts cleanly, audits every action, and write-scopes the worker to the implementation — the reason a green result can't be faked.

**Deliberately *not* used:** barebrowse, baremobile, beeperbox. relayfact is a single domain (senior dev), a single process, and — by doctrine — no web UI before the loop closed. Its only interface is a CLI observer that replays the event log.

---

## Status

**Graduated — v0.1.0, the first shippable build.** The experiment cleared its bar: a request runs end-to-end through the assembled pipe, closes on grounded evals with an independent GOLD arbiter, and comes back green-or-escalation — demonstrated on real tasks with the grounded-vs-judgment split counted per task.

Honest bounds, stated plainly: this is an experiment, not a benchmark. Runs are small-*n*, results are model-modulated, and the self-healing ceiling is the *worker* (the model), not the close — the grounded check held through every observed failure. The full trail lives in [CHANGELOG.md](./CHANGELOG.md), the friction log in [FINDINGS.md](./docs/00-context/FINDINGS.md), and the governing spec in [`docs/01-product/`](./docs/01-product/).

## The bare ecosystem

Local-first, composable agent infrastructure. Same API patterns throughout —
mix and match, each module works standalone.

**Core** — the brain, the gate, the memory.

- **[bareagent](https://github.com/hamr0/bareagent)** — the think→act→observe loop, plus RLM. *Goal in → coordinated actions out.* Replaces LangChain, CrewAI, AutoGen.
- **[bareguard](https://github.com/hamr0/bareguard)** — the single gate every action passes through. *Action in → allow / deny / ask-a-human out.* Replaces hand-rolled allowlists and scattered policy code.
- **[litectx](https://github.com/hamr0/litectx)** — tree-sitter code + memory graph with activation decay, plus lightweight context engineering (write · select · compress · isolate). *Query in → ranked context out.*

**Optional reach** — give the agent hands.

- **[barebrowse](https://github.com/hamr0/barebrowse)** — a real browser for agents. *URL in → pruned snapshot out.* Replaces Playwright, Selenium, Puppeteer.
- **[baremobile](https://github.com/hamr0/baremobile)** — Android + iOS device control. *Screen in → pruned snapshot out.* Replaces Appium, Espresso, XCUITest.
- **[beeperbox](https://github.com/hamr0/beeperbox)** — 50+ messaging networks via one MCP server (headless Beeper Desktop in Docker). *Chat in → unified message stream out.* Replaces Twilio, per-platform bot APIs.

**Assembled here:** relayfact is what you get when you wire the **Core** three together and ground the loop on evals — an agent that ships verified work. The **Optional reach** hands are deliberately left off (single domain, single process).

**Why this exists:** most context-engineering stacks ship a platform before you've written a line. This one doesn't — it's a handful of small libraries and the discipline to ground every claim on a check that can fail. Install, import, go.

## License

Apache License, Version 2.0 — see [LICENSE](LICENSE).
