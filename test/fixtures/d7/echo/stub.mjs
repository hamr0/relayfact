// stub.mjs — the no-op the validity gate must reject as VACUOUS: a server that 404s everything (nothing is
// wired). The agentic GOLD catches it immediately (GET /healthz is not 200).
import http from 'node:http';

export function createApp() {
	return http.createServer((req, res) => {
		res.writeHead(404);
		res.end();
	});
}
