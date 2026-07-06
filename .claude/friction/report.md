# Friction Analysis - Detailed Report

**Generated:** 2026-07-04 21:39:38 UTC

**Sessions Analyzed:** 682
**Interactive Sessions:** 222 (multi-turn conversations)
**BAD Sessions:** 27 (12% of interactive)

## Glossary

**Interactive Session:** A conversation with >1 turn (multi-turn dialogue). Single-turn sessions are filtered from BAD rate calculation.

**BAD Session:** User gave up via `/stash`, `/exit`, or silent abandonment (high friction with no resolution).

**Friction:** Cumulative weight of negative signals. Higher friction = more user frustration.

**Peak Friction:** Maximum friction reached during a session.

---

## Executive Summary

✅ **HEALTHY**: 12% of interactive sessions end in failure. Average session: 5.9 turns, 3.5 friction, 631 min.

**Top Issues:**
- **checkpoint** (1402 occurrences, 0 total friction)
- **exit_error** (259 occurrences, 130 total friction)
- **repeated_question** (245 occurrences, 1225 total friction)

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
| checkpoint | 1402 | +0.0 | 0.0 | Unknown signal |
| exit_error | 259 | +0.5 | 129.5 | Command failed (exit code != 0) |
| repeated_question | 245 | +5.0 | 1225.0 | User asked same question twice |
| false_success | 161 | +1.0 | 161.0 | LLM claimed success after error |
| request_interrupted | 82 | +3.0 | 246.0 | User hit Ctrl+C or ESC |
| user_intervention | 57 | +1.0 | 57.0 | User gave up (/stash, /exit) |
| tool_loop | 44 | +6.0 | 264.0 | Same tool called 3+ times |
| user_correction | 27 | +8.0 | 216.0 | Unknown signal |
| rapid_exit | 12 | +1.0 | 12.0 | <3 turns, ends with error/interrupt |
| no_resolution | 10 | +0.5 | 5.0 | Errors without subsequent success |
| user_curse | 6 | +8.0 | 48.0 | User frustration (profanity) |
| exit_success | 4 | +0.0 | 0.0 | Command succeeded (exit code 0) |
| interrupt_cascade | 2 | +8.0 | 16.0 | 2+ interrupts within 60s |
| session_abandoned | 2 | +1.0 | 2.0 | High friction, no resolution |

## Pattern Analysis

### Common Failure Patterns

**False Success Loop** (161 occurrences): LLM claims task is complete after command fails. This indicates the LLM is not checking exit codes properly.

**High Error Rate** (259 errors): Many commands are failing. This suggests either environment issues or LLM choosing wrong approaches.

**User Interruptions** (82 interrupts): Users frequently canceling operations. Commands may be too slow, stuck, or heading in wrong direction.

**Abandonment Rate** (26%): 57/222 interactive sessions ended with user giving up. This is acceptable for complex tasks.

### Friction Level Breakdown

**Low Friction (0-15):** 132 sessions - Normal operation, minor errors quickly resolved

**Medium Friction (15-50):** 45 sessions - Some struggles, multiple retries, but eventually successful

**High Friction (50+):** 9 sessions - Severe issues, user frustration, likely gave up

---

## Top Friction Sessions

| Project | Session | Quality | Peak | Turns | Duration | Top Signals |
|---------|---------|---------|------|-------|----------|-------------|
| liteagents | 0616-1641-13252f69 | FRICTION | 83.5 | 53 | 6h33m | checkpoint:25, repeated_question:15, success:1 |
| hamr | 0602-1412-38dcbe62 | BAD | 80 | 33 | 48h33m | checkpoint:4, repeated_question:10, curse:2 |
| litectx | 0612-1703-f1eb7cbb | FRICTION | 75.5 | 25 | 21h49m | checkpoint:10, repeated_question:1, error:3 |
| litectx | 0622-1108-a01fae47 | BAD | 75 | 29 | 31h6m | checkpoint:13, repeated_question:8, correction:1 |
| latefyi | 0602-1136-ed4106af | ROUGH | 71 | 31 | 344h38m | checkpoint:8, repeated_question:14, error:1 |
| career-ops | 0619-1145-0bc19e54 | ROUGH | 66 | 52 | 35h1m | checkpoint:16, repeated_question:10, correction:2 |
| litectx | 0618-1649-89782bc6 | BAD | 64.5 | 22 | 90h17m | checkpoint:8, repeated_question:8, correction:2 |
| multis | 0519-1829-927c179e | FRICTION | 54.5 | 28 | 647h9m | checkpoint:10, repeated_question:10, request_interrupted:1 |
| liteagents | 0616-1125-cee40b55 | FRICTION | 51 | 51 | 5h14m | checkpoint:10, repeated_question:9, request_interrupted:1 |
| liteagents | 0617-0740-feaaac62 | BAD | 45 | 41 | 392h28m | checkpoint:8, repeated_question:7, correction:1 |
| litectx | 0614-1210-7b4eea6c | FRICTION | 42.5 | 20 | 4h17m | checkpoint:7, error:5, false_success:4 |
| multis | 0616-2012-153b4c58 | BAD | 38 | 31 | 3h31m | checkpoint:5, repeated_question:2, request_interrupted:3 |
| multis | 0619-2335-05e3d505 | BAD | 36 | 34 | 23h | checkpoint:4, repeated_question:4, correction:1 |
| bareguard | 0603-2318-065ac6fc | ROUGH | 35 | 20 | 45h6m | checkpoint:13, repeated_question:7 |
| dwi | 0527-1408-e775784b | BAD | 35 | 31 | 199h25m | checkpoint:9, repeated_question:5, correction:1 |
| litectx | 0613-2226-5e66d8c1 | BAD | 34.5 | 15 | 1h25m | checkpoint:2, correction:1, intervention:1 |
| privcloud | 0611-0907-fee07212 | BAD | 33.5 | 25 | 12h23m | checkpoint:6, repeated_question:3, correction:1 |
| beeperbox | 0616-1457-8b9b53d3 | FRICTION | 32.5 | 20 | 140h20m | checkpoint:11, repeated_question:5, tool_loop:1 |
| hamr | 0619-1632-763b3c8f | FRICTION | 32 | 20 | 294h8m | checkpoint:4, repeated_question:6, error:1 |
| litectx | 0605-1958-d4beea64 | FRICTION | 31.5 | 31 | 146h34m | checkpoint:12, repeated_question:6, error:1 |

## Session Quality Breakdown

| Quality | Count | Description |
|---------|-------|-------------|
| BAD | 27 | user gave up (/stash) |
| FRICTION | 90 | curse or false_success |
| ROUGH | 13 | high friction but completed |
| OK | 92 | no significant friction |
| ONE-SHOT | 460 | single turn (filtered) |

## Per-Project Statistics

| Project | Interactive | BAD | BAD % | Avg Friction | Avg Turns | Avg Duration |
|---------|-------------|-----|-------|--------------|-----------|-------------|
| addypin | 1 | 0 | 0% | 4.5 | 17.0 | 7h22m |
| agentic-toolkit | 1 | 0 | 0% | 0.0 | 2.0 | 1m |
| bareagent | 33 | 3 | 9% | 6.4 | 15.8 | 18h48m |
| barebrowse | 4 | 0 | 0% | 5.8 | 12.3 | 4h55m |
| bareguard | 15 | 2 | 13% | 2.3 | 4.1 | 6h31m |
| bareguard-harness-code-mode | 0 | 0 | - | 0.0 | 1.0 | - |
| beeperbox | 5 | 0 | 0% | 13.1 | 15.8 | 102h35m |
| career-ops | 5 | 0 | 0% | 16.3 | 21.2 | 15h24m |
| dwi | 4 | 2 | 50% | 12.2 | 15.2 | 66h44m |
| flightlog | 1 | 0 | 0% | 0.0 | 3.0 | 17m |
| gitdone | 3 | 0 | 0% | 7.8 | 15.7 | 32h13m |
| hamr | 5 | 1 | 20% | 28.4 | 16.2 | 98h |
| hamr0 | 3 | 0 | 0% | 0.3 | 8.3 | 4h25m |
| latefyi | 2 | 1 | 50% | 41.8 | 21.5 | 176h24m |
| liteagents | 5 | 1 | 20% | 41.3 | 33.4 | 182h6m |
| litectx | 66 | 6 | 9% | 2.1 | 3.9 | 2h36m |
| litectx-poc | 3 | 1 | 33% | 5.0 | 15.3 | 8h54m |
| mailproof | 4 | 0 | 0% | 8.6 | 16.8 | 164h6m |
| multis | 39 | 6 | 15% | 8.4 | 15.5 | 28h21m |
| notes-smol-mlearn | 1 | 0 | 0% | 18.5 | 23.0 | 23h48m |
| privcloud | 10 | 3 | 30% | 14.2 | 20.9 | 33h3m |
| pulselog | 2 | 0 | 0% | 5.5 | 14.0 | 19h19m |
| relayfact | 8 | 1 | 13% | 10.2 | 14.9 | 28h15m |
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
| 2026-06-21 | 2 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-22 | 8 | 3 | 38% | ████░░░░░░ |
| 2026-06-23 | 9 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-24 | 3 | 2 | 67% | ███████░░░ |
| 2026-06-25 | 12 | 1 | 8% | █░░░░░░░░░ |
| 2026-06-26 | 10 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-27 | 8 | 2 | 25% | ███░░░░░░░ |
| 2026-06-28 | 6 | 0 | 0% | ░░░░░░░░░░ |
| 2026-06-29 | 8 | 1 | 13% | █░░░░░░░░░ |
| 2026-06-30 | 3 | 0 | 0% | ░░░░░░░░░░ |
| 2026-07-01 | 3 | 0 | 0% | ░░░░░░░░░░ |
| 2026-07-02 | 8 | 1 | 13% | █░░░░░░░░░ |
| 2026-07-03 | 8 | 0 | 0% | ░░░░░░░░░░ |
| 2026-07-04 | 2 | 0 | 0% | ░░░░░░░░░░ |

