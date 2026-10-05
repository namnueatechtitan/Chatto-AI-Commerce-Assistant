// Local tunnel upstream: only channel-specific LINE POSTs reach the API.
// No bodies, signatures, cookies, authorization headers, or access logs are saved.
const http = require('node:http');
const route = /^\/webhooks\/line\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const server = http.createServer((request, response) => {
  if (request.method !== 'POST' || !route.test(request.url || '')) {
    response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end(); return;
  }
  const headers = {};
  for (const name of ['content-type', 'content-length', 'x-line-signature']) {
    if (typeof request.headers[name] === 'string') headers[name] = request.headers[name];
  }
  let bytes = 0;
  const upstream = http.request({ hostname: '127.0.0.1', port: 4000, method: 'POST',
    path: request.url, headers, timeout: 30000 }, result => {
    response.writeHead(result.statusCode || 502, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    });
    result.pipe(response);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) { upstream.destroy(); request.unpipe(upstream); if (!response.headersSent) response.writeHead(413); response.end(); }
  });
  request.on('error', () => upstream.destroy());
  response.on('close', () => upstream.destroy());
  request.pipe(upstream);
});
server.requestTimeout = 35000;
server.headersTimeout = 10000;
server.on('error', () => { process.stderr.write('LINE gateway failed to bind; no request data logged.\n'); process.exitCode = 1; });
server.listen(4001, '127.0.0.1', () => process.stdout.write('LINE gateway listening on loopback port 4001.\n'));
