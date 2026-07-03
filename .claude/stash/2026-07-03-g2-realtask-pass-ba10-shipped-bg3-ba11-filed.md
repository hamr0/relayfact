# relayfact — G2 PASS (real-task e2e); BA-10 shipped+verified; BG-3 settled; BA-11 designed (2026-07-03)

**Status:** Still POC (no `src/`). Continues `2026-07-03-graduation-gate-g4-observer-g1-selfauthored-close.md`.
**Graduation gate (PRD §8.2):** G4 ✅, G1 ✅ (positive-with-caveat), **G2 ✅ PASS (this session)**. Remaining: G3,
G5, + the still-unrun G1 sonnet arm.
**NO commits yet this session** — everything below is UNCOMMITTED (`poc/probe-16-realtask-e2e.mjs` untracked;
`FINDINGS.md`/`UPSTREAM-FIXES.md`/`relayfact-prd.md`/`observer.mjs`/`.gitignore` modified). No git remote.
**Local lib versions:** bareguard 0.10.1 · litectx 0.26.1 · **bare-agent 0.25.0** (bumped from 0.24.0 mid-session
— ⚠️ VERIFY next session what shipped in 0.25.0; possibly BA-11).

## What happened (the arc)
Ran **G2 = probe-16** (the whole pipe on an uncrafted REAL repo). Two real lib bugs surfaced *before* a clean
result; both handled the doctrine way (surface → fix at lib → verify-by-running), NOT worked around silently.

### G2 setup (probe-16-realtask-e2e.mjs) — uncrafted by construction
- Repo: `~/PycharmProjects/flightlog @ d60011a` — a REAL 2026-06-01 fix (the `examples/read.js` jq-hint dropped
  every `--match` filter but `--where`) locked by a HUMAN-written regression test. Post-cutoff + private → not
  memorized. Check out the **parent** `147eaed`, drop the human test on top → suite RED. Task = prose bug report;
  close = `node --test test/examples.test.js` (relayfact-owned; gate `writeScope` EXCLUDES `test/` → ungameable);
  worker tools = `shell_read`+`edit_file`; leaf-refine sensor = the close, gap fed back; observer attached.
- **GOLD** = relayfact test with a FRESH `--match host=web01` field (catches a proc/where hardcode).
- **Oracle self-checked offline, token-free, BEFORE spend:** parent+humantest = 10 pass / **1 fail** (the control
  that can fail, fails); +real-fix = 11/0; proc-hardcode mutant = human-close GREEN but GOLD RED (fit-to-pass
  catchable). Fixture work dir materialized via `git archive` each run; gitignored.
- Design note: `maxDepth:0` (atomic single-file bug = v1 base case; cleanest F20-comparable interventions;
  decomposition already validated in probe-04/12 — forcing a split would be theatre).

### Bug 1 — BA-10 (F34): 🟢 SHIPPED + VERIFIED (bare-agent 0.24.0)
`refineLeaf` passes an **escalating `temperature`** per retry (`recurse.js:609/621`); `claude-sonnet-5`'s API
**rejects any non-default temperature** (400 "temperature is deprecated for this model") → first attempt threw →
`incomplete`, **sensor never called, 0 LLM calls**. haiku unaffected. Fix shipped: provider
`requestWithTemperatureFallback` drops temperature + retries once on that 400, warns ONCE, flows
`temperatureDropped` back (receipts report EFFECTIVE temps — the secondary honesty point, also fixed).
**Verified by RUNNING:** sonnet-5 + refineLeaf → `sensorCalls=2, iterations=2, passed=true, temps=[null,null]`;
haiku still escalates `[0.2,0.7]`. Answered the open Q: escalation was NOT load-bearing here — sonnet converged
in ONE attempt, so the gap critique (changed prompt each iter) carried it, not temperature.

### Bug 2 — BG-3 (F35): 🟠 content ask/deny-patterns scan the write PAYLOAD → false-fire on code vocab → budget-burn
bareguard `content.askPatterns` (default-on, `content.js:27`, `/\b(delete|drop|revoke|truncate|destroy|remove|
purge)\b/i`) match `JSON.stringify(action)` (`serializeForMatch`, `content.js:32`) = the WHOLE action incl. a
write's payload. The fix edits code about "DROPPED filters" → every fix-write escalated → auto-deny humanChannel
→ denied; worker retried ~16 calls, **burned the $1 cap**, sensor never reached, surfaced as `incomplete`. BOTH
arms failed identically pre-fix. Token-free proof: `gate.check` on a write whose contents has whole-word
"drop"/"remove" → deny; with `content:{askPatterns:[]}` → allow. (Note `\bdrop\b` ≠ "drop**s**".)
- **relayfact override (disclosed, pending BG-3):** added `content:{askPatterns:[]}` to probe-16's Gate — correct
  LOCAL config for an editor-only worker (no bash/network → default patterns protect nothing; `writeScope` is the
  real guard), but a WORKAROUND, not the fix. Exactly ONE code site carries it (`probe-16` gate config).
- **User pushback (important):** I first only worked around it + logged a "config lesson" — user caught that as a
  silent workaround. Filed BG-3 upstream properly.
- **SETTLED with the bareguard maintainer** (their read, accepted — narrower + better than my opt-1):
  `serializeForMatch` **EXCLUDES the write/edit payload field(s)** before matching, symmetric across deny+ask
  (deny path is worse — `DROP TABLE` in a migration's bytes hard-denies, unrecoverable), **shape-agnostic
  otherwise** (fail-LOUD, not a field-allowlist that fails silent on a new shape). Payload fields to exclude =
  **`content`** (shell_write) + **`contents`** (relayfact edit_file) — VERIFIED complete: no diff-tool ships,
  `type:'edit'` reserved-unused. REJECTED: `content.scope` (YAGNI, secrets owns payload) and a retry-signal.
  Acceptance test: `DROP TABLE`/`rm -rf` in `args.contents` → allow; same in `cmd` → deny; `"method":"DELETE"`
  → ask. Not WAI/docs-only — fix the floor pre-1.0 (BG-1 default-on logic).

### BA-11 (F35 sibling): 🟠 governance-deny should short-circuit, not retry into the cap — DESIGN DECIDED
Attribution correction I conceded: the BUDGET-BURN is bareagent's (Loop/`refineLeaf` retrying a governance deny),
NOT bareguard's (stateless per `check()`). bareguard's share = stop the false-fire. **Design decided with user
(1/1/1 + one refinement):**
1. **Trigger** = after N CONSECUTIVE denials with no success between (preserves advisory deny→pivot). **Refinement
   I added:** reset on a successful **MUTATING** action, NOT a read (or a small total-denials-per-attempt
   backstop ~5) — else a worker that re-reads between denied writes (probe-16 did 4 reads interleaved) never
   trips the guard.
2. **Location** = core Loop safety net in `loop.js`, sibling of `HARD_ROUND_LIMIT(100)`; returns an error tag,
   recurse maps → `{incomplete, blocker:'governance-deny'}`. (Generalizes F30: put the latch in the Loop so no
   caller re-derives it.)
3. **Default** = ON, threshold ~3, tunable/disable-able (0/Infinity). Same as the always-on 100-round limit;
   normal runs never hit 3 consecutive denials.

## G2 RESULT (F36) — PASS, both models
| arm | verdict | interventions (bar ≤2) | refine iters | close | GOLD | cost | llm |
|---|---|---|---|---|---|---|---|
| sonnet-5 (prod) | ✅ delivered | **0** | 1 | green | green | $0.07–0.12 | 3–5 |
| haiku (control) | ✅ delivered | **0** | 1 | green | green | $0.13 | 9 |

Both wrote the GENERAL fix (`...Object.entries(opts.match||{}).map(...)`, conceptually the human fix — NOT a
proc-hardcode: fresh-field GOLD passed), FIRST attempt (0 gap cycles vs F20 trivia baseline 6), `groundedCalls=1`
(F13 holds), `maxDepth=0`, well under $1. G4 completed: observer renders all facets (close/tree/gate/terminal)
over the fresh G2 log (needed the `verify.ran` canonical event name + `g2.PASS/FAIL` added to the observer's
terminal recognizer). probe-18 self-check still ALL PASS. **Honest limits:** n=1, one localized single-file bug
(no organic decomposition here — that's probe-04/12), HUMAN-authored close (self-authored = G1), `agentic` tier
still unrun.

## Blast radius (3 repos)
- **bareguard** — BG-3 fix (`serializeForMatch` payload-exclude). Maintainer to implement. Not shipped.
- **bareagent** — BA-11 (governance-deny short-circuit in loop.js). Open. (BA-10 already shipped 0.24.0; 0.25.0
  bumped — verify what's in it.)
- **relayfact** — remove `content:{askPatterns:[]}` from probe-16 ONCE BG-3 ships, then verify-shipped + re-run
  G2 green without it. Plus the uncommitted probe/observer/doc changes. Nothing touches litectx.
- **Ordering:** BG-3 ships → relayfact drops override + verify. BA-11 is parallel/independent.

## NEXT (in order)
1. **Commit** the G2/BA-10/BG-3/BA-11 arc (user was deciding: commit now with override+`pending BG-3` note, vs
   hold until BG-3 lands so override-removal is one commit). End commits with Co-Authored-By trailer. No remote.
2. **Verify bare-agent 0.25.0** — what shipped (BA-11?). Verify-by-running, not by reading.
3. When BG-3 ships: drop relayfact override, verify-shipped (drop/remove-in-payload→allow, in-cmd→deny), re-run G2.
4. **G3** (`probe-17`) — the come-back: escalation artifact + pre-flight `proceed|clarify|decline`.
5. **G5** — graduated PRD (encode G1–G4 numbers + explicit descopes).
6. **G1 sonnet arm** still unrun (now that BA-10 unblocks sonnet + BG-3-override lets it write).

## DOCTRINE REMINDERS honored this session (keep honoring)
- Verify-shipped-vs-spec by RUNNING (caught BA-10 fixed; caught BG-3 mechanism token-free). No fit-to-pass.
- Oracle self-checked offline BEFORE spending. Name every fail-mode; claim at the altitude construction supports.
- Surface → fix at the lib → never a silent workaround (the user caught me almost doing exactly that with BG-3).
- Key via `pass amr/claude_api` runtime-injected; GPG pinentry EXPIRES mid-session (timed out twice) — ask the
  user to `! pass amr/claude_api >/dev/null` to re-unlock; run token probes back-to-back while warm.
- Run cost this session ~$2 wasted on the pre-BG-3 denial-fight + ~$0.4 on the clean reruns (gate-capped).
