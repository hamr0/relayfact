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

---

## bareguard (currently v0.10.1)

| # | Finding | Severity | Status | The fix |
|---|---|---|---|---|
| BG-1 | F16 | 🔴 security | 🟢 **SHIPPED + VERIFIED v0.10.1** | Key-aware redaction walk, **default-on** (`DEFAULT_SECRET_KEYS = apiKey/api_key/authorization` + `sk-`/`Bearer` value patterns), narrow configurable key set — `src/primitives/secrets.js`. **Verified-shipped by running (2026-07-01):** a `gate.check` on an action carrying a fake `sk-ant-…` key masks it in the audit both by field (`[REDACTED:key=apiKey]`) and value pattern (`[REDACTED:pattern=sk-a...]`), including `_ctx.provider.apiKey`; the raw key is absent from the audit file. |
| BG-2 | F9 | 🟢 | works-as-intended | Layered enforcement (floor → ask → allowlist) verified correct; no change. |

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

*This doc is updated as asks ship (flip to 🟢 with the version) or as new findings land. It never replaces
`FINDINGS.md` — that is the grounded log; this is the actionable hand-off.*
