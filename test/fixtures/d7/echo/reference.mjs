// reference.mjs — the RELAYFACT-HELD correct /echo service for D7 Task 3 (agentic tier; never shown to the
// worker). Exercised over real HTTP by the GOLD harness. Stdlib http only (no deps).
import http from 'node:http';

export function createApp() {
	return http.createServer((req, res) => {
		const send = (code, obj) => {
			res.writeHead(code, { 'content-type': 'application/json' });
			res.end(JSON.stringify(obj));
		};

		if (req.method === 'GET' && req.url === '/healthz') {
			send(200, { status: 'ok' });
			return;
		}

		if (req.method === 'POST' && req.url === '/echo') {
			let raw = '';
			req.on('data', (chunk) => { raw += chunk; });
			req.on('end', () => {
				let body;
				try {
					body = JSON.parse(raw);
				} catch {
					send(400, { error: 'invalid_json', message: 'Request body is not valid JSON — it could not be parsed. Send a well-formed JSON document.' });
					return;
				}
				const count = (body && typeof body === 'object') ? Object.keys(body).length : 0;
				send(200, { echo: body, count });
			});
			return;
		}

		send(404, { error: 'not_found', message: `No route for ${req.method} ${req.url}` });
	});
}
