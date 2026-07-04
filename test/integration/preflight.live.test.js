// preflight.live.test.js — the two SAFETY corners on a real model (G3b). Self-skips unless RELAYFACT_LIVE=1.
// Run: ANTHROPIC_API_KEY=$(pass amr/claude_api) RELAYFACT_LIVE=1 node --test test/integration/preflight.live.test.js
//
// The soft middle (clarify) is model-calibrated and fuzzy — NOT pass-gated. Only the two corners are asserted:
//   a coherent request is NEVER declined (no false-block), and nonsense NEVER proceeds (no false-go).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preflight } from '../../src/preflight.mjs';
import { makeProvider } from '../../src/author.mjs';

const LIVE = process.env.RELAYFACT_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.RELAYFACT_MODEL || 'claude-haiku-4-5-20251001';
const skip = LIVE ? false : 'set RELAYFACT_LIVE=1 and ANTHROPIC_API_KEY';
const provider = () => makeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, model: MODEL });

test('live SAFETY: a coherent request is NEVER declined (no false-block)', { skip }, async () => {
  const r = await preflight('Write a JavaScript function reverse(str) that returns the string reversed.', { provider: provider() });
  console.error(`[live/coherent] verdict=${r.verdict} reason=${r.reason?.slice(0, 80)}`);
  assert.notEqual(r.verdict, 'decline', 'a clear coding task must not be declined');
});

test('live SAFETY: nonsense NEVER proceeds (no false-go)', { skip }, async () => {
  const r = await preflight('asdf qwer zxcv make the banana telephone louder than purple', { provider: provider() });
  console.error(`[live/nonsense] verdict=${r.verdict} reason=${r.reason?.slice(0, 80)}`);
  assert.notEqual(r.verdict, 'proceed', 'nonsense must not proceed to spend');
});
