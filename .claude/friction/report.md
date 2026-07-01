# Friction Analysis - Detailed Report

**Generated:** 2026-06-30 20:28:38 UTC

**Sessions Analyzed:** 700
**Interactive Sessions:** 230 (multi-turn conversations)
**BAD Sessions:** 25 (11% of interactive)

## Glossary

**Interactive Session:** A conversation with >1 turn (multi-turn dialogue). Single-turn sessions are filtered from BAD rate calculation.

**BAD Session:** User gave up via `/stash`, `/exit`, or silent abandonment (high friction with no resolution).

**Friction:** Cumulative weight of negative signals. Higher friction = more user frustration.

**Peak Friction:** Maximum friction reached during a session.

---

## Executive Summary

✅ **HEALTHY**: 11% of interactive sessions end in failure. Average session: 6.0 turns, 3.7 friction, 569 min.

**Top Issues:**
- **checkpoint** (1437 occurrences, 0 total friction)
- **exit_error** (268 occurrences, 134 total friction)
- **repeated_question** (265 occurrences, 1325 total friction)

---

## Friction Weight System

Each signal has a weight representing its severity. Friction accumulates as signals occur.

| Weight | Severity | Meaning |
|--------|----------|----------|
| +10 | CRITICAL | User gave up (intervention, abandonment) |
| +8 | SEVERE | LLM false claims or no progress (false_success, no_resolution) |
| +7 | HIGH | User frustration (interrupt_cascade) |
| +6 | MEDIUM | Stuck patterns (tool_loop, rapid_exit) |
| +4-5 | LOW-MEDIUM | User signals (request_interrupted, user_curse) |
| +1 | MINOR | Technical issues (exit_error, repeated_question) |
| +0.5 | NOISE | Context signals (compaction, long_silence, user_negation) |

---

## Signal Breakdown

| Signal | Count | Weight | Total Friction | What It Means |
|--------|-------|--------|----------------|---------------|
| checkpoint | 1437 | +0.0 | 0.0 | Unknown signal |
| exit_error | 268 | +0.5 | 134.0 | Command failed (exit code != 0) |
| repeated_question | 265 | +5.0 | 1325.0 | User asked same question twice |
| false_success | 162 | +1.0 | 162.0 | LLM claimed success after error |
| request_interrupted | 86 | +3.0 | 258.0 | User hit Ctrl+C or ESC |
| tool_loop | 64 | +6.0 | 384.0 | Same tool called 3+ times |
| user_intervention | 55 | +1.0 | 55.0 | User gave up (/stash, /exit) |
| user_correction | 25 | +8.0 | 200.0 | Unknown signal |
| no_resolution | 12 | +0.5 | 6.0 | Errors without subsequent success |
| rapid_exit | 12 | +1.0 | 12.0 | <3 turns, ends with error/interrupt |
| user_curse | 7 | +8.0 | 56.0 | User frustration (profanity) |
| exit_success | 4 | +0.0 | 0.0 | Command succeeded (exit code 0) |
| interrupt_cascade | 3 | +8.0 | 24.0 | 2+ interrupts within 60s |
| session_abandoned | 1 | +1.0 | 1.0 | High friction, no resolution |

## Pattern Analysis

### Common Failure Patterns

**False Success Loop** (162 occurrences): LLM claims task is complete after command fails. This indicates the LLM is not checking exit codes properly.

**High Error Rate** (268 errors): Many commands are failing. This suggests either environment issues or LLM choosing wrong approaches.

**User Interruptions** (86 interrupts): Users frequently canceling operations. Commands may be too slow, stuck, or heading in wrong direction.

**Abandonment Rate** (24%): 55/230 interactive sessions ended with user giving up. This is acceptable for complex tasks.

### Friction Level Breakdown

**Low Friction (0-15):** 137 sessions - Normal operation, minor errors quickly resolved

**Medium Friction (15-50):** 45 sessions - Some struggles, multiple retries, but eventually successful

**High Friction (50+):** 12 sessions - Severe issues, user frustration, likely gave up

---

## Top Friction Sessions

| Project | Session | Quality | Peak | Turns | Duration | Top Signals |
|---------|---------|---------|------|-------|----------|-------------|
| healthwatch | 0531-1740-7c0c25c1 | FRICTION | 143.5 | 83 | 41h34m | checkpoint:33, repeated_question:15, request_interrupted:4 |
| liteagents | 0616-1641-13252f69 | FRICTION | 83.5 | 53 | 6h33m | checkpoint:25, repeated_question:15, success:1 |
| hamr | 0602-1412-38dcbe62 | BAD | 80 | 33 | 48h33m | checkpoint:4, repeated_question:10, curse:2 |
| litectx | 0612-1703-f1eb7cbb | FRICTION | 75.5 | 25 | 21h49m | checkpoint:10, repeated_question:1, error:3 |
| litectx | 0622-1108-a01fae47 | BAD | 75 | 29 | 31h6m | checkpoint:13, repeated_question:8, correction:1 |
| latefyi | 0602-1136-ed4106af | ROUGH | 71 | 31 | 344h38m | checkpoint:8, repeated_question:14, error:1 |
| career-ops | 0619-1145-0bc19e54 | ROUGH | 66 | 52 | 35h1m | checkpoint:16, repeated_question:10, correction:2 |
| gitdone | 0601-2303-f567697c | FRICTION | 65 | 8 | 1h17m | checkpoint:6, tool_loop:10, false_success:2 |
| litectx | 0618-1649-89782bc6 | BAD | 64.5 | 22 | 90h17m | checkpoint:8, repeated_question:8, correction:2 |
| bareguard | 0530-0955-01c961bf | FRICTION | 56.5 | 36 | 38h1m | checkpoint:15, repeated_question:6, error:8 |
| multis | 0519-1829-927c179e | FRICTION | 54.5 | 28 | 647h9m | checkpoint:10, repeated_question:10, request_interrupted:1 |
| liteagents | 0616-1125-cee40b55 | FRICTION | 51 | 51 | 5h14m | checkpoint:10, repeated_question:9, request_interrupted:1 |
| litectx | 0614-1210-7b4eea6c | FRICTION | 42.5 | 20 | 4h17m | checkpoint:7, error:5, false_success:4 |
| multis | 0616-2012-153b4c58 | BAD | 38 | 31 | 3h31m | checkpoint:5, repeated_question:2, request_interrupted:3 |
| multis | 0619-2335-05e3d505 | BAD | 36 | 34 | 23h | checkpoint:4, repeated_question:4, correction:1 |
| bareguard | 0603-2318-065ac6fc | ROUGH | 35 | 20 | 45h6m | checkpoint:13, repeated_question:7 |
| dwi | 0527-1408-e775784b | BAD | 35 | 31 | 199h25m | checkpoint:9, repeated_question:5, correction:1 |
| litectx | 0613-2226-5e66d8c1 | BAD | 34.5 | 15 | 1h25m | checkpoint:2, correction:1, intervention:1 |
| privcloud | 0611-0907-fee07212 | BAD | 33.5 | 25 | 12h23m | checkpoint:6, repeated_question:3, correction:1 |
| beeperbox | 0616-1457-8b9b53d3 | FRICTION | 32.5 | 20 | 140h20m | checkpoint:11, repeated_question:5, tool_loop:1 |

## Session Quality Breakdown

| Quality | Count | Description |
|---------|-------|-------------|
| BAD | 25 | user gave up (/stash) |
| FRICTION | 89 | curse or false_success |
| ROUGH | 14 | high friction but completed |
| OK | 102 | no significant friction |
| ONE-SHOT | 470 | single turn (filtered) |

## Per-Project Statistics

| Project | Interactive | BAD | BAD % | Avg Friction | Avg Turns | Avg Duration |
|---------|-------------|-----|-------|--------------|-----------|-------------|
| addypin | 3 | 0 | 0% | 3.0 | 9.7 | 15h19m |
| bareagent | 35 | 3 | 9% | 6.3 | 15.7 | 17h10m |
| barebrowse | 4 | 0 | 0% | 5.8 | 12.3 | 4h55m |
| bareguard | 18 | 1 | 6% | 2.5 | 4.2 | 5h12m |
| bareguard-harness-code-mode | 0 | 0 | - | 0.0 | 1.0 | - |
| beeperbox | 5 | 0 | 0% | 13.1 | 15.8 | 102h35m |
| career-ops | 5 | 0 | 0% | 16.3 | 21.2 | 15h24m |
| dwi | 4 | 2 | 50% | 12.2 | 15.2 | 66h44m |
| flightlog | 2 | 0 | 0% | 5.0 | 16.5 | 23h39m |
| gitdone | 5 | 1 | 20% | 22.7 | 16.8 | 23h41m |
| hamr | 5 | 1 | 20% | 28.4 | 15.8 | 53h2m |
| healthwatch | 1 | 0 | 0% | 143.5 | 83.0 | 41h34m |
| knowless | 2 | 0 | 0% | 2.0 | 12.0 | 3h27m |
| latefyi | 3 | 0 | 0% | 27.8 | 16.0 | 198h55m |
| liteagents | 4 | 0 | 0% | 41.6 | 32.8 | 130h41m |
| litectx | 66 | 6 | 9% | 2.1 | 3.9 | 2h31m |
| litectx-poc | 3 | 1 | 33% | 5.0 | 15.3 | 8h54m |
| mailproof | 4 | 0 | 0% | 8.6 | 16.8 | 164h6m |
| multis | 38 | 6 | 16% | 8.4 | 15.4 | 25h32m |
| notes-smol-mlearn | 1 | 0 | 0% | 18.5 | 23.0 | 23h48m |
| plato | 8 | 0 | 0% | 5.2 | 13.0 | 6h22m |
| privcloud | 9 | 3 | 33% | 15.3 | 22.4 | 35h32m |
| relayfact | 3 | 1 | 33% | 7.2 | 15.0 | 42h58m |
| stuff-docs-work-resumes | 1 | 0 | 0% | 3.0 | 5.0 | 31m |
| tmp | 0 | 0 | - | 0.0 | 1.0 | - |
| tmp-litectx-e2e | 0 | 0 | - | 0.0 | 1.0 | - |
| wearehere | 1 | 0 | 0% | 0.0 | 5.0 | 5m |

## Recommendations

1. **High Priority:** Add CLAUDE.md rule to verify exit codes before claiming success

2. **High Priority:** Commands timing out or stuck - review for heavy operations that need optimization

3. **Medium Priority:** Add CLAUDE.md rule to detect and break out of tool loops

4. **Medium Priority:** Many repeated questions - LLM not understanding user intent or context issues

---

## Daily Trend (Last 14 Days)

| Date | Interactive | BAD | Rate | Trend |
|------|-------------|-----|------|-------|
| 2026-06-17 | 7 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-18 | 8 | 1 | 13% | █░░░░░░░░░ |
| 2026-06-19 | 9 | 1 | 11% | █░░░░░░░░░ |
| 2026-06-20 | 1 | 1 | 100% | ██████████ |
| 2026-06-21 | 2 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-22 | 8 | 3 | 38% | ████░░░░░░ |
| 2026-06-23 | 9 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-24 | 3 | 2 | 67% | ███████░░░ |
| 2026-06-25 | 12 | 1 | 8% | █░░░░░░░░░ |
| 2026-06-26 | 10 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-27 | 8 | 2 | 25% | ███░░░░░░░ |
| 2026-06-28 | 6 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-29 | 8 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-30 | 2 | 0 | 0% | ░░░░░░░░░░ |

