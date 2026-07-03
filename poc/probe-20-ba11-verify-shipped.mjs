// probe-20 — VERIFY-SHIPPED: bare-agent 0.25.0 BA-11 (deny-spin short-circuit), token-free.
// Doctrine: verify a shipped lib fix by RUNNING the installed code + observing, never by reading source.
// BA-11 is a Loop-level safety net, so it's exercisable with a STUB provider (no LLM, no network, $0):
// a provider that keeps re-emitting the same tool call + a policy that always denies it = the deny-spin.
// Claim under test: the Loop short-circuits after `maxConsecutiveDenials` DENIES IN A ROW, returning
// cleanly `{ error:'denied:<tool>' }` — instead of spinning to the budget/round cap (probe-16's $1 burn).
// NEGATIVE CONTROL (the load-bearing proof): with the guard OFF (Infinity), the SAME spin does NOT stop
// at 3 — it runs to the stub's cap. A guard that fires at N only matters if OFF lets it run past N.
import { Loop } from 'bare-agent';

// Stub provider: emits one edit_file tool call per round until `cap`, then a final text (natural end).
class SpinProvider {
  constructor(cap = 12) { this.name = 'stub'; this.model = 'stub-model'; this.calls = 0; this.cap = cap; }
  async generate() {
    this.calls += 1;
    if (this.calls > this.cap) return { text: 'giving up', toolCalls: [], usage: {}, model: this.model };
    return { text: '', toolCalls: [{ id: `c${this.calls}`, name: 'edit_file', arguments: { path: 'x.js', contents: 'y' } }], usage: {}, model: this.model };
  }
}
// edit_file must exist in the tool map (else "Unknown tool" path); execute never runs (policy denies first).
const tools = [{ name: 'edit_file', description: 'stub', parameters: { type: 'object', properties: {} }, execute: async () => ({ ok: true }) }];
const denyAll = async () => 'denied by test policy'; // a string verdict = deny (verbatim reason)

async function arm({ label, max, expectShortCircuit }) {
  const provider = new SpinProvider(12);
  const opts = { provider, policy: denyAll, throwOnError: false };
  if (max !== undefined) opts.maxConsecutiveDenials = max;
  const loop = new Loop(opts);
  const res = await loop.run([{ role: 'user', content: 'edit the file' }], tools);
  const threshold = max === undefined ? 3 : max;
  let pass;
  if (expectShortCircuit) {
    // fired: clean deny tag, and it stopped at EXACTLY the threshold-th consecutive deny (no further calls).
    pass = res.error === 'denied:edit_file' && provider.calls === threshold;
  } else {
    // OFF: never short-circuited on denials — ran to the stub cap (12) then ended by natural final-text.
    pass = res.error !== 'denied:edit_file' && provider.calls === provider.cap + 1;
  }
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} error=${String(res.error).padEnd(16)} providerCalls=${provider.calls}`);
  return pass;
}

let all = true;
all = await arm({ label: 'guard DEFAULT (3) → stop at 3', max: undefined, expectShortCircuit: true }) && all;
all = await arm({ label: 'guard =5 → stop at 5 (not hardcoded)', max: 5, expectShortCircuit: true }) && all;
all = await arm({ label: 'guard OFF (Infinity) → spins past 3', max: Infinity, expectShortCircuit: false }) && all;
all = await arm({ label: 'guard OFF (0) → spins past 3', max: 0, expectShortCircuit: false }) && all;
console.log(all ? '\nALL PASS — BA-11 shipped correctly; deny-spin short-circuit is load-bearing (OFF spins past N).'
                : '\nFAIL — BA-11 behavior diverges from spec.');
process.exitCode = all ? 0 : 1;
