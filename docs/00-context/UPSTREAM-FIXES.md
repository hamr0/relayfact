# relayfact — upstream fixes needed (and to whom)

**Purpose.** relayfact builds **no primitives**: when it hits a gap, that is a finding against a lib, fixed
**at the lib** (propagated from the `hamr0` origin), never papered over here. This doc is the actionable
ledger of those asks — *exactly what to change, in which lib, at what severity* — derived from
[`FINDINGS.md`](./FINDINGS.md) (F-numbers cited). It is the hand-off to the lib maintainer.

**Doctrine (how this list is worked).**
1. **Surface, don't work around.** Every entry is grounded in source (`file:line`) and traced to a finding.
2. **Fix at the lib, then wait.** A blocking ask **pauses relayfact** until the lib ships the fix
   (verify-shipped-vs-spec on return). A non-blocking ask is propagated and tracked, and relayfact may
   continue in parallel **only** where the finding does not taint the result it is measuring.
3. **"Works as intended" closes an ask** — it is not a silent drop; it is recorded as resolved with the reason.

Status legend: 🔴 **blocking** · 🟠 **non-blocking / propagate** · 🟢 **shipped/resolved**.

---

## bareagent (`bare-agent`, currently v0.23.0)

| # | Finding | Severity | Status | The fix |
|---|---|---|---|---|
| BA-1 | F16 | 🔴 security | 🟢 **SHIPPED v0.22.0** | `recurse()` strips the live `provider` from the audited `_ctx` via `auditSafeCtx()` at every governance boundary (worker `Loop.run`, both pre-wave `ctx.policy` checkpoints, `scanCount`). Mutation-proven + on-disk repro POC (`poc/ba1-audit-leak-ondisk.mjs`). **Ready for verify-shipped-vs-spec.** |
| BA-2 | F6 / F8 | 🟠 completeness | 🟢 **SHIPPED v0.22.0** | `createShellTools()` ships `shell_write` (no-shell write/append, parent-dir create, 5MB cap); gates via `fs.writeScope` when translated to `{type:'write'}`. POC `poc/ba2-write-tool-gate.mjs` proves allow-in-scope / deny-out-of-scope-before-execute. |
| BA-3 | F7 | 🟠 doc / sharp-edge | 🟢 **SHIPPED v0.22.0** | `with-bareguard.mjs` rewritten with a real `actionTranslator` (shell→bash/fs primitives), `onToolResult`+`onLlmResult` (dropped deprecated `wrapTools`), and `result.metrics.costUsd`. |
| BA-4 | F10 | 🟠 doc | 🟢 **SHIPPED v0.22.0** | `litectx-as-store.mjs` now uses `new LiteCtx({ root })` (temp dir, cleaned up); runs the litectx half end-to-end. |
| BA-5 | F15 | 🟠 observability | 🟢 **works-as-intended — documented (v0.22.0)** | Confirmed: worker Loops emit `loop:tool_call`/`loop:tool_result` to `ctx.stream` (loop.js). Documented on `RecurseCtx.stream` JSDoc (stream + RC-10 receipts + gate audit are the substrate; no `onToolCall` callback by design). |
| BA-6 | F11 / F17 / F30 | 🟠 doc / behavior | 🟢 **SHIPPED v0.22.0 — nuance VERIFIED (F30)** | Documented at `with-bareguard.mjs`'s `humanChannel`: `deny` denies one action (loop continues; under `refine` it can keep spending); `terminate` is the clean-halt (`HaltError`) path. **F30 (`poc/probe-14`) verified the nuance by running:** under the bare `refine` primitive, `terminate` **STICKS** (`gate.terminated` becomes the halting rule for later iterations — a clean, unambiguous stop-signal) but does **NOT self-stop** the spend (each fresh-Loop iteration makes its first LLM call before the gate is consulted → same call count as `deny`); the caller still needs the probe-02 latch. **Under `refineLeaf` (the leaf path relayfact uses) a budget cap halts cleanly after exactly 1 over-cap call** (verified) — no latch needed there. *Doc could note: `terminate` is self-executing under `Loop`/`refineLeaf` but NOT under bare `refine` — there the caller must break on `gate.terminated`.* |
| BA-7 | F12 | 🟢 | **SHIPPED v0.21.0** | `opts.persona` worker-stance seam (augments, carries down, not on the verifier). |
| BA-8 | F17 | 🟠 enhancement | 🟢 **SHIPPED + VERIFIED v0.23.0** | `recurse({ refineLeaf: { sensor, maxIterations?, temperatures? } })` — a definite leaf (`!canSpawn`) runs as a bounded generate→sense→regenerate loop (reuses `refine.js`); deterministic sensor, GAP fed fresh, **escalating temperature** (the load-bearing finding). Gate-bounded; honest non-recovery (`receipts.refineLeaf.passed`); carries down. **Verified-shipped (F21, `poc/probe-05`): recover arm `iterations=2,passed=true,temps=[0.2,0.7]` + result carried a critique-only token (gap-feedback proven); never arm `iterations=3,passed=false` (honest non-recovery).** |
| BA-9 | F19 | 🟠 enhancement | 🟢 **SHIPPED + VERIFIED v0.23.0** | `recurse({ context })` — a read-only working-context string prepended to every worker's task message + forwarded to the Planner as `info` + shown to the verifier; carries down via `forChild` (distinct from `persona`). Replaces the persona-laundering workaround. **Verified-shipped (F21, `poc/probe-05`): context arm read the ABS path + recovered the token; no-context control DENIED (reproduces F19) — proves the channel, not a rig.** |
| BA-11 | F35 | 🟠 robustness | 🟢 **SHIPPED + VERIFIED v0.25.0** | A **governance deny** returned to a worker's tool call was retried like any other tool failure — the model tries a variant next turn, gets denied again, and the `refineLeaf`/worker Loop **burns the budget to the cap** (probe-16 pre-BG-3: 16 calls → $1, sensor never reached, surfaced as bare `incomplete`). **Fix: `new Loop({ maxConsecutiveDenials })` (default 3)** — a run-scoped counter incremented on each policy deny, **reset to 0 on any allowed tool call** (allowlist-pivot preserved). At threshold the Loop seals dangling tool_calls and returns cleanly `{ error:'denied:<tool>', … }` (never throws — mirrors the halt-return). `recurse` maps that to a **LABELED `{ incomplete:true, blocker:'governance-deny' }`** on both the plain-worker and `refineLeaf` paths (+ `receipts.blocker`), so a caller distinguishes a governance block (widen scope / re-gate / escalate) from a model failure. `0`/`Infinity` disables. **POC-corrected design:** a live spike (real haiku) disproved the interleaving risk — a retry-inviting deny made the model spin **8 CONSECUTIVE** denied writes (zero reads interspersed) → consecutive-counting is provably sufficient; a terminal deny made it give up after 2 (guard won't false-fire). **Verified-shipped TWO ways.** (1) **relayfact-side, token-free (`poc/probe-20-ba11-verify-shipped.mjs`, 2026-07-03, 4/4):** a STUB provider (no LLM) re-emits the same `edit_file` call + a deny-all policy = the deny-spin, driven through the installed 0.25.0 `Loop`. Guard default → stops at **exactly 3** (`error:'denied:edit_file'`); guard `=5` → stops at **5** (threshold honored, not hardcoded); **NEGATIVE CONTROL** guard `Infinity`/`0` → does **NOT** stop at 3, spins to the stub cap (13 calls, `error:null`) — the ON-vs-OFF contrast proves the guard is load-bearing. (2) **bareagent-side, live (maintainer's `poc/ba11-negative-controls.mjs`, real haiku):** guard ON → stops at 3; OFF → spins to 9. Composes with **BG-3** (shipped 0.11.0): BG-3 stops the false-fire at the source (so BA-11 no longer fires on relayfact's G2 path); BA-11 remains the backstop for *other* governance denies. *Cross-ref BG-3.* |
| BA-10 | F34 | 🔴 blocking (prod model) | 🟢 **SHIPPED + VERIFIED v0.24.0** | `refineLeaf` hard-codes an **escalating `temperature`** per retry (`recurse.js:609/621`); the Anthropic provider passes it unconditionally (`provider-anthropic.js:84`). `claude-sonnet-5` (the intended production model) **rejects any non-default `temperature`** with a 400 `"temperature is deprecated for this model."` → the first attempt throws → `recurseRefineLeaf` catch → **`incomplete`, sensor NEVER called, 0 LLM calls**. haiku is unaffected. **Fix: graceful degradation in the provider** — on a 400 whose message names `temperature` as deprecated/unsupported, drop `body.temperature` and retry once (model-agnostic; keys off the API error, not a model list). Reproduced live (probe-16 sonnet arm). |

> **Hand-off note (bareagent maintainer, 2026-06-29):** BA-1…BA-6 **SHIPPED in `bare-agent@0.22.0`** — published to npm (OIDC trusted-publishing + provenance), tag `v0.22.0`, [GitHub release](https://github.com/hamr0/bareagent/releases/tag/v0.22.0). All four surfaces agree (npm `latest`=0.22.0, git main, tag, release). Per "fix at the lib, then wait," relayfact can now **verify-shipped-vs-spec** against `npm i bare-agent@0.22.0`: (BA-1) wire a gate with `audit:{path}`, run `recurse` with a key-bearing provider, grep the audit JSONL — the `{type:'llm'}` record should carry the provider NAME but no `apiKey`; (BA-2) `createShellTools()` exposes `shell_write`, denied out-of-scope when translated to `{type:'write'}`. The published suite is green (696 pass / 0 fail / 2 skipped) with the BA-1 (mutation-proven) + BA-2 (writeScope) regressions. **On BG-1:** bareguard 0.9.0 shipped only an **opt-in, value/pattern-based** redactor (`secrets.envVars` ≥8-char values + regex `secrets.patterns`) — NOT auto-redaction by key-NAME. **BG-1 is now BUILT on bareguard `main`**, releasing as **v0.10.0**: a default-on key-aware walk that blanks `apiKey`/`api_key`/`authorization` by name + `Bearer …`/`sk-…` values with **no config required** (extend via `secrets.keys`, opt out via `secrets.redactKeys:false`). **BA-1 alone already closes the recurse-originated leak** (the provider never reaches the audit); BG-1 is the defense-in-depth floor for every *other* path / future ctx. **Verify-shipped-vs-spec once v0.10.0 is on npm.**

### BA-1 — 🔴 `recurse()` leaks the API key into the bareguard audit (F16)
- **Where:** `recurse()` threads its `ctx` — which holds the live `provider` instance — into every worker's
  `onLlmResult`/`gate.record` as `_ctx`. bareguard serializes `_ctx` verbatim, so the audit record's
  `action._ctx.provider.apiKey` is the full `sk-ant-…` key on disk. Confirmed in `poc/run-probe03-*-audit.jsonl`
  (probe-03). Did **not** occur pre-recurse (probe-02 passed a `{ userId }`-shaped ctx, no provider).
- **The fix (bareagent side):** do not place the live provider object into the audited `_ctx`. Options:
  pass a provider **id/name** instead of the instance; or strip `provider` (and any function/secret fields)
  from the `_ctx` snapshot handed to `gate.record`. The worker still needs the provider to *run* — only the
  **audited** copy must be clean.
- **Pairs with BG-1** (bareguard redaction) as defense-in-depth — fix both; neither alone is sufficient
  (bareagent stops leaking *this* secret; bareguard backstops *any* caller that passes one).

### BA-2 — gated write tool (F6/F8)
A senior-dev/coding agent must edit files; `createShellTools()` ships only read/grep/run/exec, and gating
edits *through the shell* is impractical (redirection is a metachar that `bash.allow` force-denies, F8). Ship
a first-class write tool emitting `action.type:'write'` (gated by `fs.writeScope`, no shell). relayfact's
throwaway `edit_file` (`poc/probe-03-replay-recurse.mjs`) is the reference shape.

### BA-3 — `with-bareguard.mjs` example is dead as written (F7)
The example sets `bash:{allow}` + `fs:{readScope}` but wires `wireGate(gate)` with the **default** translator,
which emits `{type:toolName}` and never activates the bash/fs primitives (they fire only on
`action.type ∈ {bash,read,write,edit}`). Either ship a real `actionTranslator` in the example, or add a
one-line warning beside the config so adopters don't believe those caps are live when they are not.

### BA-4 — stale litectx example (F10)
`examples/litectx-as-store.mjs` uses `new LiteCtx({ dbPath })`; litectx ≥0.21 requires `{ root }` and throws
otherwise. Bump the example (or pin/note the litectx version).

### BA-5 — recurse worker observability (F15)
recurse builds worker Loops with `{ provider, system, policy, onLlmResult, stream }` — no `onToolCall`/`onText`.
A consumer can't see worker tool calls via Loop callbacks. **Likely "works as intended"** with `ctx.stream`
as the intended channel — the ask is to **document** that (the tree observer reads stream + RC-10 receipts +
audit, not Loop callbacks) and confirm worker tool-call events actually reach `ctx.stream`. relayfact wires
`ctx.stream` next regardless; downgrade/close if the events are all there.

### BA-6 — `deny` ≠ stop at the humanChannel boundary (F11/F17)
A budget/turn halt routed to a `humanChannel` returning `{decision:'deny'}` denies one action but does **not**
throw — under `refine` the loop retries and keeps spending (F11); under recurse it happens to bound because
the worker is single-pass (F17). Document that `{decision:'terminate'}` is the intended clean-halt
(`HaltError`) path, and that `deny` is per-action only. A doc/clarity ask, not a behavior bug.

### BA-8 — 🆕 leaf retry-with-recall seam (F17; enables memory-as-self-improvement)
- **Where:** recurse builds and runs each leaf worker as a **single `Loop.run`** (no `refine`, no retry — F17).
  A leaf that produces a wrong/incomplete artifact is graded (or not) and returned; it never gets a second
  shot with the gap fed back. So a consumer **cannot** wrap a leaf in retry-with-recall — recurse owns leaf
  construction (F12/§5.1). The only buildable shape today is retrying the **whole tree** (`refine` *around*
  `recurse`), which re-does every slice, not just the failed one.
- **The ask:** let a leaf optionally be a **bounded `refine` loop**: `generate → verify (DETERMINISTIC
  sensor first: test/compile/lint) → pass? return : fail? feed the GAP back (not the transcript) + allow an
  error-keyed litectx `recall` → retry`, capped by the existing guards. Shape: an `opts.refineLeaf` /
  per-leaf `attempt` seam, or letting the worker be a `refine` instance. Sensor is deterministic-first; the
  model judge stays in a separate context (R-S8) and is reserved for taste/intent.
- **Division of labor this enables:** **bareagent** owns the leaf loop + guards + the verify slot;
  **relayfact** supplies the deterministic sensor (its executable close) + the persona; **litectx** owns the
  error-keyed `recall`/`assemble` handle (zero new code there). Without BA-8, the self-correction loop can
  only live at tree granularity. *relayfact will verify-shipped-vs-spec on delivery.*

### BA-9 — 🆕 thread a read-only context blob to children (F19)
- **Where:** the Planner decomposes the parent task into child subtasks but **drops the concrete context**
  (absolute paths, cwd). A child gets *"Fix ma.js: implement fa to return a+b"* with no idea where `ma.js`
  lives; observed live in probe-04 (workers guessed `.`/`/`/`~/ma.js`/`/tmp`, all denied).
- **The ask:** thread an **opt-in, read-only context blob** down the tree alongside `persona` (which already
  carries down) so every child can locate its work — e.g. `opts.context` (a small string/record) appended to
  each worker's window. This is **context to thread**, distinct from a **lesson to recall** (BA-8/litectx);
  don't make callers launder run-state through the memory store to compensate. *Until delivered, relayfact
  re-injects the working dir via `opts.persona` (the carries-down channel) — the documented workaround.*

> **Maintainer note (bareagent, 2026-06-30) — BA-8 + BA-9 VALIDATED against `bare-agent@0.22.0` source; Qs before build.**
> Both premises confirmed grounded — neither is buildable by the consumer today, both are thin glue over existing primitives (not a new engine), so both are accepted in principle. Evidence + the design forks relayfact must resolve before I cut a release:
>
> **BA-8 — leaf retry seam — CONFIRMED.** A leaf is a single `loop.run` (`src/recurse.js:423`); the verdict is *returned, never fed back* (`recurse.js:489–496`); `forChild` strips `evaluate`/`contract` from children (`recurse.js:106–110`), so a consumer genuinely cannot inject per-leaf retry. The building block exists: `src/refine.js` is already `attempt→evaluate→regenerate` with `critique` threaded forward + `maxIterations` + `HaltError` propagation. *(Note: the model's in-run agentic loop already iterates across rounds — BA-8's distinct value is the **enforced deterministic sensor** forcing a fresh attempt with the structured gap, which the in-run loop doesn't get.)* **Open Qs:**
> 1. **Scope** — refine only true *leaves* (a worker that didn't `spawn_child` / single-shot), or any worker? *(rec: leaves only — a decomposing parent's verdict stays the tree-level verify; refining a parent re-runs its subtree.)*
> 2. **Sensor API** — the top-level `evaluate`/`contract` are deliberately stripped from children, so a leaf-refine needs a **distinct per-leaf sensor that DOES carry down**. Proposed shape: `opts.refineLeaf = { sensor(result, {task, context}) → Verdict|boolean, maxIterations? }`, deterministic-first (test/compile/lint), model-judge optional + isolated (R-S8). Confirm shape, async-allowed, and that the sensor receives the BA-9 `context` blob.
> 3. **Bound + governance** — default `maxIterations` *(rec: 2)*; each iteration forwards `usage` to `onLlmResult` and is gate-checked so bareguard's budget/turn caps are the real bound. Confirm.
> 4. **Recall coupling** — bareagent stays **litectx-agnostic**: the "error-keyed recall" is the *caller's* tool via `opts.tools`, keyed off the gap that refine threads forward as `critique`. bareagent does **not** itself call litectx. Confirm that division (bareagent owns the loop+guards+verify slot; relayfact the sensor; litectx the recall handle — matches your §labor split).
>
> **BA-9 — context blob — CONFIRMED (slightly worse than filed).** `recurseFanout` calls `planner.plan(task, { count })` with **no** context (`recurse.js:750`) even though `Planner.plan` already exposes an unused `context.info` seam (`src/planner.js:55–58, 82–85`); the child then sees only the paraphrased `step.action` (`recurse.js:779`). Carry-down precedent exists (`persona` via `forChild`). **Open Qs:**
> 1. **Injection point** — append `opts.context` to the worker's **user message** (a delimited `Working context:` block) vs a **system** suffix like persona? *(rec: user-message block — keeps facts separate from persona's stance, per your "thread ≠ recall" framing.)*
> 2. **Format** — accept a **string** *(rec)*, or also a record rendered to text?
> 3. **Verifier exposure** *(the real fork)* — persona is withheld from the isolated verifier (anti-sycophancy); should `context` reach it? *(rec: YES — paths are benign facts the grader needs to locate/inspect the artifact; withholding them blinds it. Distinct from stance.)* Confirm.
> 4. **Planner-awareness** — also forward `opts.context` as `planner.plan(task, { count, info: context })` so the *slices themselves* are path-aware, in addition to threading to each child? *(rec: do both — the planner `info` improves the split, the per-child thread is the guarantee.)*
>
> Answer inline (or confirm the recs) and I'll POC-first → build both behind opt-in flags (backward-compatible, byte-identical default), ship docs-with-code, and you verify-shipped-vs-spec. Sequencing: **BA-9 first** (smaller, unblocks your persona-workaround) then **BA-8** (which consumes BA-9's `context` in its sensor).
>
> **POC results (live, gpt-4o-mini, 2026-06-30) — both SOUND, prove-don't-assert:**
> - **BA-9** (`poc/ba9-context-thread.mjs`): an unguessable random-temp-dir artifact + a scope-gated `read_file`. **No-context arm 0/3** (worker guesses bare `ma.js` → denied, *reproduces probe-04*); **context-threaded arm 3/3** (reads the absolute path first try). The `Working context:` **user-message block** is the validated injection point.
> - **BA-8** (`poc/ba8-leaf-refine.mjs`): real code sensor over `toMinutes()` incl. the `""→null` blind spot. **single-shot 0/5 → refined 2–3/5 at ≤3 iters / ~4.7k tok.** **Load-bearing design finding:** at a *flat* low temperature the weak model regenerates byte-identical wrong code and **ignores even crisp deterministic feedback** (0/5 — nearly mis-called "BA-8 invalid"); recovery only appears when **retry temperature escalates** (0.2→0.7→1.0). ⇒ **temperature escalation is a design REQUIREMENT of the leaf-refine seam, not a nicety**, and recovery is *partial* (~40–60% on a stubborn edge) — meaningful lift, not a guarantee. *(Still open for you: BA-9 verifier-exposure + the BA-8 public-`opts` shape.)*
>
> **BUILT (bareagent `main`, 2026-06-30) — both seams in, +13 mutation-proven tests, full suite 709/0/2, typecheck clean, shipped-vs-POC smoke green (`poc/ba89-shipped-smoke.mjs`, real gpt-4o-mini).** The two open Qs were resolved as recommended (easy to flip if you disagree — say so before publish):
> - **BA-9** → `recurse({ context: '<string>' })`. Threaded to **worker user message + Planner `info` + the isolated verifier** (verifier-exposure **ON** — neutral facts, not stance). Carries down via `forChild`. **Replaces your persona-laundering workaround** — move the working dir from `opts.persona` to `opts.context`.
> - **BA-8** → `recurse({ refineLeaf: { sensor, maxIterations?, temperatures? } })`. Scope = **definite leaves (`!canSpawn`)** so it engages at the tree's leaves (carries down), NOT orchestrator nodes. `sensor(result, { task, context, contract }) → Verdict` (your deterministic executable close); default `temperatures: [0.2, 0.7, 1.0]`, `maxIterations` defaults to `temperatures.length`. Each attempt is gate-checked + metered; a HaltError mid-loop → clean `{ incomplete }`; non-recovery → `receipts.refineLeaf.passed === false` (never a faked pass). The error-keyed `recall` is **yours** via `opts.tools`, keyed off the fed-back `critique` — bareagent stays litectx-agnostic.
> - **Not yet released** (additive/back-compat → a minor bump). Verify-shipped-vs-spec once it's on npm: BA-9 — run `recurse` with `opts.context` naming a real root + a scoped read tool, confirm a leaf reads the absolute path; BA-8 — wire a `refineLeaf.sensor` that fails once then passes, confirm `receipts.refineLeaf.iterations > 1` and `passed === true`.

### BA-10 — 🔴 `refineLeaf`'s escalating temperature is rejected by newer models → the whole leaf-refine silently collapses to `incomplete` (F34)

- **Symptom (reproduced live, probe-16 sonnet arm, 2026-07-03):** running the whole pipe with the intended
  **production model `claude-sonnet-5`** made **zero LLM calls**, called the sensor **zero times**, and
  returned `incomplete` (`refineLeaf` receipts `undefined`, cost `$0`, empty audit). The **exact same config
  on `claude-haiku-4-5` works** (`sensorCalls=2`, `receipts.refineLeaf={iterations:2,passed:true}`). So the
  failure is model-triggered, not a relayfact wiring bug — isolated by bisection (tools-only worker runs fine
  on sonnet; adding `refineLeaf` is what breaks it).
- **Root cause (the failure chain):**
  1. `recurseRefineLeaf`'s `attempt` passes an **escalating `temperature`** per retry —
     `temps[iteration]` (default `[0.2, 0.7, 1.0]`), `recurse.js:609` + `recurse.js:621`
     (`loop.run(..., { ctx, temperature })`).
  2. `AnthropicProvider.generate` forwards it **unconditionally** — `provider-anthropic.js:84`
     (`...(options.temperature != null && { temperature })`).
  3. `claude-sonnet-5`'s API **rejects any non-default `temperature`** with `400`
     `"temperature is deprecated for this model."` — surfaced verbatim by `_request` (`provider-anthropic.js:186–190`)
     as a `ProviderError`. (Confirmed by direct `generate`: `temperature:0.2/0.4` → 400; `temperature:1.0` or
     **omitted** → OK. It is the upstream API's error, **not** a client-side guard — no `"deprecated"` string
     exists anywhere in the provider.)
  4. In `refineLeaf`, the first attempt is at `temps[0]=0.2` → the Loop captures the 400 as `out.error`
     (`throwOnError:false`) → `attempt` rethrows (`recurse.js:624`, `if (out.error) throw`) → the `refine`
     wrapper's `try` catches it → `recurseRefineLeaf` catch block sets `node.incomplete = true` and returns
     `{ incomplete: true }` (`recurse.js:656–657`). **The sensor is never reached** — so the executable close
     never runs, and the failure looks like "the model couldn't do it" when in fact **no attempt was ever made.**
- **The fix (bareagent side — provider, one place, model-agnostic): graceful degradation.** In
  `AnthropicProvider.generate`, wrap `await this._request(body)`: on a `400` whose message indicates
  `temperature` is unsupported/deprecated **and** `body.temperature` was set, `delete body.temperature`,
  `console.warn` once, and retry the request **once** without it. Key off the **API error text**, not a
  hardcoded model list, so it survives future models that drop the param. Only retry for the temperature case
  (don't mask other 400s), and only when a temperature was actually sent (else re-throw unchanged). Net: a
  temperature-deprecated model runs the leaf-refine loop normally instead of collapsing to `incomplete`.
- **Secondary — a design caveat BA-8's own note now needs (`recurse.js`, non-blocking, flag honestly):**
  the BA-8 hand-off above states *"temperature escalation is a design REQUIREMENT of the leaf-refine seam."*
  That was measured with the retry prompt held CONSTANT (temperature the only diversity source). In
  relayfact's usage the **grounded close feeds a gap critique forward every iteration** (`recurse.js:618–620`,
  *"Your previous attempt FAILED these checks: {critique}"*), so the prompt already changes each retry — the
  correction lever is the **critique**, temperature is a secondary diversity lever. On a temperature-fixed
  model that lever is **inert** (every attempt runs at the model's default temp). Two consequences the lib
  should own: (a) `node.refineLeaf.temperatures` (`recurse.js:636`) will **misreport** temps that were
  silently dropped — it should record the *effective* temps; (b) BA-8's "REQUIREMENT" claim should be
  **scoped to models that accept `temperature`**, with an explicit note that on temperature-fixed models the
  gap critique carries the recovery alone. *(Whether flat-temp + gap-critique still converges on sonnet is an
  empirical question the fixed run will answer — see F34.)*
- **Severity: 🔴 blocking for the production-model path.** The PRD (§8.2 G2) names sonnet-class as the
  **production** model and haiku as the control; as shipped, the production model **cannot run the
  self-correcting leaf loop at all**. It does **not** block the haiku control. **No relayfact workaround** —
  setting `temperatures:[1.0,…]` in the probe would be exactly the silent workaround the doctrine forbids
  (and defeats the seam's escalation design); the fix belongs at the lib.
- **Verify-shipped-vs-spec (on delivery):** run `recurse({ refineLeaf:{ sensor, temperatures:[0.2,0.7,1.0] } })`
  with `provider.model = claude-sonnet-5` and a sensor that fails once then passes → confirm
  `receipts.refineLeaf.iterations > 1`, `passed === true`, and a single one-time temperature-drop warning
  (not a per-attempt spam); confirm the same config still escalates temps on haiku.

---

## bareguard (currently v0.11.1)

| # | Finding | Severity | Status | The fix |
|---|---|---|---|---|
| BG-1 | F16 | 🔴 security | 🟢 **SHIPPED + VERIFIED v0.10.1** | Key-aware redaction walk, **default-on** (`DEFAULT_SECRET_KEYS = apiKey/api_key/authorization` + `sk-`/`Bearer` value patterns), narrow configurable key set — `src/primitives/secrets.js`. **Verified-shipped by running (2026-07-01):** a `gate.check` on an action carrying a fake `sk-ant-…` key masks it in the audit both by field (`[REDACTED:key=apiKey]`) and value pattern (`[REDACTED:pattern=sk-a...]`), including `_ctx.provider.apiKey`; the raw key is absent from the audit file. |
| BG-2 | F9 | 🟢 | works-as-intended | Layered enforcement (floor → ask → allowlist) verified correct; no change. |
| BG-4 | F37 | 🟢 docs/api | 🟢 **SHIPPED + VERIFIED v0.11.1** | 0.11.0's "`PAYLOAD_FIELDS` is a new export" was **false** — `import { PAYLOAD_FIELDS } from 'bareguard'` threw (exported only from `src/primitives/content.js`, not `index.js`; deep import `exports`-blocked). **Owner chose Option A + DECLINED my option-2 config key** (zero demand, no adopter hit it, `["content","contents"]` complete for every shipping write tool → a permanent 1.0 config surface for a loose changelog line = tail-wags-dog; the fix for a dead-config *implication* is to stop implying the knob). Shipped: re-export from `index.js` for **read-only introspection**, **`Object.freeze`** (mutate-the-global fails by construction), reword changelog + JSDoc to "introspection + fix-at-the-lib (one-line PR), not extend-by-mutation". **Verified-shipped by RUNNING (relayfact, 4/4):** import reachable; value `["content","contents"]`; `Object.isFrozen` true; `.push` throws + unchanged. Found via `poc/probe-19`. |
| BG-3 | F35 | 🟠 design | 🟢 **SHIPPED + VERIFIED v0.11.0** | `serializeForMatch` now strips `PAYLOAD_FIELDS = ["content","contents"]` from a non-mutating `args` copy before matching, for **both** deny + ask (`src/primitives/content.js`). **Verified-shipped by RUNNING (2026-07-03, `poc/probe-19-bg3-verify-shipped.mjs`, token-free, 5/5, control-can-fail):** payload code-vocab incl. literal `DROP TABLE` bytes → **allow/`default`**; `DROP TABLE`/`rm -rf` in a bash **`cmd`** → **deny/`content.denyPatterns`**; structural **`method:DELETE`** → **ask/`content.askPatterns`** (the strip does not blind the operation fields — proven via the audit's pre-human askHuman line). relayfact's disclosed override (`content:{askPatterns:[]}`) **REMOVED** from probe-16; default guards left ON. **F37 follow-up (BG-4) SHIPPED v0.11.1:** `PAYLOAD_FIELDS` is now exported from `index.js` (read-only, `Object.freeze`d) — the 0.11.0 "is a new export" claim is made true; see BG-4 row. |

### BG-1 — 🔴 redact secrets in the audit (F16, defense-in-depth)
`gate.record` writes `_ctx` (and action args) verbatim to the audit JSONL. bareguard already ships a
value-based redactor (`src/primitives/secrets.js`, wired `gate.js:140`) — `envVars` (process.env values) and
`patterns` (RegExp on values) — but it only runs when `config.secrets` is set, so a `_ctx.provider.apiKey`
lands raw at **zero config**. BG-1 adds the missing **key-aware** layer.

**Spec settled (relayfact ↔ bareguard, finding-author = relayfact):**
- **Mechanism:** a **key-aware object walk** that blanks a field by *name* regardless of value —
  complementary to (not a replacement for) the existing value-based `envVars`/`patterns`. Both run.
- **Default-on** (fires with no `secrets` config). Rationale: a backstop that requires opt-in only protects
  adopters who already know they have a secret in ctx — not the unknowing adopter the backstop exists for
  (the F16 failure mode). bareguard is **pre-1.0 (v0.9.0)** — the SemVer-cheap moment to change the audit
  floor; deferring to post-1.0 *creates* the breaking-change cost. Safe for policy-reproduction because true
  secrets are never policy-load-bearing.
- **Narrow default key set** (fires for everyone): case-insensitive `apiKey` / `api_key` / `authorization`
  + a **value**-pattern `Bearer\s+\S+` (optionally `sk-[\w-]{16,}`). **Deliberately EXCLUDE `*_token` /
  `*_secret` globs from the default** — that is where `page_token` / `csrf_token` false-positives live
  (audit corruption / broken policy-reproduction). **Caller-configurable**: the operator may extend (add
  `X-Api-Key`, the broad globs) or override.
- **Pairs with BA-1.** Once BA-1 strips the provider from `_ctx`, BG-1's `apiKey` match rarely fires in the
  relayfact path — fine; BG-1 is the floor for every other path / future ctx. The pair closes F16 properly.
- **Note:** BG-2 confirmed nothing-to-do; only BG-1 carries work.

**As built (bareguard `main`, v0.10.0) — deltas from the spec above, for verify-shipped:**
- Default value-pattern shipped as charset-bounded `Bearer\s+[A-Za-z0-9._\-+/=]+` (NOT `Bearer\s+\S+` — a greedy `\S+` over the serialized-JSON audit line swallows the closing `"` and corrupts the line, making `JSON.parse` bail back to the *un-redacted* original; caught by a test pre-release). `sk-[\w-]{16,}` is **included** in the default set, not optional.
- Opt-out is `secrets.redactKeys:false` (disables the whole default-on backstop; explicit `envVars`/`patterns`/`keys` still apply). Extend the key set via `secrets.keys:[…]` (case-insensitive; a `*suffix` spec like `*_token` matches any key ending in `suffix`).
- Tag format: `[REDACTED:key=<name>]`. Redaction is audit-only and **non-mutating** (eval/execute see the real action; policy matching unweakened). Default-on expansion is re-bounded by the existing `MAX_LINE_BYTES` truncation, so PIPE_BUF audit-line atomicity holds.

### BG-3 — 🟠 content ask/deny-patterns scan the write PAYLOAD → false-fire on code vocabulary → budget-burn (F35)

- **Where:** `content.js:27` `SAFE_DEFAULT_ASK_PATTERNS` includes `/\b(delete|drop|revoke|truncate|destroy|remove|purge)\b/i`; `contentAskCheck` (`content.js:63`) tests it against `serializeForMatch(action)` = `JSON.stringify(action)` (`content.js:32`) — the **whole action**, including a file-write's `args.contents`. Called at `gate.js:250` for every action, "fires even on allowlisted tools." Default-on (opt out via `content:{askPatterns:[]}`).
- **What breaks (reproduced live, probe-16, BOTH arms, 2026-07-03):** the task was to fix a bug about **dropping** filters; the fix edits code + comments containing "drop"/"remove". Every fix-write serialized to JSON containing those whole words → `askHuman` → the probe's auto-deny `humanChannel` → **write denied**. Over ~16 llm calls the worker retried, **burned the full $1 budget cap**, halted, and the refine **sensor was never reached** — surfacing as `incomplete`. Both sonnet and haiku failed *identically*; the read.js `sel`-array fix was never applied. After `content:{askPatterns:[]}` (relayfact-side, domain-appropriate), both arms **delivered green on the first attempt, GOLD-correct, ~$0.07–0.13** (F36). Token-free proof of the mechanism: a `gate.check` on a write whose `contents` contains whole-word "drop"/"remove" → `outcome:deny, rule:content.askPatterns`; with `askPatterns:[]` → `outcome:allow`.
- **Why this is a design issue, not just my misconfig (the honest read):**
  1. **It scans the wrong field.** These patterns target destructive *operations* (`DROP TABLE`, `rm -rf`, `revoke`, destructive HTTP verbs) — an **intent/command** signal. Serializing the entire action makes them also fire on a write whose **payload text** merely *mentions* the word. Code is saturated with delete/remove/drop as ordinary vocabulary, so this false-fires on essentially **every coding agent, permanently.**
  2. **The real guard for a write is `fs.writeScope`,** not keyword-scanning its bytes. An in-scope write (here: `examples/`+`src/`, `test/` excluded) is safe regardless of the file text. The payload scan adds no protection here — only false alarms. (Scanning file bytes for keywords is also poor security: it neither reliably catches a genuinely malicious write nor avoids benign matches.)
  3. **The trigger is bareguard's; the expensive tail is bareagent's (attribution corrected 2026-07-03).** The
     false-fire — a benign write escalated/denied — is bareguard's to stop (this ask). The **budget-burn**
     symptom ("$1 cap → `incomplete`, sensor never reached") is **not** bareguard's: bareguard is stateless per
     `check()` and has no concept of a loop. It is **bareagent's `refineLeaf`/worker Loop retrying a
     governance-denied action** instead of short-circuiting — filed as **BA-11**. bareguard's share is exactly
     one thing: stop the false-fire at the source. My original F35/BG-3 over-attributed the burn to bareguard;
     corrected.
- **Settled fix (maintainer's read, 2026-07-03 — accepted; narrower than my opt-1, and better):**
  1. **`serializeForMatch(action)` excludes the write/edit payload field(s) before matching** — applied to
     **both** `contentDenyCheck` and `contentAskCheck` (the deny path has the same defect and is *worse*: a
     migration file with `DROP TABLE` in its bytes currently **hard-denies**, unrecoverable). Stays
     **shape-agnostic** otherwise (regex a blob) — the opposite polarity to my field-*allowlist*, which would
     couple `content.js` to every primitive's field vocabulary and **fail silent** when a new action shape isn't
     added. Excluding a known payload field fails **loud** (a novel field → a visible, cheap-to-fix false-fire,
     never a silent hole). Leaves the HTTP-method pattern, force-push, and `DROP TABLE`-in-`cmd` all firing.
  2. **Payload field names to exclude = `content` (shell_write) + `contents` (relayfact edit_file)** — verified
     the complete set across both repos (no diff-tool ships; `type:'edit'` reserved-unused). Both sit under
     `action.args` in relayfact's translators; shell_write's payload only reaches the action if a translator
     forwards it.
  3. **Rejected: `content.scope` selector** (YAGNI — no adopter has asked for payload scanning; `secrets` already
     owns payload inspection; add `scope:'full'` if a real DLP consumer appears) and **the retry-signal tail**
     (bareguard's statelessness → that's BA-11, bareagent's).
  4. **Not docs-only / not works-as-intended.** A default that is a pure false-positive generator for an entire
     adopter class (coding agents doing file writes), failing silently+expensively, is a **bad default** — fixed
     at the floor, pre-1.0 (the SemVer-cheap moment, same argument that carried BG-1 default-on).
  5. Doc the boundary + a test: `DROP TABLE`/`rm -rf` in `args.contents` → **allow**; same in `cmd` → still
     **deny**; `"method":"DELETE"` → still **ask**.
- **Relayfact-side stance (disclosed):** for probe-16's worker (only `shell_read`+`edit_file`, no bash/network,
  bounded by read/writeScope) the default ask-patterns protect nothing, so `content:{askPatterns:[]}` is a
  correct *local* override — a **disclosed workaround pending BG-3**, not the fix. Once BG-3 ships, drop the
  override and verify-shipped (the "drop/remove in payload → allow, in cmd → deny" test above).

---

## litectx (currently v0.21.0)

No open fix. F10's root cause is bareagent's **stale example** (BA-4), not litectx — litectx ≥0.21 correctly
requires `{ root }`. The Store socket (`liteCtxAsStore` → `{store,search,get,delete}`) and ranked recall work
first-try (probe-02/03: relevant fact ranked `top@3.681` over two distractors). Spike 2 will exercise the
**`ctx.litectx={recall}` handle socket** (distinct from the Store mount); any friction there lands here.

---

## Blocking summary (what relayfact waits on)

- 🟢 **F16 (BA-1) — UNBLOCKED.** The one security blocker shipped in `bare-agent@0.22.0` (recurse-side
  `auditSafeCtx` strips the provider/key from the audited `_ctx`). relayfact's next spike can run against
  `bare-agent@0.22.0` now; the only remaining step is **verify-shipped-vs-spec** (grep a real audit JSONL for
  the absence of the key). **BG-1** (bareguard's by-key-name redactor, the defense-in-depth floor for *other*
  ctx paths) lands in **bareguard v0.10.0** — non-blocking for the seam measurement, verify on its publish.
- 🟢 **BA-2…BA-6 — SHIPPED** in `bare-agent@0.22.0` (none ever required a relayfact workaround). BG-2 remains
  works-as-intended.
- 🟢 **BG-3 (F35) — SHIPPED + VERIFIED v0.11.0; disclosed override REMOVED.** `serializeForMatch` now strips
  the write payload (`content`/`contents`) before matching, so the default `content` patterns no longer false-fire
  on code vocabulary. **Verified-shipped by running** (`poc/probe-19`, token-free 5/5, control-can-fail): payload
  code-vocab → allow; destructive verb in a `cmd`/`method` operation field → still deny/ask. relayfact dropped
  `content:{askPatterns:[]}` from probe-16 and left the default guards ON. Paired budget-burn half = **BA-11**
  (bare-agent 0.25.0, verified `poc/probe-20`). Follow-up **BG-4/F37** (unreachable `PAYLOAD_FIELDS` export) is
  low/non-blocking. **G2 re-run WITHOUT the override confirmed green, both arms** (default guards ON): sonnet-5
  `$0.095`/4 calls, haiku `$0.088`/7 calls, `interventions=0`, close+GOLD green, `fitToPass=false` (F36 re-run).
- 🟢 **BA-10 (F34) — UNBLOCKED, SHIPPED + VERIFIED v0.24.0.** The provider now degrades gracefully
  (`requestWithTemperatureFallback`): on the temperature-deprecation 400 it drops `temperature` + retries once,
  warns **once**, and flows `temperatureDropped` back so `refineLeaf` receipts report the *effective* temps
  (the secondary receipts-honesty point, also fixed). **Verified-shipped by running (2026-07-03):** sonnet-5 +
  `refineLeaf` → `sensorCalls=2`, `receipts.refineLeaf={iterations:2,passed:true,temperatures:[null,null]}`
  (was `incomplete`, 0 sensor calls); haiku still escalates `[0.2,0.7]` (default byte-identical). Unblocked the
  G2 production arm → both arms delivered green (F36).

*This doc is updated as asks ship (flip to 🟢 with the version) or as new findings land. It never replaces
`FINDINGS.md` — that is the grounded log; this is the actionable hand-off.*
