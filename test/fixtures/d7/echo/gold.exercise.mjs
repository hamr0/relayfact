// gold.exercise.mjs — the INDEPENDENT GOLD for D7 Task 3, AGENTIC tier: it does not read source, it DEPLOYS
// the delivered artifact (boot the server on an OS-assigned port) and probes it over real HTTP, exit code =
// truth (0=pass). Written to the workdir only AFTER the worker finishes. It NEVER hangs (fetch timeouts + a
// watchdog), so a broken artifact yields a truthful nonzero exit, not a stuck close.
//
// It checks the FIVE GROUNDED criteria with FRESH inputs (a multi-key payload the prose never lists, a fresh
// malformed body, a fresh unknown route). The SIXTH criterion — "the 400 message is developer-friendly" — is
// RUBRIC residue: judgment-only, deliberately NOT asserted here (the close never gates on it).
import { createApp } from './server.mjs';

setTimeout(() => { console.error('watchdog: artifact never became ready'); process.exit(1); }, 8000).unref();

const code = await (async () => {
	let server;
	try {
		server = createApp();
		if (!server || typeof server.listen !== 'function') { console.error('createApp did not return an http server'); return 1; }
	} catch (e) { console.error('boot threw: ' + e.message); return 1; }

	await new Promise((r) => server.listen(0, r));
	const port = server.address().port;
	const base = 'http://127.0.0.1:' + port;
	const get = (p) => fetch(base + p, { signal: AbortSignal.timeout(2500) });
	const post = (p, raw) => fetch(base + p, { method: 'POST', body: raw, signal: AbortSignal.timeout(2500) });

	try {
		// 1 + 2 — GET /healthz → 200 {status:'ok'}
		const h = await get('/healthz');
		const hb = await h.json().catch(() => null);
		if (h.status !== 200) { console.error('healthz: expected 200, got ' + h.status); return 1; }
		if (!hb || hb.status !== 'ok') { console.error('healthz: expected {status:"ok"}, got ' + JSON.stringify(hb)); return 1; }

		// 3 — POST /echo with a FRESH multi-key payload → echoes the body + count = top-level key count
		const payload = { alpha: 1, beta: [2, 3], gamma: { nested: true }, delta: 'x' }; // 4 top-level keys
		const e = await post('/echo', JSON.stringify(payload));
		const eb = await e.json().catch(() => null);
		if (e.status !== 200) { console.error('echo: expected 200, got ' + e.status); return 1; }
		if (!eb || JSON.stringify(eb.echo) !== JSON.stringify(payload)) { console.error('echo: body not round-tripped, got ' + JSON.stringify(eb)); return 1; }
		if (eb.count !== 4) { console.error('echo: expected count 4, got ' + JSON.stringify(eb && eb.count)); return 1; }

		// 4 — unknown route → 404
		const u = await get('/does-not-exist');
		if (u.status !== 404) { console.error('unknown route: expected 404, got ' + u.status); return 1; }

		// 5 — malformed JSON on /echo → 400 (the STATUS is grounded; the message quality is NOT checked here)
		const m = await post('/echo', '{ not: valid json ');
		if (m.status !== 400) { console.error('malformed body: expected 400, got ' + m.status); return 1; }

		return 0;
	} catch (e) { console.error('probe failed: ' + e.message); return 1; }
	finally { try { server.close(); } catch { /* already down */ } }
})();

process.exit(code);
