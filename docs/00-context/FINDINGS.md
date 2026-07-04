# relayfact — findings

No papering over. Every friction point with bareagent / litectx / bareguard is logged here,
grounded in source (file:line), and either fixed upstream or it stops us. "Works as intended"
is also a finding — most of these are.

## F1 — the three primitives are mature; my assumed gaps were wrong

Before reading code I floated three "gaps." All refuted by source:

- **"No unified event stream / JSONL."** Wrong. `bareagent/src/transport-jsonl.js` ships
  `JsonlTransport`, exported at `bare-agent/transports`, plus a `Stream` primitive.
- **"No conductor wiring planner→loop→evaluator."** Wrong. `runPlan(steps, executeFn, opts)`
  (`src/run-plan.js`) is a step-DAG executor with wave parallelism + lifecycle callbacks; `refine`
  is the inner generate→evaluate→regenerate loop. Only the per-step `executeFn` is left to the consumer (by design).
- **"ESM/CJS friction."** Wrong. bareagent is CJS but `examples/litectx-as-store.mjs`,
  `litectx-assemble.mjs`, `with-bareguard.mjs` are `.mjs` files consuming all three together.
  Pattern: `const require = createRequire(import.meta.url); const { Loop } = require('bare-agent')`.

**Verdict: no fixes needed to be usable.** Lesson logged against myself: assumptions wearing a finding's clothes.

## F2 — baresuite is an empty placeholder

`~/PycharmProjects/baresuite` has no `package.json` / `src` / `README`. relayfact depends directly
on `bare-agent` + `litectx` + `bareguard`. (relayfact is a *candidate* first occupant of baresuite,
not assumed to be one.)

## F3 — Evaluator predicate verdict mapping (confirmed, drives the retry loop)

`src/evaluator.js:129` — predicate path: `pass → status:'satisfied'`, `fail → status:'needs_revision'`
(NOT `'failed'`). `src/refine.js` retries on `needs_revision`, breaks on `'satisfied'` (stopOnPass)
or `'failed'` (terminal). So a failing predicate correctly **retries** up to `maxIterations`; on fail
the `contract` string becomes the next attempt's `critique`. The predicate path is a real inner loop.

## F4 — relayfact's inner loop IS `refine`

`refine({ attempt, evaluate, contract, maxIterations })` is the exact two-nested-loops inner loop
from the design. relayfact supplies `attempt` (make a change) + `evaluate` (run tests → Verdict) and
reimplements nothing. probe-01's harness therefore needs only `bare-agent`; litectx + bareguard come
in when `attempt` becomes a real Loop with a store + gate (probe-02).

## F5 — no API-key-free path exercises the real loop (open decision, not a bug)

`src/provider-clipipe.js` explicitly does **not** support tools (`toolCalls: []` always; "CLI commands
don't support tools"). So the only key-free option — pipe to the local `claude` CLI — would let *claude*
do the editing inside its own subprocess, bypassing bareagent's Loop and bareguard's gate entirely:
it would dogfood nothing. **To exercise bareagent + bareguard as intended, probe-02 needs an Anthropic
(or OpenAI) API key.** No keys currently in env (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` unset).
This is a resource decision for the user, recorded — not a library defect.

**Resolved (2026-06-25):** key available via `pass amr/claude_api`, injected at runtime
(`ANTHROPIC_API_KEY=$(pass amr/claude_api) node poc/probe-02-real-attempt.mjs …`), never written to
the tree. probe-02 ran live on it (sum + csv). Twelve-factor; no-secrets invariant intact.

## F6 — bareagent's tool suite has no file-write/edit tool (a coding agent needs one)

`tools/shell.js:344 createShellTools()` ships exactly four tools — `shell_read`, `shell_grep`,
`shell_run` (argv, no shell), `shell_exec` (raw `/bin/sh -c`). None writes a file. The other factories
(`createBrowsingTools`, `createMobileTools`, `createSpawnTool`, `createDeferTool`) aren't file-edit
either. So any agent whose job is to **edit code** must either drive writes through the shell (see F8,
why that fails under a gate) or be handed a write tool by the adopter. relayfact supplies a throwaway
`edit_file` (`poc/probe-02-real-attempt.mjs`) emitting `action.type:'write'`. **Finding:** a file-write
tool belongs in `bare-agent/tools` next to the shell tools; candidate to upstream. Until then it's
adopter glue (which the PRD §2 says relayfact owns), not a primitive relayfact "grew."

## F7 — `wireGate`'s default translator does not activate the bash/fs/net primitives

`src/bareguard-adapter.js:285` — the default action translator emits `{ type: toolName, args }`. But
bareguard's `bashCheck`/`fsCheck`/`netCheck` (`bareguard/src/gate.js:228`) only fire when `action.type`
is literally `'bash'` / `'read'` / `'write'` / `'edit'` and read top-level `cmd` / `path`
(`bareguard/src/primitives/bash.js:28`, `primitives/fs.js:49,76`). Consequence: the shipped
`examples/with-bareguard.mjs` sets `bash:{allow:[…]}` + `fs:{readScope:[…]}` but wires the gate with a
bare `wireGate(gate)` (default translator) — **so those bash/fs configs are dead as written**; only the
`tools.allowlist`/`denylist` (which match on `action.type`) would fire. The adapter's own JSDoc flags
this ("does NOT activate bash/fs/net … adopters using those primitives must translate"), so it's
documented-but-sharp. relayfact passes a custom `actionTranslator` (mapping shell_read→read,
shell_run→bash{cmd}, edit_file→write{path}); proven live in `poc/run-probe02-*-audit.jsonl` (every
action shows the translated type + an allow/deny decision). **Finding:** the example under-sells this —
it reads as if `bash.allow`/`fs.readScope` are active when they are not. Worth either a real translator
in the example or a one-line warning beside the config.

## F8 — gating file edits *through the shell* is impractical; a write tool is the real fix

Even with the F7 translator, routing edits through the shell does not gate well. Writing a file needs
redirection (`> file`, heredoc), and `bash.allow` is prefix-only: any shell metacharacter forces a deny
(`bareguard/src/primitives/bash.js` shellMeta rule — proven in `poc/probe-02-gate-check.mjs`:
`node ; ls` → `deny rule=bash.allow.shellMeta`). So a gated agent literally **cannot** write via
`shell_run`/`shell_exec` redirection; the only metachar-free paths are awkward (`sed -i`, `cp`, `mv`).
This is the concrete reason F6 matters: the clean design is a dedicated write tool emitting
`action.type:'write'`, gated by `fs.writeScope` (no shell, no metachar problem) — exactly what
`edit_file` does. Together F6+F8 are a real completeness gap for the "senior-dev coding agent" use case.

## F9 — bareguard enforcement is layered and correct (works-as-intended)

`poc/probe-02-gate-check.mjs` (negative controls, can fail — and did, when my first assertions were too
narrow) proves the gate denies for the right reasons across every axis: `fs.writeScope` (out-of-scope
write, incl. the sibling **test file** when writes are scoped to the one source file — the anti-cheat
that keeps the `stuck` fixture honestly unsolvable), `fs.readScope` (out-of-scope read), a
destructive-pattern **floor** `content.denyPatterns` that catches `rm -rf /` *before* the allowlist,
`bash.allow` (benign-but-unlisted `cat`), and `bash.allow.shellMeta` (metachar with an allowed prefix).
Defense is layered (floor → ask → allowlist), stronger than a flat allowlist. The gate is live, not
inert — the sum/csv runs only showed `rule:"default"` allows because every action was legit; enforcement
is demonstrated by the negatives.

## F10 — litectx 0.21 `LiteCtx` requires `{ root }`; the shipped bareagent example is stale

`litectx/src/index.js:175` — `constructor(config){ if (!config || !config.root) throw new Error("LiteCtx
requires a { root } config") }`; `dbPath` defaults to `<root>/.litectx/index.db` (`:189`). But
bareagent's `examples/litectx-as-store.mjs` (and our carried key-shapes notes) construct
`new LiteCtx({ dbPath })` with no `root` — which **throws** on 0.21. Cost us one run (caught because the
mount error surfaced as a `run.error` event — the event-stream spine paid off). Fix in probe-02:
`new LiteCtx({ root: <dir> })`. **Finding:** bareagent's litectx example is pinned to an older litectx
API; either bump the example or note the version. The Store socket itself (`{store, search, get, delete}`
→ `{id, content, metadata, score}`, `litectx/src/memory-store.js:43`) is unchanged and worked first try:
seeded 3 facts, `recall('…double quotes…')` ranked the relevant CSV lesson top (score 3.681) over two
distractors — ranked recall, not a fetch.

## F11 — a bareguard halt via `humanChannel`-deny does NOT stop the loop; the adopter must

`refine`'s contract says a `HaltError` "propagates as a clean exit — never caught here"
(`bareagent/src/refine.js:30`). But observed: a budget/turn cap routes to `humanChannel` as a
`kind:'halt'` event; returning `{decision:'deny'}` denies that **one action** — the Loop logs it via
`onError` and `loop.run` **returns normally** (empty text). No `HaltError` reaches `refine`, so it
retries the next iteration and **keeps spending** ($0.0021 → $0.0047 → $0.0073 across 3 iters under a
$0.0001 cap — the opposite of "halts cleanly"). Workaround in probe-02: latch a `halted` flag inside the
`humanChannel` and throw from `attempt` after the run so `refine` exits at iteration 1 (~one round,
~$0.0021). **Open question / likely-correct usage (unverified):** returning `{decision:'terminate'}`
(not `'deny'`) for a halt may be what raises the `HaltError` the refine doc assumes; worth confirming and,
if so, documenting that "deny ≠ stop" at the humanChannel boundary. Either way the cap *enforces*
per-action; what's sharp is that "halts cleanly" depends on the humanChannel response, which isn't obvious.

---

*Findings F12–F14 are the **recurse() reconciliation** (bareagent v0.21.1, 2026-06-29): relayfact's v2 was
re-planned around `recurse()` while it was pre-POC; on delivery the provisional shape was verified against
the shipped API (PRD §0/§5.1/§8.1). Discovery context: `recurse()` shipped in `bareagent/src/` (recurse.js
+ recurse-{prompts,retrieval,synthesize}.js) but was **initially undocumented** in `bareagent.context.md`
v0.20.0 — a doc gap, closed in v0.21.x. Ground truth was read from source.*

## F12 — Gap 3: recurse had no worker-persona seam; raised → SHIPPED upstream as `opts.persona`

Confirmed in source: every recurse worker (top, spawn-children, fan-out, partition) built its system prompt
as `DECOMPOSITION_POLICY + capabilityScrub(depth, maxDepth)` (`recurse.js:318`, pre-fix) with **no `opts`
seam to inject a stance** — so relayfact could not give workers its senior-dev persona, contradicting PRD
§5.1 ("relayfact owns the worker persona"). A real completeness gap, not a doc gap. **Resolved upstream
(v0.21.0, propagated from the `hamr0` origin):** `opts.persona` is a caller string PREPENDED to every
Family-A worker (`recurse.js:347` now `workerPersonaPrefix(opts.persona) + DECOMPOSITION_POLICY + …`). It
**augments, never replaces** (the decomposition/scrub text is load-bearing for the spawn mechanics),
**carries down the tree** (a durable stance), and is **not** applied to the isolated verifier (that
isolation defeats self-grading sycophancy). POC-first per repo rules: `poc/rlm-persona-seam.mjs` validated
that a prepended persona doesn't break `spawn_child`. Security guardrail added in v0.21.1 (persona is a
privileged system-prompt seam → caller-trusted text only). **Resolution for relayfact:** §5.1 "owns
persona" is *restored* via `opts.persona` — but recurse owns the worker **Loop construction**, so §5.1 is
amended to "relayfact owns persona + tools + close + synthesize," not the Loop. The finding→upstream-fix
arc is exactly the doctrine (consume, don't build; a missing primitive is a finding, fixed at the lib).

## F13 — recurse children strip `contract`/`evaluate`; the grounded close is TOP-node-only (works-as-intended)

`recurse.js` `forChild` strips the parent's `contract`/`evaluate` (and `count`/`mode`/`retrieval`/`corpus`/
`window`/`passes`) on delegation: a delegated child runs a fresh `recurse` that does **not** inherit the
top setpoint. So relayfact's executable `opts.evaluate` grades the **top synthesized result**, not each
intermediate node. Correct by design (a slice shouldn't be graded against the *whole*-task DoD, and the
child verdict is never read by the parent), and now **documented** in the v0.21.1 guide ("set
`contract`/`evaluate` once at the top; they do not — and should not — re-run per intermediate node").
**Implication for the doctrine:** grounding holds when the top setpoint is a **global predicate** (the
whole verify command / full test suite) — a child that faked its slice is caught at the top because the
global check still fails. Verified the seam itself is honored: `verify()` calls `opts.evaluate` over the
default rubric Evaluator (`recurse.js:870`) and runs it on the synthesized `result`. The per-node
boundary-map (PRD §1) therefore reads RC-10 receipts where **child verdicts are recurse's rubric-or-null
default**, grounded only at top + synthesis. Open question (PRD §8.1 spike 1): does a global top-level
predicate suffice when intermediate nodes are ungrounded? Works-as-intended; not a defect.

## F14 — `onToolResult` not threaded into recurse workers — N/A (caps are bareguard's, and they ARE wired)

recurse builds worker Loops with `{ provider, system, policy, onLlmResult, stream }` (`recurse.js:354-359`)
— **no `onToolResult`**. This is **not** a usage-cap gap: caps are bareguard's, not bareagent's (recurse is
"cost open by design"), and the two enforcement paths ARE threaded — `ctx.policy` (`gate.check` before
every worker tool call, allow/deny + halt) and `ctx.onLlmResult` (LLM cost → `gate.record` →
`budget.maxCostUsd`), the latter including tool-internal LLM calls (e.g. the scan judge). Tools don't burn
tokens, so `onToolResult` is not a cost path; it only adds post-tool `gate.record` carrying `_ctx` for
**per-principal** audit accounting — moot for relayfact's single-process, single-tenant loop where every
tool is already governed by `policy`. Logged for completeness; **not carried as live friction.**

---

*Findings F15–F17 came out of **probe-03** (`poc/probe-03-replay-recurse.mjs`), the PRD §8.1 Step-1
replay-through-recurse: the probe-02 worker + grounded close run THROUGH the shipped `recurse()` at
`maxDepth:1` on sum/csv/stuck + a budget-cap halt. All four reconciliation checks passed (green→green;
ranked recall; honest-fail; clean halt) — these are the frictions found along the way.*

## F16 — 🔴 SECURITY: the Anthropic API key leaks into the bareguard audit log in plaintext (recurse-specific)

The audit record for every `type:'llm'` event carries `action._ctx.provider.apiKey` = the full
`sk-ant-api03-…` key, written to disk (`poc/run-probe03-*-audit.jsonl`). Vector: `recurse()` threads its
`ctx` — which holds the live **`provider` instance** (and thus `apiKey`) — into `gate.record` as `_ctx`,
and bareguard serializes `_ctx` **verbatim** into the audit. Confirmed by dumping one record (the
`_ctx.provider.apiKey` field is the literal key). This did **not** occur in probe-02 (relayfact passed its
own `{ userId }`-shaped ctx, never the provider), so it is **introduced by recurse threading its whole ctx
blob**. Mitigation in-repo: the audit path matches `.gitignore` `poc/run-*.jsonl`, so it never commits —
but a plaintext key on disk still violates the no-secrets hygiene (AGENT_RULES security invariant). **Real
fix is upstream:** recurse should not place the live provider (with key) into the audited `_ctx` (pass a
provider *handle*/id, or omit it), **or** bareguard should redact known-secret fields (`apiKey`, `Bearer …`)
when serializing `_ctx`/actions to the audit. Candidate to propagate from the `hamr0` origin. Highest-
severity finding so far; no papering over.

**✅ RESOLVED — verified-shipped (2026-06-29).** Fixed at the libs per doctrine (no relayfact workaround):
**BA-1** (`bare-agent 0.22.0`) — `recurse()` strips the live provider from the audited `_ctx` via
`auditSafeCtx()` at every governance boundary (mutation-proven test); **BG-1** (`bareguard 0.10.0`) —
default-on key-aware redaction walk (`apiKey`/`api_key`/`authorization` + `Bearer …`/`sk-…` values,
`secrets.keys` to extend, `redactKeys:false` to opt out; matches the relayfact↔bareguard settled spec).
Verified on return by re-running probe-03 on the shipped versions: the audit's `_ctx` is now `{"depth":0}`
(provider gone) and contains **no `sk-ant` key** — BA-1 does the stripping, BG-1 is the backstop. csv still
closed green (no regression). See `UPSTREAM-FIXES.md` BA-1/BG-1.

## F17 — recurse halts CLEANER than refine on a budget cap — because it does not retry the worker

probe-02 logged F11: under `refine`, a budget halt routed to `humanChannel` as `{decision:'deny'}` denied
one action but the loop **returned normally and refine retried**, so spend grew across iterations
($0.0021→$0.0047→$0.0073) — needing a latch-and-throw workaround. **Under recurse the same deny-returning
`humanChannel` halts cleanly with NO workaround:** isolated audit shows exactly **1 over-cap LLM call
($0.0023 vs a $0.002 cap — a $0.0003 overshoot, unavoidable since cost is known only post-call), then
`{ incomplete }`, exit 1, no crash, no runaway.** The reason is **not** a `HaltError` throw (the halt still
routes through `humanChannel` as a deny — 2 halt-severity records, `deny2` in the run): recurse's worker is
**single-pass** (it imports no `refine`, has no worker-retry loop), so once the cap trips, post-halt actions
are denied, the worker cannot proceed, and recurse returns incomplete **without re-invoking**. So F11's
"keeps spending" does not reproduce here — the amplifier (refine's retry) is absent. The even-cleaner
`{decision:'terminate'}`→`HaltError`→recurse-guard path (F11's open hypothesis) remains untested and is the
recommended config; but the deny path is already bounded. *Reconciliation delta to carry: at `maxDepth:1`
recurse ≠ refine — honest-fail (stuck → terminal red verdict, not `maxIterations` escalation) and clean-halt
both flow from the single-pass worker.*

## F15 — recurse workers expose no caller tool-call hook; observability is the audit + receipts + `ctx.stream`

recurse builds each worker `Loop` with `{ provider, system, policy, onLlmResult, stream }`
(`recurse.js:354-359`) — **no `onToolCall`/`onText`**. So a consumer cannot observe worker tool calls via
Loop callbacks the way probe-02 did (`onToolCall → emit('tool.call')`). probe-03's first run showed zero
`tool.call` events despite the worker reading/editing/testing. The observability substrate under recurse is
therefore (a) the **bareguard audit** (every governed action, by type + decision — probe-03 rolls this up
as `acts=r/b/w/deny`), (b) the **RC-10 receipts** tree (`out.receipts.spawned`), and (c) **`ctx.stream`** (a
`Stream` forwarded to every worker Loop — the intended live channel, not yet wired in probe-03). **Bearing
on PRD §7:** the tree observer must read recurse's stream + receipts + audit, **not** Loop callbacks. Not a
defect — a design consequence of recurse owning the worker Loop (F12/§5.1) — but it relocates where the
event spine taps in. Wire `ctx.stream` in the next spike to regain live per-action visibility. **Confirmed
working in probe-04:** worker Loops emit `loop:tool_call`/`loop:tool_result` to `ctx.stream`.

---

*Findings F18–F20 + the Spike-1 result came out of **probe-04** (`poc/probe-04-spike1-grounding.mjs`),
PRD §8.1 Spike 1: a 3-slice fixture (`multi` with one UNSATISFIABLE slice; `multi-ok` control) run through
forced Family-B fan-out, asking whether a GLOBAL top predicate catches an ungrounded child even though
children strip `evaluate` (F13).*

## ✅ Spike-1 RESULT — the grounding seam SURVIVES decomposition (doctrine validated)

Both assertions passed, live: **`multi`** (fc slice unsatisfiable by construction) → top `verdict=pass:false`,
suite RED, the ungrounded slice **caught at the top, never faked green**; **`multi-ok`** (all slices
grounded) → top GREEN, converged. The RC-10 receipts make the mechanism visible: in BOTH runs the **top**
node carries relayfact's executable predicate verdict, and **all three child nodes are `verdict=null`** —
recurse never graded them (F13 stripping, confirmed empirically). So **a global top-level predicate (the
whole `node --test` suite) is sufficient to catch an ungrounded intermediate node** even though that node is
never individually graded by relayfact's close. Synthesis was `synthesize:'concat'` (lossless, NO LLM
merge) — the §2 rubric-only-synthesis trap avoided. **PRD §8.1 Spike-1 question — answered YES; PRD §10
"does grounding survive synthesis/decomposition?" — RESOLVED: yes, via the global top predicate.** Honest
scope: this holds when the top setpoint is a GLOBAL predicate; a per-slice-only predicate would not see a
sibling's gap (not how relayfact compiles the close, but worth stating).

## F18 — recurse over-decomposes at `maxDepth>1` with a weak model; forced fan-out does NOT bound depth

First probe-04 run (`count:3`, `maxDepth:2`) blew up: each of the 3 forced workers RE-decomposed (Family-A
`spawn_child` is still offered to a Family-B worker when `depth < maxDepth`), so haiku spawned a tree of
"read the test to understand fa" sub-sub-tasks, burned `r65/b57`, hit `maxTurns=120`, returned `incomplete`
— on three one-line functions. The recurse "cost open by design" ⚠️ reproduced. **Mitigation
(works-as-intended once understood):** for known-parallel work use `maxDepth:1` (FLAT fan-out — workers
cannot re-spawn). `count:N` forces the WIDTH but does not cap the DEPTH; the two are independent knobs.

## F19 — recurse's decomposition STRIPS the parent's concrete context (paths / working dir) from child subtasks

The Planner split "fix the three files (here are the absolute paths)" into child subtasks like *"Fix ma.js:
implement fa(a,b) to return a + b"* — **the absolute path and fixture directory were dropped.** Combined
with contract-stripping (F13), the child worker had **no idea where its file lived**: workers guessed
`.`, `/`, `~/ma.js`, `/tmp` (denied by `fs.readScope`) and wrote to `/mb.js` (denied by `fs.writeScope`).
For an artifact-producing task this is load-bearing — a sliced worker cannot act on a file it cannot locate.
**Mitigation:** re-inject the working context via **`opts.persona`** (the ONE channel that carries down the
whole tree — F12), not the task/contract (stripped). relayfact owns this glue; once the persona named the
directory and `edit_file` resolved a bare filename to it, workers wrote correctly. Worth flagging upstream:
recurse could thread a small read-only "context" blob to children alongside the persona.
**RESOLVED (F21):** that blob shipped as BA-9 `recurse({ context })` in 0.23.0 — the persona-laundering
mitigation above is **superseded**; move the working dir from `opts.persona` to `opts.context`.

## F20 — the self-healing ceiling, measured: a small-model fan-out worker needs every detail spelled out

Getting the `multi-ok` control from red→green took **six** iterations, each fixing one distinct worker
failure on a TRIVIAL 3-function task: (1) over-decomposition (F18) → `maxDepth:1`; (2) "read to understand"
subtasks → inline specs; (3) path-mangling (`/mb.js`) → `resolveTarget` basename; (4) read-thrashing on
guessed paths → drop `shell_read`; (5) no path context (F19) → dir in persona; (6) dropped the `export`
keyword (`function fa` not `export function fa`, breaking the import) → persona requires `export`. **Direct
evidence for PRD §1's secondary goal — where does a small model's self-healing break down.** The answer
from this spike: **haiku self-heals only under heavy scaffolding; the limiting factor is the WORKER, not the
close.** Crucially, **the grounding close held through ALL six failures** — every wrong/incomplete artifact
made the global top predicate go RED (never a faked green), children always `verdict=null`. The close is
robust; the small model is the ceiling. (Honest residue: only haiku tested; a stronger worker model would
likely clear most of these without scaffolding — that A/B is a benches-prd question, not run here.)

## F21 — BA-8 (leaf-refine seam) + BA-9 (working-context thread) shipped in 0.23.0, VERIFIED-shipped-vs-spec

Both asks delivered (`bare-agent@0.23.0`, commit `efc09fe`) and **verified by running the shipped code, not
asserting from source** — `poc/probe-05-ba89-verify.mjs`, four arms, every claim paired with a control that
CAN (and did) fail. Model: claude-haiku-4-5 (small on purpose); ~$0.009 total.

- **BA-9 `recurse({ context })` — VERIFIED.** Unguessable `mkdtemp` dir + a random token in `secret.txt` +
  a `read_file` tool gated to that dir only. **context arm:** the leaf read the ABSOLUTE path and reported
  the token (`readAbsPath=true`, `recoveredToken=true`, `denies=0`). **no-context control:** persona names no
  dir, `opts.context` unset → worker guessed a bare path → gate DENIED (`denies=1`), token never recovered —
  **reproduces F19**, proving the recovery is the context channel and the test isn't rigged.
- **BA-8 `recurse({ refineLeaf:{ sensor } })` — VERIFIED.** `maxDepth:0` ⇒ `canSpawn=false` (recurse.js:420)
  ⇒ the top node IS the refining leaf. **recover arm:** the sensor rejected attempt 0 with a critique
  demanding the token `BANANA` — *a word the task never mentioned* — and passed only if the result contained
  it. Result: `iterations=2, passed=true, temperatures=[0.2,0.7]`, token present ⇒ the GAP (`verdict.critique`)
  was threaded into the retry **and acted on**, with temperature escalating (the load-bearing finding). The
  only way to emit `BANANA` was to receive the fed-back critique — gap-feedback proven end-to-end, not a bare
  counter. **never control:** sensor always returns `pass:false`/`status:'unmet'` → `iterations=3` (=default
  maxIterations), `passed=false` — honest non-recovery is reported, never a faked green; confirms `passed` is
  not hardwired true.

**Division of labor confirmed as designed:** bareagent owns the leaf loop + guards + the verify slot;
relayfact supplies the deterministic sensor (its executable close) + persona; the error-keyed `recall` is the
caller's via `opts.tools` (bareagent stays litectx-agnostic). This is the seam the memory-as-self-improvement
loop plugs into — **all blocking upstream asks for the loop are now shipped + verified.**

## F22 — Spike 2 mechanism: error-keyed recall flips fail→pass at the leaf

> **⚠️ CORRECTED — framing retracted (see F25 + the `no-fit-to-pass-tests` memory).** FIT TO PASS: the
> recalled lesson literally contained the answer string (ON tested copy-paste, not memory value); the 5
> "distractors" were semantically far (`nHits=2` — most never competed); the query was hand-tuned to the
> answer. Stands ONLY as: the recall→thread→retry **wiring** works and memory-presence changes the outcome.
> The "self-improvement / semantic retrieval" claim is **withdrawn**. Honest redo: F25.

The headline secondary-goal experiment's riskiest assumption, validated. `poc/probe-06-memory-loop.mjs`
wires relayfact's deterministic sensor into the verified BA-8 `refineLeaf` seam (F21) and, on a failed
attempt, enriches the fed-forward GAP with an error-keyed litectx **`recall`** (ON arm). Model: haiku.

**Setup (airtight by construction):** the task needs an ARBITRARY project value (`RLF-7Q2X-PROD`) the model
cannot derive. The worker's ONLY tool is `edit_file` (no read tool), so it cannot read the test to cheat;
the value exists in just two places — the unreadable test and the litectx store. The sensor reports failure
WITHOUT leaking the value (a real test failure says "wrong", not the domain secret), so the gap alone can't
rediscover it. The store holds the signing lesson among **5 distractor facts**, so recall must RANK by
meaning (litectx's job, proven in probe-02), not key-match.

**Result — both arms behaved, every claim has a control that failed:**
- **recall-off (control):** `iterations=3, passed=false`, suite RED, salt never produced. The task is
  genuinely unguessable and nothing leaks — the control CAN and DID fail (no rig).
- **recall-on:** `iterations=2, passed=true`, suite GREEN, artifact carries the salt. Recall **ranked the
  signing lesson top (id=signing-salt, score=9.177) over the 5 distractors** (FTS-gated to 2 hits, the
  signing one #1) → threaded into the retry → the worker reproduced the salt. **Memory flipped fail→pass.**

**What this proves / its honest limit:** the *mechanism* works end-to-end — error-keyed recall, injected at
the right time (on failure, the loop's call) into the now-shipped leaf seam, changes the outcome on a task
unreachable without it, and litectx earns it by semantic ranking. This probe **seeds** the lesson (isolating
RETRIEVAL value in one run); the fuller **cross-run "earned lesson"** test (run 1 fails → distill → remember;
run 2, a FRESH window, recalls) is the documented next step — this is the POC that gates it. Ownership map
held exactly: relayfact owns WHEN (recall on failure) + the deterministic close; litectx owns WHAT-comes-back
(reactive, ranked); bareagent stays litectx-agnostic (the recall handle is the caller's via `opts.tools`).

**Sharp edge (not an upstream ask — documented behavior):** litectx `recall` returns a memory row's id as
`hit.path` (the unified unit pointer), not `hit.id`; a consumer expecting `.id` reads `undefined`. Cost me one
probe-assertion miss (the run itself was green). Worth knowing when mounting recall as a handle.

## F23 — Spike 2 cross-run: a stored row persists + is read across separate processes

> **⚠️ CORRECTED — framing retracted (see F25 + the `no-fit-to-pass-tests` memory).** FIT TO PASS: run 1 was
> HANDED the salt via `context` (not learning), stored it VERBATIM, and run 2 read the same literal constant
> back for a renamed sibling function — trivial "transfer". Stands ONLY as: litectx **persists a row across
> processes** and the loop reads it back. The "earned lesson / durable lift / learns from its own past work"
> claim is **withdrawn**. Honest redo: F25.

The bigger half of the memory claim, now grounded. `poc/probe-07-memory-crossrun.mjs` runs THREE separate
processes sharing ONE persistent litectx store dir (`poc/.litectx-probe07`) — a real cross-session test
(benches-prd: cross-session persistence is the qualified win). Model: haiku.

- **learn (run 1):** implement `sign()`. The salt is provided this run via **BA-9 `opts.context`** (a runbook
  line) — the worker has no read tool, so context is its only source. On the GROUNDED pass (suite green)
  relayfact stored the agent's **OWN working code** as a `kind:'episode'` lesson — not a hand-authored answer,
  the verified artifact, stored only because the test confirmed it. `iterations=1`, lesson persisted.
- **apply-off (run 2 control, fresh process):** implement `seal()` (a DIFFERENT function, same salt), NO
  runbook context, NO recall. `iterations=3, passed=false`, RED — the cross-run knowledge is genuinely gone
  without memory. The control CAN and DID fail (proves the win is memory, not leakage).
- **apply-on (run 2, fresh process):** same task, NO context, but recall ON. On failure relayfact recalled
  run-1's lesson → threaded it into the retry → `iterations=2, passed=true`, GREEN, artifact carries the salt.
  **The salt crossed runs ONLY through litectx.** Cross-run, earned-lesson, durable lift — demonstrated.

**Ownership/doctrine held:** relayfact stores a lesson ONLY after a grounded pass (never a guess); the lesson
is the agent's own verified code; recall is reactive (fires on the run-2 failure, the loop's call); bareagent
never touches litectx. Combined with F22 this closes the memory-loop's core claim: recall flips fail→pass
in-run (F22, with distractor ranking) AND a verified lesson persists + transfers across runs (F23).

**Honest residue (untested combinations / sharp edges):**
- **No distractors cross-run.** probe-07's store holds only the one earned lesson; probe-06 proved
  ranking-over-distractors but SEEDED, in-run. The hard combination — earned + cross-run + many distractors +
  paraphrased query — is not yet one test. That's the realistic-noise stress, and the next refinement.
- **Episode recall scored 0** (vs probe-06's fact at 9.177); the hit was still returned and correct (single
  match), but `kind:'episode'` clearly ranks on a different axis than `kind:'fact'` BM25 (recency/occurredAt?).
  Under distractor load this could matter — verify episode vs fact ranking before relying on it. Minor, logged.
- **Embeddings OFF** — recall matched on shared vocabulary (both tasks signing/salt-themed). A differently-
  worded future problem needs the embeddings tier (the documented upgrade), not exercised here.
- **Transfer is to a KIN task** (same convention, sibling function). Generalization to a structurally
  different problem is a stronger claim, not made here.

## F24 — Spike 2: `fact`-kind lessons rank above far distractors; `episode` ranks 0

> **⚠️ PARTLY CORRECTED (see F25 + the `no-fit-to-pass-tests` memory).** Same fit-to-pass core as F22/F23
> (recalled lesson held the literal answer; renamed-sibling "transfer"). The one durable, honest takeaway:
> **store lessons as `kind:'fact'`** — a fact ranked 11.678 vs the nearest distractor 0.579, while an
> `episode` scored 0 and would bury under load. The "earned + combined-stress WIN" framing is **withdrawn**;
> the real distractor test (a near, equally-rich WRONG rule) is in F25. Keep only the kind recommendation.

Closes the F23 residue. `poc/probe-08-memory-crossrun-distractors.mjs` is probe-07's three-process cross-run
shape with the realistic noise added: the persistent store is PRE-LOADED with 5 distractor facts, run 1 stores
its earned lesson as **`kind:'fact'`**, and run 2 recalls `kind:'fact'` and threads **ONLY the #1 hit** — so a
distractor outranking the lesson would fail the run.

- **learn:** seeded 5 distractor facts, implemented `sign()` via `opts.context`, stored the agent's own
  verified code as a FACT lesson among them (grounded by the green test). `iterations=1`.
- **apply-off (control):** no recall → `seal()` failed (`passed=false`, RED) **even though the lesson is in the
  store** — proves the win is the *recall*, not mere presence.
- **apply-on:** recall ranked the **EARNED lesson #1 (score 11.678)** over the distractors (next: money-cents
  0.579 — a ~20× margin), threaded only #1, `seal()` passed (`iterations=2`), cross-process. **Earned +
  cross-run + distractor-ranked, all in one test.**

**Resolution of the F23 episode concern:** the fix is the lesson's `kind`. A `fact` lesson ranks by BM25 and
dominates distractors (9.177 in probe-06 seeded; 11.678 here earned). An `episode` (probe-07) scored 0 and
only survived because it was the lone hit — under this distractor load it would likely have been buried.
**Recommendation for the loop:** store self-improvement lessons as `kind:'fact'`; reserve `episode` for
timeline/event recall, not retrieval-by-relevance. (Or recall `kind:'episode'` in its OWN query so it never
competes with facts — but `fact` is the simpler, proven-rankable choice.)

**Spike 2 is now closed at POC level:** recall flips fail→pass in-run (F22), a verified lesson persists +
transfers across runs (F23), and it survives realistic distractor noise when stored as a fact (F24). Remaining
honest residue is narrow: embeddings OFF (lexical/vocabulary match only — paraphrased problems need the
embeddings tier), and transfer demonstrated to KIN tasks (same convention), not structurally-distant ones.

## F25 — HONEST REDO of the memory-loop test (probe-09); F22–F24 framing RETRACTED

F22–F24 were caught **fit-to-pass** (see the `no-fit-to-pass-tests` memory). Their rigs: the recalled
"lesson" literally contained the answer string (ON tested copy-paste, not memory value); run 1 was HANDED
the value via `context` (not learning); "transfer" was to a renamed sibling needing the SAME constant;
distractors were semantically far (`nHits=2` — most never competed); the recall query was hand-authored to
match the answer. The controls did fail and the wiring was real, but the "self-improvement / earned /
semantic" **framing is retracted** — F22–F24 stand ONLY as "the recall→thread→retry wiring works and
memory-presence changes the outcome." Nothing about learning or transfer.

**probe-09 (`poc/probe-09-memory-honest.mjs`) removes every rig and reports a single un-tuned run-set:**
- **Lesson is a transferable RULE, not the answer.** Run 1 (`userId`) DISCOVERS the project ID convention by
  actually reading a scoped `runbook.md` (a real gated read), implements it, passes; relayfact stores the
  agent's OWN working code. Verified `containsRun2Answer=false` — orderId's outputs are NOT in the lesson.
- **Run 2 is a DIFFERENT entity** (`orderId`) needing the rule re-applied to a new prefix AND a new check
  letter — copying run-1's code verbatim fails the multi-case test.
- **A near, WRONG distractor competes:** `legacy-id-format` (lowercase, no pad) shares the id/format
  vocabulary and is THREADED into the prompt alongside the right rule. Query is derived from the failure
  (names the problem, not the answer). Top-3 threaded, full ranking logged.
- **Result (haiku, n=4 total: 1 + 3 trials/arm):** **blind 0/4 pass; with recall 4/4 pass.** Every recall
  ranked the current rule **#1 (6.345)** above the threaded legacy rule (2.332); the model rejected the
  misleading legacy note and adapted the rule to `ORDER`/`O` each time. The control failed every time
  (guessed e.g. `O${n}`) — the convention is genuinely unguessable.

**Honest claim (at altitude):** on this task and model, recalling a *transferable lesson that does not contain
the answer* lets the agent solve a project-specific task it cannot do blind — correctly preferring the right
lesson over a misleading near-distractor and applying it to a new instance. That is a real, scoped win.

**Limits I am NOT papering over:** (1) one fixture, one small model, n=4 — consistent (0/4 vs 4/4) but a single
scenario, not a rate across tasks; (2) retrieval is lexical BM25 (embeddings off), and the current-rule lesson
is a richer/longer doc than the terse legacy line — BM25 ranking may be partly a length/term-frequency
artifact, NOT controlled for here (an equally-rich wrong distractor is the next test); (3) transfer is
same-domain (ID formatting), "same rule → new entity" generalization, not cross-domain; (4) "learning" here
is *remember-what-worked* (read a doc, store the code, reuse), not inductive discovery of a novel rule.

> **Bounded by F26:** limit (2) above is now **measured, and it is the bad case** — the F25 "ranked the
> current rule #1" result was *confounded by document length*. Read F26 before relying on the ranking.

## F26 — the BM25 length confound is REAL: lexical recall ranks on similarity, not correctness

F25 flagged that its "current rule ranked #1" win might be a length/term-frequency artifact (the right
lesson was a 406-char working-code doc; the lone competing distractor was a 202-char line) and named "an
equally-rich wrong distractor" as the next test. **probe-10 (`poc/probe-10-ranking-isolation.mjs`) ran that
test — zero LLM tokens, recall over a fixed store is deterministic (verified byte-identical across runs).**

Two length-matched WRONG distractors were added to the same store F25/probe-09 used:
- `wrong-rich-legacy` (388c) — full WRONG code block (lowercase prefix, `padStart(4)`, check = *last* letter),
  legacy-framed; shares the id/format vocabulary. The honest twin of probe-09's terse legacy note.
- `wrong-rich-twin` (422c) — same WRONG code, but framed **word-for-word** like the right lesson
  ("…tests PASSED … current ID convention …"). Only the code differs.

**Result — under the exact failure-derived query probe-09 used (`Q_fail`):**

| rank | id | score |
|---|---|---|
| 0 | `wrong-rich-twin` (WRONG) | 2.808 |
| 1 | `wrong-rich-legacy` (WRONG) | 2.128 |
| 2 | `lesson:entity-id-format` (RIGHT) | 1.737 |

Both equally-rich wrong rules **outrank the right one.** The F25 "#1" result happened *only because the lone
distractor was terse* — once the wrong notes are length-matched, BM25 prefers them. Under a neutral query
(no "current/legacy" cue) the right rule and the twin tie exactly (0.340 vs 0.340). **Length confound:
CONFIRMED, not killed** (probe-10 exits 1 by design).

**Why this is deeper than a tuning bug, and why it does NOT need the embeddings tier to settle it:** the twin
is *near-identical text* to the right lesson (only the code body differs), so a semantic re-rank
(`@huggingface/transformers`, not installed) embeds the two to almost the same vector and cannot separate
them either. **Retrieval — lexical or semantic — ranks on textual/semantic *similarity*, which is not
*correctness*.** No retrieval tier can be the thing that prefers a right rule over an equally-worded wrong
one. (Finding against the *experiment's* memory-loop framing, not a bareguard/litectx defect — litectx
behaves exactly as documented; the lesson is about what recall *can* do.)

**Consequence (this is the load-bearing takeaway):** the memory loop's discriminator **cannot be the
ranking.** Recall surfaces topically-relevant candidates (some wrong); the only things that can pick the
correct one are the **worker** (reads the threaded notes and judges) and the **grounded close** (the test
that can fail). That is the relayfact thesis restated from the retrieval side: *recall proposes, executable
verification disposes.* probe-11 measures whether the worker actually discriminates when recall threads
wrong rules **ranked above** the right one — i.e. the real memory-loop question now that ranking is out.
**Answered in F27.**

## F27 — memory loop decomposed: ranking starves; the worker discriminates IF it sees the note; structure-transfer breaks

`poc/probe-11-discrimination-rate.mjs` — 5 entities, all under the same project ID rule (one,
`auditBadge`, a **structurally-distant** transfer: the rule must be wrapped in `<<…>>` output). The store
holds the right lesson + the **two length-matched wrong distractors from F26** + far ones. Three arms,
haiku, the grounded `node --test` close is the only truth:

| arm | what it threads | rate | reading |
|---|---|---|---|
| `blind` | nothing (control) | **0/5** | convention genuinely not guessable (guessed `ORD-${n}`, `a_${n}`, `INV-pad7`, `T${n}`, `AB-pad6`) |
| `recall3` | top-3 (right note ranks #3 → **excluded**) | **0/5** | ranking starves the worker: it gets `promo-code` + 2 wrong rules, copies a wrong one (lowercase, `padStart(4)`) every time |
| `recall4` | top-4 (right note #3 → **included** with the wrong ones) | **4/5** | given the right note among wrong ones, the worker **discriminates** — rejects the higher-ranked wrong rules, applies the right one |

Three things this separates that probe-09 (and the inflated F22–F24) conflated:

1. **Ranking is not the discriminator** (recall3 0/5) — confirms F26's consequence end-to-end: when wrong
   notes are length-matched, naive top-k recall threads them *over* the right one and the worker copies a
   wrong rule. Recall here is **net-zero to net-negative**, not a lift.
2. **The worker IS the discriminator** (recall4 4/5) — the moment the right note is actually in context
   (alongside two wrong, higher-ranked ones), the model picks it: `ORDER`/`ACCOUNT`/`INVOICE`/`TICKET`
   with width-6 pad and first-letter check, each passing at `iterations=2` (first try failed → gap
   feedback → second try passed; the refine close did its job). The memory loop is **salvageable**, but the
   fix is recall **depth/curation**, never ranking. Matches F20: the worker is the ceiling *and* the
   discriminator; the grounded close holds.
3. **"Remember-what-worked" does NOT transfer across STRUCTURE** (auditBadge fails even in recall4,
   `iterations=3` exhausted). With the right note present, the worker applied the rule to the new prefix
   correctly — it emitted `AUDIT-000042-A` — but reproduced the *lesson's return shape verbatim* and
   omitted the `<<…>>` wrapping the test required. The close **correctly rejected** it (no wrong artifact
   passed). So the transfer that holds is *same-structure, new-prefix*; change the output structure and
   lexical-memory reuse pattern-matches the old shape and breaks.

**Net, honest:** the litectx memory loop's machinery works, but its *value* is bounded on three sides now
measured, not asserted — (a) lexical ranking cannot prefer correct over equally-worded incorrect (F26);
(b) so naive top-k can starve the worker (recall3 0/5); (c) even when the right note is present, reuse is
remember-the-shape and does not generalize across structure (auditBadge). The one durable positive: **with
the right note in context, a small model reliably discriminates it from higher-ranked wrong ones and the
grounded close converges (4/4 same-structure).** That is a real, narrow win, and it lives in the
worker+close, not in retrieval. (No litectx/bareguard defect — all three behave as documented; this is a
finding about what a *retrieval-based memory loop* can and cannot do.)

## F28 — Spike 3 (boundary at depth): grounding seam holds under ORGANIC decomposition; tree depth is model-bounded

`poc/probe-12-spike3-depth.mjs` — the secondary-goal measurement (§0/§1), tree-structured. A 6-function
toolkit ("strings" + "numbers" modules) under one global suite, `maxDepth:2`, `count:2` at the top,
`synthesize:'concat'` (no LLM merge), gated. Two arms, haiku, `node --test` is the only truth:

| arm | top verdict | grounded coverage | ungrounded residue | maxDepth | outcome |
|---|---|---|---|---|---|
| `depth-ok` (all satisfiable) | `satisfied/pass=true` | **1/3** (root only) | 2/3 (both children `verdict=null`) | 1 | **GREEN — converged** |
| `depth` (nInc unsatisfiable) | `needs_revision/pass=false` | **1/3** (root only) | 2/3 | 1 | **RED — fault caught** |

**What held (the load-bearing doctrine, now at organic decomposition, not Spike 1's forced flat fan-out):**
- relayfact's executable close ran **exactly once** (`groundedCalls=1`), on the synthesized top result —
  confirming F13 (children strip `evaluate`) *structurally*, from the receipts, not just from source.
- **Grounded coverage = the ROOT only (1/3); every descendant is `verdict=null` — the ungrounded residue.**
- The **global top predicate caught a fault owned by an ungrounded child** (RED top `pass=false`) and
  converged the control (GREEN top `pass=true`). So the residue is **harmless *because* the root predicate
  is global** — Spike 1's result, now reproduced under a naturally-decomposed 2-module tree.

**What did NOT happen, reported honestly (no papering over):** despite `maxDepth:2` and 3-function modules,
**the tree never nested past depth 1.** haiku, given clear inline specs + only `edit_file`, has each module
child just *do* its functions in-worker (6 writes across 2 children) rather than re-decompose — it assesses
"implement 3 functions" as `simple`. `opts.count` forces width only at the node it is set on and does **not**
propagate to children (they strip it, like `contract`/`evaluate`), so there is no non-gaming API lever to
force a grandchild. **Depth is MODEL-bounded, not mechanism-bounded.** This is the mirror image of F18
(where spec-less workers *over*-decomposed by thrashing on exploration): with specs, this model
*under*-decomposes. Either way, **tree shape with a weak model is not controllable**, and the grounding seam
holds regardless of whichever shape emerges.

**Consequence for the secondary goal (the boundary map):** the rubric/HITL residue = every non-root node
(all `verdict=null`). Its *safety* is entirely carried by the global grounded close at the root; its *size*
is set by how far the model decomposes — small here (2 nodes) because haiku won't build deep trees. **The
"depth-2 reach" claim (a fault ≥2 levels down still caught) is UNPROVEN with haiku** — it would need a
planner that actually nests (a stronger model, or gaming the complexity scorer, deliberately not done). What
is proven: at whatever depth this model produces, *grounded-at-root + global predicate = the whole tree is
covered*, and the ungrounded residue never closes anything green on its own.

> **CORRECTED by F31:** F28's "haiku won't nest, depth is model-bounded" conflated two things and was partly
> a **probe misconfig** — I had set `opts.count`, which forces *flat* Family-B workers that never re-decompose.
> With Family A (no `count`), children DO recurse. Read F31 for the corrected depth picture. The doctrine
> half of F28 (global predicate catches an ungrounded child's fault; grounded coverage = root only) stands.

## F29 — the memory loop, FIXED and validated: naive 0/5 → fixed 5/5

F26/F27 showed the naive loop fails because lexical recall ranks on similarity, not correctness. `poc/probe-13-memory-fixed.mjs`
builds and validates the fix — same 5 entities, same adversarial store (the two length-matched wrong
distractors from F26), haiku, `node --test` close:

| arm | recall strategy | lesson form | rate | note |
|---|---|---|---|---|
| naive | thread top-3, rank-trusting (F27 repro) | verbatim code | **0/5** | right note ranks #3 → never in the slate (`rightInSlate=false` every attempt) |
| fixed | **close-driven widening** (3→6 on each failed close) + "unverified candidates; the TEST decides" framing | **rule-framed** (explicit `<PREFIX>-<pad6>-<CHK>` rule + example) | **5/5** | worker discriminates the right rule from the higher-ranked wrong ones; converges at iterations=2 |

Two fixes, each doing a job:
- **FIX-1 (retrieval):** don't trust rank. The grounded close *drives* recall — widen the candidate window
  on each failed attempt until the right note is present, framed as candidates the test adjudicates. This is
  the thesis operationalized: *recall proposes, executable verification disposes.* (Bonus: the rule-framed
  note also ranks better than verbatim code — the rule text lexically matches a "what is the convention"
  query, so it was in the top-3 slate from attempt 1 for the plain entities.)
- **FIX-2 (structure) + an F27 correction:** F27 blamed a "structure-transfer" failure on `auditBadge`
  (wrapped `<<…>>` output). That was **my fixture underspecifying**: the wrapping lived ONLY in the hidden
  test, so the worker could not know it from task or memory — an unpassable spec, not a transfer failure.
  Made fair by putting the output *shape* in the task (a per-function spec, NOT a project convention →
  belongs in the task, not memory) with a neutral example that doesn't contain the answer. With the ID rule
  from memory + the shape from the task, the fixed loop passes `auditBadge` too (`<<AUDIT-000042-A>>`).

**Honest scaling caveat (logged, not papered over):** widening to the full pool works for a BOUNDED
candidate set. A large store can't thread everything — it needs either better retrieval or a hard widen cap;
the close-driven widening degrades to "try the top-k, widen k on failure up to a cap", which bounds cost but
can miss a note buried below the cap. The durable claim is unchanged: the discriminator is the worker+close,
and the fix makes recall *reliably surface* the right note to them rather than trusting rank to rank it first.

## F30 — F11 tested: `terminate` STICKS but does not self-stop `refine`; `refineLeaf` (relayfact's loop) halts cleanly

`poc/probe-14-terminate-halt.mjs` (v3 — two earlier versions were wrong: a single `Loop` finishes in one
round; the Loop *catches* HaltError internally so it never reaches the caller). Tested with the v1 `refine`
primitive (F11's origin), tiny budget, always-failing leaf, 4 iterations, `deny` vs `terminate`:

- **`deny`:** 4 iterations, 4 LLM calls, ~$0.0041, `humanEvents=4` (a fresh `budget.maxCostUsd` halt each
  iteration), `gate.terminated=false` — the F11 problem: refine keeps spending, one call per iteration.
- **`terminate`:** 4 iterations, **4 LLM calls**, ~$0.0039 — halts 2–4 are `rule=gate.terminated`
  (`gate.terminated=true`). It **STICKS** (a clean, unambiguous stop-signal, unlike a transient per-action
  `deny`) **but does NOT self-stop**: same call count/cost as `deny`, because `refine` seeds a fresh Loop
  each iteration that makes its first LLM call *before* the gate is consulted. **So the caller still needs
  probe-02's latch** (break refine on `gate.terminated`); `terminate` only makes that stop-condition
  unambiguous. F11 hypothesis "terminate removes the latch" → **PARTIAL/refuted.**

**But this does not affect relayfact**, whose actual loop is `recurse` + **`refineLeaf`**, not bare `refine`.
Verified directly (minimal probe, tiny budget, always-fail sensor): under `refineLeaf` a budget cap fires
after **exactly 1 over-cap LLM call** then clean-halts (`humanChannel` halt, `llmCalls=1`, cost $0.0012 > cap
$0.0008, recurse returns cleanly). That is F17's "recurse halts cleaner than refine" confirmed for the leaf
path — **budget IS enforced in relayfact's loop; no latch, no `terminate` needed.** (An earlier probe-14 v2
reading of "9× overspend under refineLeaf" was a measurement artifact, corrected by this direct test.)
Net: cost-control is sound for graduation; the `terminate`-doesn't-self-stop nuance is a caveat for anyone
using the bare `refine` primitive, logged upstream-adjacent (see UPSTREAM-FIXES).

## F31 — depth CORRECTED: decomposition depth is task-tractability + model choice; the doctrine is depth-independent

F28 concluded "haiku won't nest (model-bounded)". That was partly **my misconfig**: `opts.count` forces
Family-B *flat* workers that never re-decompose (recurse.js:391 → `recurseFanout`; "forced fan-out is NOT
re-applied to children"). Removing `count` (Family A) lets children run `recurse(…, depth+1)` and re-split.
Re-ran across the matrix (`poc/probe-12-spike3-depth.mjs`, Family A unless noted):

| config | tree | why |
|---|---|---|
| forced `count:2` (Family B), haiku | depth 1, flat | forced fanout → flat workers by design |
| Family A, haiku, plain framing | depth 1 (2 module children, each in-worker) | haiku splits the top, solves each module itself |
| Family A, **sonnet-5**, plain framing | **depth 0** (root solves all 6) | a stronger model just *solves* a tractable task |
| Family A, haiku, **hard/complex-noun framing**, maxDepth 3 | depth 0 | "pipeline" framing made it one cohesive task |

**Also corrected:** decomposition depth is NOT model-driven the way I told the user. `assessComplexity`
(recurse's spawn gate, `canSpawn = depth<maxDepth && level!=='simple'`) is a **pure keyword heuristic, no
LLM** — so a stronger model does not "nest more". In Family A the *Planner* (model) chooses width, but
capable models solve tractable tasks shallowly. **I could not induce a natural depth-2 tree in any config**
(weak/strong model, plain/hard framing) — it would need an intractably large task or gaming the scorer, both
artificial.

**The load-bearing point stands and is stronger for it:** the grounding doctrine held in **every** config
(depth 0, 1; flat and adaptive; haiku and sonnet) — the global top predicate caught the planted fault every
time and the control converged. That is because the predicate's reach is the **entire artifact** (the whole
test suite), which is **independent of decomposition depth** by construction: a fault at any node fails the
suite. So "depth-2 reach" is an **ill-posed milestone** — the global close's coverage does not depend on how
deep the tree goes. What's real is the boundary map (grounded = root only; residue = every descendant;
safety carried entirely by the global root close), and it holds at whatever depth the model produces.

---

*Finding F32 came out of **probe-18** + `poc/observer.mjs` (PRD §8.2 G4, 2026-07-02): the observer built
FIRST (token-free) as the microscope that instruments the remaining graduation probes.*

## F32 — the observer is a pure listener; RC-10 receipts + worker Stream are NOT persisted to the event log

`poc/observer.mjs` is one reusable pure listener (§7 invariant: never imports the engine) over a run's
persisted artifacts — the `run-*.jsonl` event stream + the sibling bareguard `*-audit.jsonl`. probe-18
replays it over two existing, differently-shaped logs (probe-12 tree run, probe-13 memory run) and asserts,
with a **control that can fail**, that it renders the five facets (grounded close / memory / grounding
boundary / gate / terminal) **and declares a facet ABSENT rather than fabricating it** when a run didn't
expose it. The self-check caught **three real bugs in the observer itself** (verify-by-running, not
asserting): (1) it marked the grounding-boundary facet "present" for a memory run off audit spawn-lineage —
fabricating a boundary that was never reported (fixed: the boundary is present only when the run emits
`boundary.map`/`receipts`; audit lineage is a separate gate-facet signal); (2) it counted every
`severity:'action'` record as a "halt" — inventing alarm (the inverse paper-over; fixed: a halt is only a
`deny`/`terminate` decision or a halt-level severity); (3) audit-file matching by plain `startsWith` let
`run-probe12-depth` swallow `run-probe12-depth-ok`'s audit (fixed: assign each audit to its longest-matching
log base). After fixes the numbers cross-check against the raw audit (probe-12: 8 records, llm=2, writes=6,
cost $0.0088 = the `recurse.failed` event's cost).

**The load-bearing lib-facing finding:** a run's **RC-10 receipts tree and the worker `Stream` events
(F15: `loop:tool_call`/`loop:tool_result`) are return-value / console-only — NOT written to the JSONL** (the
audit shows `stream._transport:null`; receipts live in `result.receipts`). So a *pure-replay* observer can
only reconstruct grounding from the app-level `boundary.map` and spawn shape from the audit lineage — it
cannot show a real per-node verdict tree because that tree is never persisted. **Carry-forward for G1–G3 +
the graduated build:** probes must emit a `receipts` event (persist `result.receipts` to the log) and wire
`ctx.stream` to the `JsonlTransport` so worker tool-calls land in the stream; the observer already renders a
`receipts` event as `tree.source='receipts event (run-persisted RC-10 tree)'` when present. Not a lib defect
— a consequence of recurse owning the worker Loop (F12/F15) — but it dictates what every graduation probe
must persist for the observer to be honest. **G4 status: POC-validated over the two existing logs; the G2
replay (probe-16) is the third required log, pending.**

---

*Finding F33 came out of **probe-15** (`poc/probe-15-selfauthored-close.mjs`, PRD §8.2 G1 / Spike 4,
2026-07-02): the crux — who WRITES the close? A two-phase loop (worker self-authors the test suite from a
PROSE request; a deterministic relayfact-owned gate + a hidden GOLD test judge it) on two requests, haiku.*

## F33 — the self-authored close is honest to the degree the SPEC is complete; its failures were SAFE-direction

**Setup (controls that can fail).** Phase A: the worker (tool = `write_test` only, no read tool) authors a
`node:test` suite from prose alone; its grounded Phase-A close is "a hidden REFERENCE impl must pass your
suite" (a correct impl the worker never sees). Deterministic suite-strength gate: (a) STUB must be caught
(suite fails on a no-op); (b) N/M — each acceptance criterion has an otherwise-correct mutant violating
exactly it; N = how many the suite catches (the §1 secondary-goal number done honestly: a criterion is
*grounded* iff the self-authored close can FAIL on its violation). Phase B: the worker (tool = `edit_impl`
only) implements against its OWN suite. GOLD verdict: a hidden test I authored (fresh values the prose never
lists) is the independent truth on Phase B's artifact. Oracle self-checked offline first (reference passes
gold; stub + all 8 mutants fail gold).

**Results (haiku; money ran 3×, csv ran 5×; a scoped signal, not a rate across tasks).**
- **money (fully-specified: every criterion pinned with an example) — 3/3 HONEST.** Suite grounded **4/4**
  criteria, caught the stub, a correct impl passed it, and Phase B's artifact was **GOLD-correct** every
  run. The agent self-authored an honest, executable close and closed the loop on it, no human touching the
  tests.
- **csv (under-specified: quoting/escaping corners the prose left open) — 2/5 honest, 3/5
  OVER-CONSTRAINED.** When it failed, the worker wrote a *thorough* (33-test) suite that **invented
  assertions for behavior the prose never specified** (e.g. "quote at end of an unquoted field", "four
  consecutive quotes") and its guesses diverged from a reasonable reference — so the Phase-A validity check
  (a correct impl must pass) **caught it and escalated** (`run.escalate`, blocker = "over-constrained"). It
  never reached Phase B on those runs.

**The load-bearing, honest takeaways:**
1. **Self-authored-close honesty tracks SPEC COMPLETENESS.** A fully-pinned spec → a reliable, gold-correct
   self-authored close; an under-specified spec → the agent fills the gaps with its own guessed acceptance
   criteria, which may not match intent. **This is exactly the §5 HITL/rubric boundary, now observed from
   the close-authoring side: spec ambiguity is the residue.**
2. **Every observed failure was the SAFE direction.** Across all 8 runs the scary mode — own-suite GREEN
   while GOLD RED (a self-authored close certifying a wrong artifact) — was observed **0 times**. When the
   suite was accepted (a correct impl passed it + stub caught), the resulting artifact was always
   gold-correct. csv's failures were *over*-specification → caught by the validity check → escalated, never
   silent wrongness. The two-phase gate's "a correct impl must pass your suite" check is what turns a bad
   self-authored close into a safe escalation instead of a false green.
3. **Grounding was strong when present** (4/4 both requests) — the weakness was never "the suite is too
   weak to fail" (vacuous/weak-grounding: 0 observed); it was over-constraint on ambiguous specs.

**Limits I am NOT papering over:** (1) two specs, one small model, small n (money 3, csv 5) — the qualitative
claim is graduation-relevant; the *rate* is not pinned. (2) **fit-to-pass was UNOBSERVED, not disproven** —
haiku's self-authored suites erred toward over-specification, so the unsafe mode never triggered; a weaker
model or a spec that invites a shallow suite could still produce it (that scenario is the honest next test).
(3) The "over-constrained" verdict uses MY reference as the arbiter of "a correct impl"; on genuinely
ambiguous CSV corners the worker's guess is *unspecified*, not provably wrong — which is itself the point
(the ambiguity is the HITL residue), but it means "over-constrained" = "encoded unsanctioned decisions",
not "wrote buggy tests". (4) A probe-side verdict-logic bug was caught + fixed mid-run: the first pass
excluded escalated (`broken-suite`) requests from the denominator and printed a false `g1.PASS` — the
inverse paper-over; now every request counts and each fail-mode is named (over-constrained / fit-to-pass /
weak-grounding / vacuous / unclosed / no-close).

**G1 status:** the honest signal is **positive-with-a-caveat** — a self-authored close is trustworthy on a
complete spec and fails SAFE on an incomplete one (over-constrain → escalate), with the unsafe fit-to-pass
mode unobserved but not excluded. This maps the request-IN boundary onto the same doctrine as the rest of
relayfact: *the grounded close (here, stub-catch + a-correct-impl-must-pass + independent gold) is what keeps
even a self-authored close honest — the spec's completeness sets where HITL fires.*

**SONNET ARM run (2026-07-03, the previously-unrun production-model arm; now unblocked by BA-10).**
`RELAYFACT_MODEL=claude-sonnet-5`, both fixtures, fresh log `run-probe15-sonnet.jsonl`. Result: **both honest,
both GOLD-correct, `failModes=[]`** — `money` 4/4 grounded / gold-green / 1 Phase-B iter; **`csv` 4/4 grounded /
gold-green / 3 Phase-B iters.** The notable delta: **on the SAME under-specified `csv` prose that haiku
*over-constrained* (2/5 honest, 3/5 over-constrained-and-caught), sonnet authored a 4/4-grounded suite and drove
its own close to a GOLD-correct impl in 3 gap cycles** — GOLD uses fresh values the prose never lists, so sonnet
got the *convention* right, not memorized values. Interpretation, **at the altitude the construction supports**:
- **The under-spec → HITL-residue boundary is MODEL-MODULATED.** F33's "spec completeness sets where HITL fires"
  gains a second axis: a more capable worker needs *less* spec completeness to stay honest — the csv gap that
  tripped haiku into over-constraining, sonnet resolved within the loop. This is the same F20 thesis (the worker
  is the ceiling) seen from the request-IN side.
- **Fit-to-pass STILL unobserved — now on the CAPABLE end too (0/2 sonnet + 0/8 haiku = 0/10).** Unobserved ≠
  excluded, and this does NOT strengthen toward "can't happen": the two failure directions are *over*-constrain
  (haiku, safe) and clean-pass (sonnet) — neither is the unsafe own-suite-green/GOLD-red. The load-bearing
  negative remains unhunted; the honest next test is a MORE adversarial / shallow-inviting spec (csv no longer
  stresses over-constraint on sonnet) or the weak-model corner (haiku already fails SAFE there).
- **BA-10 re-verified through a different probe:** the temperature fallback fired once per phase on sonnet and
  every leaf ran (iterations 1/1/1/3) — probe-15 corroborates the probe-16 BA-10 verify.

**G1 status (updated):** positive-with-a-caveat **holds and widens** — a self-authored close is trustworthy on a
complete spec and, on an incomplete one, either fails SAFE (weaker model over-constrains → escalates) or is
resolved within the loop (stronger model), never silently wrong across 10 runs; the unsafe fit-to-pass mode is
still unobserved, so keep the independent hidden GOLD as the arbiter and treat a more-adversarial spec as the
outstanding G1 probe. n=1 fixture/request per model — a scoped signal, not a rate.

**ADVERSARIAL FIT-TO-PASS HUNT (2026-07-03) — two FULLY-specified but shallow-inviting fixtures, built to
actually trigger own-suite-green/GOLD-red; oracle self-checked offline before each spend.** Motivation: `csv`
over-constrained (safe) and everything else passed; fit-to-pass was unobserved but never *hunted* on a spec
designed to induce it. Two new fixtures (added to `probe-15`):
- **`truncate(str,max)`** — a subtle "the ellipsis counts toward `max`, so a truncated result is EXACTLY `max`
  chars" invariant. **haiku: HONEST, 3/3, gold-correct.** Its self-authored suite pinned the length invariant
  (the single worked example `'deplo…'` likely aided). No fit-to-pass. (Noted weakness: the example inoculated
  the shallow spot — hence the sharper second fixture.)
- **`titleCase(str)`** — the shallow clause "every OTHER letter becomes lowercase" is stated but the worked
  example uses all-lowercase inputs, so it does NOT exercise it (a shallow suite testing only lowercase inputs
  would pass a naive `w[0].toUpperCase()+w.slice(1)`; GOLD's `'iOS'→'Ios'` catches it). **haiku:
  OVER-CONSTRAINED → escalate (SAFE)** — its suite (3/3, strong) rejected the correct reference because it
  encoded the *conventional* title-case (`"don't"→"Don't"`, `"hello123world"→"Hello123world"`), which CONTRADICTS
  this spec's explicit "apostrophes/digits are separators" rule (→ `"Don'T"`, `"Hello123World"`). The
  **"a correct impl must pass your suite" reference gate FIRED** and escalated instead of shipping. **sonnet:
  HONEST, 3/3, gold-correct** — read the literal spec correctly and authored a suite a correct ref passes.

**What the hunt establishes (the sharpened mechanism).** A self-authored close has exactly two failure modes:
**over-constrain** (suite demands more/other than the spec → caught by the *reference gate*: a correct impl must
pass) and **fit-to-pass** (suite demands LESS than the spec → caught only by the *independent GOLD*). Across
**every** G1 run to date (money, csv, truncate, titlecase × haiku/sonnet), **the only failures were
over-constraint — all SAFE, all reference-gate-caught; fit-to-pass NEVER fired**, even on a fixture built to
bait it. The over-constraint gate is now empirically **load-bearing** (it fired on haiku/titlecase, a fresh
adversarial case — not just theory). Two honest reads of *why* fit-to-pass stays elusive: (1) these models,
when capable enough to author a ≥3/3-grounded suite, err toward asserting TOO much (thoroughness / convention),
not too little — the lazy under-testing that yields fit-to-pass wasn't exhibited; (2) **model-modulation,
confirmed twice** (csv, titlecase): on the SAME spec subtlety the weaker model over-constrains (safe fail) while
the stronger reads it correctly. **Bounds I am NOT papering over:** fit-to-pass is **unobserved, not impossible**
— 0-of-N is not "can't happen"; only two models (haiku/sonnet) and small-function fixtures were tried; a
genuinely weaker model, or a spec that hides the shallow clause AND avoids counterintuitive literalness (a narrow
target), could still trip it. **Keep the independent hidden GOLD as the standing arbiter** — it is the only guard
against the one mode the reference gate cannot see. Also note: `titleCase`'s over-constraint was partly provoked
by a *counterintuitive* literal spec (apostrophe-as-separator) — a real observation (workers weight convention
over a weird literal rule, and the gate catches the divergence safely), but it means "over-constrained" here =
"encoded convention against a counterintuitive spec", not "wrote buggy tests".

## F34 — G2's production model (`claude-sonnet-5`) can't run `refineLeaf` at all: escalating temperature hits a 400 → silent `incomplete` (→ BA-10)

**Context.** G2 (`poc/probe-16-realtask-e2e.mjs`) is the first probe to run the *whole pipe* on an **uncrafted
real repo** and the first to use a **sonnet-class production model** (every prior probe was haiku). The repo:
`~/PycharmProjects/flightlog @ d60011a` — a real 2026-06-01 bug fix (the `examples/read.js` jq-hint dropped
every `--match` filter but `--where`) locked by a **human-written regression test**. Checked out the **parent**
(`147eaed`) + dropped the human test on top → suite RED (bug present); task = "make the suite pass"; close =
`node --test test/examples.test.js`; the gate's `writeScope` excludes `test/` so the close is **ungameable**;
an independent GOLD (fresh `--match host=web01`) catches a `proc`-hardcode fit-to-pass. **Oracle self-checked
offline, token-free, BEFORE spending:** parent+humantest = 10 pass / **1 fail** (exactly the new test — the
control that can fail, fails); +real-fix = 11/0 green; the `proc`-hardcode mutant is **human-close GREEN but
GOLD RED** (fit-to-pass is catchable). The fixture + gold are valid.

**What actually happened on the first sonnet run.** **Zero LLM calls, zero sensor calls, `$0`, `incomplete`.**
Not "the model failed the task" — **no attempt was ever made.** Isolated by bisection (all live, sonnet-5 vs
haiku, same config):
- tools-only worker (no `refineLeaf`): **works on sonnet** (reads the repo, answers).
- `refineLeaf` added: **haiku** → `sensorCalls=2`, `receipts.refineLeaf={iterations:2,passed:true}`; **sonnet-5**
  → `sensorCalls=0`, `incomplete=true`, `refineLeaf=undefined`.
- direct `provider.generate(..., {temperature})` on sonnet-5: `0.2/0.4` → **400 `"temperature is deprecated for
  this model."`**; `1.0` or **omitted** → OK.

**Root cause (grounded).** `recurseRefineLeaf`'s `attempt` passes an **escalating `temperature`** per retry
(`recurse.js:609` + `:621`); `AnthropicProvider.generate` forwards it unconditionally (`provider-anthropic.js:84`);
sonnet-5's API rejects any non-default temperature with a 400 (`_request`, `provider-anthropic.js:186–190` — it
is the **upstream** error, no `"deprecated"` string exists in the provider). The first attempt (temp `0.2`) →
`out.error` → `attempt` rethrows (`recurse.js:624`) → `refine` catch → `node.incomplete=true` (`recurse.js:656`).
**The sensor — the executable close — is never reached.** haiku accepts `temperature`, so it's unaffected. This
is a **real bareagent integration bug the toy fixtures never exposed** (they all ran haiku): **BA-10**, a
one-place provider graceful-degrade (on that specific 400, drop `temperature` + retry once, keyed off the API
text, not a model list).

**Second-order (the more interesting finding).** BA-8's own hand-off calls temperature escalation *"a design
REQUIREMENT of the leaf-refine seam"* — but that was measured with the retry prompt held CONSTANT (temperature
the only diversity source). relayfact's `refineLeaf` **feeds the grounded close's gap critique forward every
iteration** (`recurse.js:618`), so the prompt already changes each retry: **the critique is the correction
lever; temperature is a secondary diversity lever.** On a temperature-fixed model that lever is *inert* — so the
open empirical question (answered once BA-10 ships) is **whether flat-temp + gap-critique still converges on
sonnet.** If it does, "escalation is REQUIRED" was an artifact of the no-critique POC, and the seam is healthier
than its own note claims. Also: `node.refineLeaf.temperatures` (`recurse.js:636`) would **misreport** silently
dropped temps — it should record the *effective* temperatures.

**Honest status.** **G2 is NOT yet run for real** — the production-model arm is **blocked by BA-10** (🔴), and
the haiku arm is a *control*, not the production datapoint, so running only haiku now would answer a weaker
question than G2 asks (the PRD calls the sonnet↔haiku contrast "the datapoint"). Per doctrine I did **not** grow
a workaround (`temperatures:[1.0,…]` would be exactly the silent workaround forbidden here, and would defeat the
seam's escalation design). **What G2 has produced so far is a genuine graduation finding, not a papered-over
pass:** the intended production model cannot use the self-correcting leaf seam as shipped. Next: BA-10 fix at the
lib → verify-shipped-vs-spec → re-run G2 sonnet+haiku (which also answers the flat-temp-convergence question).
The scaffold, oracle, gold, gate-ungameability, and observer emission are all built and de-risked
(token-free-validated); only the model-path fix stands between here and the real-task numbers.

**RESOLVED (2026-07-03).** BA-10 shipped in `bare-agent@0.24.0` (`requestWithTemperatureFallback`: drop
`temperature` + retry once on the deprecation 400, warn once, flow `temperatureDropped` back). **Verified by
running:** sonnet-5 + `refineLeaf` → `sensorCalls=2`, `iterations=2`, `passed=true`, effective
`temperatures:[null,null]`; haiku still escalates `[0.2,0.7]`. G2 then ran for real — see **F36**. And the
flat-temp question is answered: on sonnet the leaf converged in **one** attempt (0 refine iterations needed),
so the gap critique — not temperature escalation — carried it; escalation was never exercised because the first
attempt already passed. Escalation's necessity remains open only for tasks that *fail* the first attempt.

## F35 — bareguard's default `content.askPatterns` scan the write PAYLOAD → false-fire on code vocabulary → budget-burn (→ BG-3)

**What happened (reproduced live, probe-16, BOTH arms, before the fix).** The G2 task is to fix a bug about
**dropping** filters; the fix edits `examples/read.js` code + comments containing "drop"/"remove". bareguard's
default `content.askPatterns` (`content.js:27`, `/\b(delete|drop|revoke|truncate|destroy|remove|purge)\b/i`)
are tested against `JSON.stringify(action)` (`serializeForMatch`, `content.js:32`) — the **whole action incl.
the write payload**. So every fix-write serialized with those whole words → `askHuman` → the probe's auto-deny
`humanChannel` → **write denied**. The worker retried ~16 llm calls, **burned the full $1 budget cap**, halted,
and the refine **sensor was never reached** — surfacing as `incomplete`. Sonnet and haiku failed *identically*;
the `sel`-array fix was never applied. **Token-free mechanism proof:** `gate.check` on a write whose `contents`
contains whole-word "drop"/"remove" → `outcome:deny, rule:content.askPatterns`; with `content:{askPatterns:[]}`
→ `outcome:allow`. (Note `\bdrop\b` does NOT match "drop**s**" — the real matches were whole-word occurrences in
the worker's edits, which is why an early test string with "drops" spuriously "passed".)

**Why this is a bareguard design issue, not just my misconfig.** (1) **It scans the wrong field** — the
patterns target destructive *operations* (SQL/rm/HTTP, an intent/command signal), but serializing the whole
action fires them on a write whose *payload text* merely mentions the word; code is saturated with
delete/remove/drop, so it false-fires on **every coding agent, permanently.** (2) **`fs.writeScope` is the real
guard for a write**, not a keyword scan of its bytes — an in-scope write (`examples/`+`src/`, `test/` excluded)
is safe regardless of the text. (3) **The failure mode is expensive + misleading** — a false `askHuman` under
auto-deny doesn't fail cleanly; the loop retries and exhausts the budget, and it reads as "the model couldn't do
it" (`incomplete`), not "governance denied a benign action." A false positive here is a budget-burn +
wrong-diagnosis multiplier.

**Honest process note (why this finding exists in this shape).** I first only *worked around* this in relayfact
(`content:{askPatterns:[]}`) and logged it as a config lesson — the user correctly flagged that as a silent
workaround: the doctrine is surface-and-fix-at-the-lib. So this is now **BG-3** (the maintainer may still rule
works-as-intended like BG-2, but decides it with the budget-burn multiplier on the table). The relayfact-side
`askPatterns:[]` is a **disclosed** override for an editor-only worker (no bash/network → the default patterns
protect nothing here), **pending BG-3** — a deployment that adds bash/network must re-scope the patterns to the
command, not disable them wholesale.

**SETTLED with the bareguard maintainer (2026-07-03) — including an attribution correction I concede.** The
maintainer accepted the core (payload scanning is the wrong layer: `content` is for destructive *operations*,
`secrets` owns payload inspection, `fs.writeScope` guards the write, and *executing* the bytes — a later `bash`
action — is the dangerous act, caught then). The fix is **narrower and better** than my opt-1: `serializeForMatch`
**excludes the write/edit payload field(s)** (`content`/`contents`) before matching, applied to **both** deny and
ask (the deny path is worse — `DROP TABLE` in a migration file's bytes currently *hard-denies*, unrecoverable),
staying **shape-agnostic** otherwise. My opt-1 (a field *allowlist*) was rejected for good reason: it couples
`content.js` to every primitive's field vocabulary and **fails silent** on a novel action shape (a silent hole in
a safety floor is worse than a loud false-fire). Rejected too: `content.scope` (YAGNI) and any retry-signal.
**Attribution correction:** the **budget-burn** symptom ("$1 cap → `incomplete`, sensor never reached") is **not**
bareguard's — bareguard is stateless per `check()`. It is **bareagent's `refineLeaf`/worker Loop retrying a
governance-denied action** rather than short-circuiting → filed as **BA-11** (a governance deny ≠ a recoverable
tool error). bareguard's share is exactly stopping the false-fire. I originally over-attributed the burn to
bareguard; the maintainer was right to split it. Verified for them: the complete payload-field set today is
`content` (shell_write) + `contents` (edit_file) — no diff-tool ships, `type:'edit'` reserved-unused.

**RESOLVED (2026-07-03).** BG-3 shipped in `bareguard@0.11.0` — `serializeForMatch` strips
`PAYLOAD_FIELDS = ["content","contents"]` from a non-mutating `args` copy before matching, for both deny + ask.
**Verified-shipped by RUNNING (`poc/probe-19-bg3-verify-shipped.mjs`, token-free, 5/5, control-can-fail):**
payload code-vocab incl. literal `DROP TABLE` bytes → **allow/`default`**; `DROP TABLE`/`rm -rf` in a bash `cmd`
→ **deny/`content.denyPatterns`**; `method:DELETE` → **ask/`content.askPatterns`** (proven via the audit's
pre-human askHuman line — the strip does not blind the operation fields). relayfact's disclosed override
(`content:{askPatterns:[]}`) **removed** from probe-16, default guards left ON. The paired budget-burn
half is **BA-11**, shipped `bare-agent@0.25.0`, verified token-free by `poc/probe-20-ba11-verify-shipped.mjs`
(guard fires at exactly the threshold; OFF spins to the cap — load-bearing). See also **F37** (the
`PAYLOAD_FIELDS` extension point is documented but unreachable through the public export surface).

## F36 — G2 RESULT: the whole pipe delivered a real bug-fix on an uncrafted repo, first attempt, gold-correct, both models

**Setup (uncrafted by construction; oracle self-checked offline BEFORE spending).** `flightlog @ d60011a` — a
real 2026-06-01 fix (the `examples/read.js` jq-hint dropped every `--match` filter but `--where`) locked by a
**human-written** regression test. Checked out the **parent** (`147eaed`), dropped the human test on top → suite
RED. Task = prose bug report ("make the failing suite pass"); close = `node --test test/examples.test.js` (the
human test, relayfact-owned, `writeScope` excludes `test/` → **ungameable**); worker tools = `shell_read` +
`edit_file`; leaf-refine sensor = the close, gap fed back; observer (G4) attached. Independent **GOLD** = a
relayfact test with a **fresh** `--match host=web01` field (catches a `proc`/`where` hardcode). Oracle validated
token-free: parent+humantest = 10 pass / **1 fail** (the control that can fail, fails); +real-fix = 11/0; the
proc-hardcode mutant is **human-close GREEN but GOLD RED** (fit-to-pass catchable).

**Result (n=1 real task; sonnet = production, haiku = A/B control; the CONTRAST is the datum, not a rate).**

| arm | verdict | interventions (bar ≤2) | refine iters | close | GOLD | cost | llm calls |
|---|---|---|---|---|---|---|---|
| **sonnet-5** (prod) | ✅ delivered | **0** | 1 | green | green | **$0.07–0.12** | 3–5 |
| **haiku** (control) | ✅ delivered | **0** | 1 | green | green | **$0.13** | 9 |

Both wrote the **general** fix (`...Object.entries(opts.match||{}).map(...)` — conceptually the human fix, not a
proc-hardcode: the fresh-field GOLD passed), on the **first attempt** (`0` gap-feedback cycles vs F20's trivia
baseline of **6**), `groundedCalls=1` (F13 holds — grounded close ran exactly once at the top), `maxDepth=0`
(atomic single-file task, honest for a localized bug). Well under the $1 cap. Sonnet used fewer calls (3–5 vs 9)
at similar/lower cost.

**What this establishes for graduation.** The *whole pipe* — prose request → grounded contract → worker →
executable close → deliver — runs as one program on an **uncrafted real repo** and produces a **gold-correct**
fix within the intervention bar and cost cap, on **both** the production and control models. F20's "the worker
is the ceiling, measured on trivia" now has a real-task datapoint: on a genuinely localized real bug, a
capable model needs **zero** hand-holding, and the grounded close (human test) + independent GOLD keep it
honest (no fit-to-pass). **Honest limits:** n=1 task, one localized single-file bug (not a multi-file or
cross-module change; no organic decomposition exercised here — that is probe-04/12's evidence); the close is a
*human-authored* suite (G1 covers the *self-authored*-close case separately); the `agentic` eval tier still
unrun (predicate-only). Two real integration bugs surfaced en route — **BA-10** (temperature, fixed+verified)
and **BG-3** (content-guard false-positive, filed) — neither a relayfact bug; both are exactly the lib friction
this experiment exists to find. G2 status: **PASS.**

**RE-RUN without the BG-3 override (2026-07-03, after BG-3 shipped in bareguard 0.11.0).** Dropped
`content:{askPatterns:[]}` from probe-16 — **default content guards ON** — and re-ran both arms. Both `g2.PASS`,
`interventions=0`, close green + GOLD green, `fitToPass=false`, `groundedCalls=1`, `maxDepth=0`, baseline
control RED first (holds): **sonnet-5** `$0.095`, 4 llm calls (BA-10 temperature-fallback fired + recovered);
**haiku** `$0.088`, 7 llm calls. So BG-3 is verified **through the whole pipe**, not just token-free (F35/probe-19):
the fix-write about "DROPPED filters" now passes the default guards instead of false-firing → auto-deny → burn.
The disclosed workaround is gone and G2 stands on stock library defaults. Logs: `run-probe16-{sonnet,haiku}.jsonl`.

## F37 — BG-3's `PAYLOAD_FIELDS` extension point is documented as an export but is unreachable through the public surface

**What happened (found while verify-shipping BG-3, `poc/probe-19`).** bareguard 0.11.0's changelog documents
`PAYLOAD_FIELDS` as "**a new export**" and the sanctioned way to extend the payload-strip ("Extend via the
exported `PAYLOAD_FIELDS` only when a real write primitive adds a distinct payload field"). But `import
{ PAYLOAD_FIELDS } from 'bareguard'` **throws** `does not provide an export named 'PAYLOAD_FIELDS'`: it is
exported only from `src/primitives/content.js`, which `src/index.js` does **not** re-export, and the package
`exports` map exposes only `"."` and `"./types"` — so a deep import (`bareguard/src/primitives/content.js`) is
also blocked by Node's `exports` enforcement. **Net:** the documented extension point cannot be reached by any
consumer. **Severity: 🟢 low / docs-vs-code mismatch** — the *fix itself* works (verified 5/5); this only affects
a consumer who wants to register a new payload field, and today the built-in set (`content`/`contents`) is
complete for both callers (shell_write, edit_file), so nothing is blocked in practice. **Not worked around**
(relayfact needs no custom field): filed as a bareguard follow-up — either re-export `PAYLOAD_FIELDS` from
`index.js` (and, ideally, accept a `content.payloadFields` config so extension doesn't require mutating a shared
module-level array), or soften the changelog's "export"/"extend via" wording to match what actually ships.
Grounded at `src/index.js` (no re-export) + `package.json` `exports` (no `./primitives` subpath).

**RESOLVED (2026-07-03, bareguard 0.11.1 — owner chose "Option A", declined the config key).** The owner
**declined** the `content.payloadFields` config (option 2): zero demand, no adopter (not even relayfact) hit it,
`["content","contents"]` is complete for every shipping write tool, and a permanent 1.0 config surface to satisfy
a loosely-written changelog line is the tail wagging the dog. The right fix for a dead-config *implication* is
to *stop implying the knob*, not build it. Shipped instead: **export `PAYLOAD_FIELDS` from `index.js` for
read-only introspection, `Object.freeze` it** (the mutate-the-global path now fails **by construction**, not by
docs), and **reword** the changelog + `content.js` JSDoc to "introspection + fix-at-the-lib (a one-line PR to
`PAYLOAD_FIELDS`)", not "extend by mutation". A consumer needing different behavior already has full control via
`content.{ask,deny}Patterns`. **Verified-shipped by RUNNING (relayfact, 2026-07-03, 4/4):** import reachable
(was a throw); value `["content","contents"]`; `Object.isFrozen` true; `.push("body")` throws + leaves the array
unchanged. Net: the factual bug ("is a new export" — false in 0.11.0) is fixed and the dead-config implication is
gone, with **zero** added config surface.

## F38 — G3 (the come-back): a decision-ready escalation assembles across every stop-class; pre-flight's safety corners hold, its soft middle is fuzzy (as §5 predicts)

**What was built (`poc/probe-17-comeback.mjs`, PRD §8.2 G3).** The loop returns a bare `{incomplete}`; G3 is the
two pieces relayfact OWNS on top of that (§5.1): **(a)** an escalation artifact — one structured, human-actionable
report `{ goal, whatWasTried[], blocker(which §5 trigger), decisionNeeded{question,options}, receipts, costSpent }`
emitted as a terminal `run.escalate` event (observer renders it); **(b)** a pre-flight rubric that classifies a
request `{ proceed | clarify | decline }` BEFORE spending — rubric may OPEN HITL, never CLOSE green.

**(a) — PASS, token-free, every stop forced by REAL execution (not hand-authored).** Five §5 stop-classes each
assembled a **decision-ready** artifact: **close-exhausted** (a real `refine()` whose deterministic-wrong worker
failed a real grounded close 3× → a real `history` of gaps), **budget-cap** (a **real bareguard** `budget.maxCostUsd`
halt after recording over-cap spend), **governance-deny** (a **real BA-11** deny-spin short-circuit, stopped at 3),
**rubric-uncertain** (the §5 residue: grounded checks green but advisory rubric unsure → OPENS HITL), and
**preflight-declined** (routes to (a) with **0 spend**). **CONTROL THAT CAN FAIL held:** `isDecisionReady`
**rejected** a raw `{incomplete}` (the thing G3 replaces), a report with <2 options, and an attempt-bearing stop
with an empty `whatWasTried` — so the acceptance predicate is not a rubber stamp.

**Design finding (parallels F32):** `recurse` persists only the `refineLeaf` **summary** (`{iterations, passed,
temperatures}`), NOT `refine`'s per-attempt `history` (`{result, verdict}[]`) — so the artifact's `whatWasTried`
cannot be read back from the recurse receipt. Resolved **within relayfact's ownership**: relayfact owns
`opts.evaluate` (the sensor), which is called each iteration, so it self-captures `(attempt, verdict, gap)` and
emits them. No lib dependency; filed the "recurse drops `refine.history` from its receipt" as a low observer-nicety.

**(b) — PASS on the gated corners, honest soft-middle divergence (real haiku, ~$0.05, 3 calls).** The two SAFETY
corners are hard-gated and **held**: a **coherent** request was NEVER declined (haiku returned `clarify` — asked for
context, a safe HITL-open, not a false-block), and **nonsense** NEVER proceeded (`decline`). The soft middle is
model-calibrated and fuzzy: **"make it better" → `decline`** (I expected `clarify`) — reported as a soft miss, not
pass-gated, and arguably *more* correct (contextless "make it better" is effectively non-actionable). **This is the
§5 prediction, observed from the pre-flight side:** the proceed/clarify/decline boundary is exactly the rubric
residue — advisory, model-dependent, never load-bearing; what MUST hold (never false-block a real task, never
false-go on nonsense) held. Every decline produced a decision-ready come-back with zero spend.

**Honest limits.** n=1 per class; one model (haiku); the rubric-uncertain stop uses a deterministic advisory stub
(the point under test is that the residue ROUTES to a decision-ready come-back, not that the rubric is a live model
— that calibration is the pre-flight (b) evidence). The pre-flight soft-middle is n=1 per class; a larger sample
would characterize the clarify/decline boundary, but the safety corners are the graduation-relevant claim.

---

## F39 — src/ step "assemble the pipe": the four proven pieces compose into ONE program, live e2e green (n=1, named)

**Status:** src/ build capstone (`src/pipeline.mjs` + `src/observer.mjs::renderRun`). The G1–G4 pieces
(pre-flight, compile-close, gated worker, escalation) were assembled into a single top-level `runRequest`
that takes **prose + a repo dir** and returns **DELIVER green** or a **decision-ready `run.escalate`**, every
step narrated to the append-only event log (§7). This is the §5 pipe drawn as shipped code; it builds no new
engine — it only composes.

**Live e2e (real haiku, ~21s, 2 token-spending phases):** `proceed` → self-authored close **trusted** (5/5
mutants killed, reference passes) → gated worker **red→green** through the leash → **independent GOLD green on
fresh values (7,-9,0 — never in the prose)** → **DELIVER, grounded 1/1**. The pure-listener observer rendered
the whole timeline from the persisted log alone. Event sequence asserted exactly:
`run.start → preflight → close.compiled → receipts → worker.done → gold.checked → run.deliver → run.end`.

**Two gates by design (a real assembly constraint, not a workaround):** the author writes ONLY the suite; the
worker writes ONLY the impl (write-scope EXCLUDES the suite, so own-green can't be gamed). One shared gate
cannot express both scopes — the pipe threads the author's gate through the injected `authorSuite` closure and
takes the worker's gate directly. Correct by construction.

**D5 kept as the standing arbiter (permanent, not a probe):** own-green is necessary, not sufficient — the pipe
runs the INDEPENDENT GOLD (written only AFTER the worker finishes, never visible to it) and **own-green + GOLD-red
⇒ NEVER deliver** (`gold-mismatch` escalation). This tripwire is fail-capable and proven token-free: a
deliberately-wrong impl that passes its own suite is caught RED by GOLD and escalated; the correct impl passes both.

**Two escalation stop-classes the assembly genuinely needed** (relayfact-owned decision routing, NOT lib
primitives): `close-untrustworthy` (the self-authored close failed the validity gate — vacuous/over-constrained/
weak-grounding) and `gold-mismatch` (the D5 fit-to-pass tripwire). Both attempt-bearing; both emit decision-ready
come-backs (`isDecisionReady` asserted true on every escalation branch, and it can fail — a bare `{incomplete}` is
rejected).

**Honest limits (named, per the antigen).** The live e2e is **n=1 on the `double()` fixture, one model (haiku)** —
it proves the assembled WIRING reproduces the G1/G2/G3 shapes end-to-end **as one program**; it is NOT a fresh
honesty or cohort claim (that is step 5's ≥3-real-task cohort, **D7**). The GOLD-red direction is verified
**token-free**, not live. Memory (litectx close-driven widening, **D3**) is deliberately NOT wired here — it is its
own careful session (memory is where the probes got caught fit-to-pass). costSpent in escalations is audit-derived
best-effort via `gate.haltContext()`; the observer shows authoritative cost from the audit JSONL.

**src/ suite:** 58 tests / 52 pass / 6 live-skip, 0 fail; the observer §7 pure-listener contract (imports only
`node:fs`) still holds after adding `renderRun`.
