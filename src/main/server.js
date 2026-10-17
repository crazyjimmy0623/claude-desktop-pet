// Local HTTP endpoint: Claude Code hooks (/event), a generic API (/api/event) and a Codex adapter (/codex).
// Binds to 127.0.0.1 only and always answers with an empty 204, so a hook response can never steer Claude.
const http = require('http');

const MAX_BODY = 20 * 1024 * 1024;

function startServer(port, routes) {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    // A browser always says where a request comes from; hooks, curl and Codex never do. Without this
    // any web page could post here (a no-cors fetch needs no preflight) and drive the characters.
    if (req.headers.origin || req.headers['sec-fetch-site']) {
      res.writeHead(403).end();
      return;
    }
    const handler = req.method === 'POST' && routes[req.url];
    if (!handler) {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on('end', () => {
      res.writeHead(204).end();
      if (size > MAX_BODY) return;
      try {
        handler(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        // Malformed payloads are ignored; Deskmates must never get in the way.
      }
    });
  });
  server.on('error', (err) => console.error(`[deskmates] server error: ${err.message}`));
  server.listen(port, '127.0.0.1', () => console.log(`[deskmates] listening on http://127.0.0.1:${port}`));
  return server;
}

module.exports = { startServer };
