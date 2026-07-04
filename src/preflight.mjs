// preflight.mjs — the "does this make sense?" gate (G3b, PRD §5): BEFORE spending, a bounded RUBRIC pass
// classifies { proceed | clarify | decline }. This is rubric territory and that is FINE under the doctrine —
// rubric may OPEN HITL (stop/ask), it may NEVER close green. Graduated from poc/probe-17 (F38).
//
// The parsing is split out pure so the SAFETY normalization is unit-tested without tokens: a garbage/
// unparseable model reply must NEVER yield `proceed` (the only verdict that spends) — it falls back to
// `clarify` (safe HITL-open). The model-behavior corners (coherent→not declined, nonsense→not proceed) are
// live-tested.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Loop } = require('bare-agent');

export const PREFLIGHT_PROMPT =
  'You are a senior engineer screening an incoming request BEFORE any work begins. Classify it as exactly one of: ' +
  'proceed (clear and actionable), clarify (a real coding task but underspecified — list the questions), ' +
  'decline (impossible, nonsensical, or not a coding task). You are ADVISORY: you may stop or ask, you may NEVER ' +
  'mark work as done. Reply with ONLY compact JSON: {"verdict":"proceed|clarify|decline","reason":"...","questions":["..."]}.';

const VERDICTS = new Set(['proceed', 'clarify', 'decline']);

/**
 * Parse a model reply into a normalized pre-flight decision. SAFE by construction: anything not clearly one
 * of the three verdicts becomes `clarify` — never `proceed`.
 * @param {string} text
 * @returns {{ verdict: 'proceed'|'clarify'|'decline', reason: string, questions: string[] }}
 */
export function parsePreflight(text) {
  let parsed = null;
  const m = String(text ?? '').match(/\{[\s\S]*\}/);
  if (m) { try { parsed = JSON.parse(m[0]); } catch { /* fall through to safe default */ } }
  const v = parsed?.verdict;
  const verdict = VERDICTS.has(v) ? v : 'clarify';                 // unknown/garbage → safe HITL-open, NEVER proceed
  const reason = String(parsed?.reason ?? '').trim() || (parsed ? '' : `unparseable pre-flight reply — defaulting to clarify`);
  const questions = Array.isArray(parsed?.questions) ? parsed.questions.map(String) : [];
  return { verdict, reason, questions };
}

/**
 * Run the pre-flight classification. A bounded bareagent `Loop` (system prompt, NO tools) — it cannot act,
 * only classify; the rubric opens HITL, it never closes work (§5). Consumed exactly as poc/probe-17 proved.
 * @param {string} request
 * @param {{ provider: object }} deps - a bareagent provider.
 * @returns {Promise<{ verdict: string, reason: string, questions: string[], raw: string }>}
 */
export async function preflight(request, { provider }) {
  const loop = new Loop({ provider, system: PREFLIGHT_PROMPT, throwOnError: false });
  const res = await loop.run([{ role: 'user', content: `Request: ${request}` }], []);
  const text = res?.text ?? '';
  return { ...parsePreflight(text), raw: text };
}
