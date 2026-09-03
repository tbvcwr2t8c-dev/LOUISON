import http from 'node:http';
import { readFile } from 'node:fs/promises';
const allowed = /^\/(?:index\.html|src\/[a-zA-Z0-9/.-]+\.js)$/;
http.createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  const file = path === '/' ? '/index.html' : path;
  if (!allowed.test(file) || file.includes('..')) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(new URL('..' + file, import.meta.url));
    response.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(content);
  } catch { response.writeHead(404).end(); }
}).listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
