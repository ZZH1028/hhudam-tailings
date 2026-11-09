import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { extname, resolve, sep } from 'node:path';
import worker from '../worker/index.js';

const args = process.argv.slice(2);
const port = Number(args.find(value => value.startsWith('--port='))?.slice(7) ||
  (args.includes('--port') && args[args.indexOf('--port') + 1]) || process.env.PORT || 4173);
const root = resolve('dist/client');
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.csv': 'text/csv', '.wasm': 'application/wasm',
  '.xml': 'text/xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
};
const env = { ASSETS: { async fetch(request) {
  const path = decodeURIComponent(new URL(request.url).pathname);
  const filename = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
  if (!filename.startsWith(root + sep)) return new Response(null, { status: 403 });
  const info = await stat(filename).catch(() => null);
  if (!info?.isFile()) return new Response(null, { status: 404 });
  return new Response(request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(filename)), {
    headers: { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Content-Length': String(info.size) },
  });
} } };

createServer(async (incoming, outgoing) => {
  const method = incoming.method || 'GET';
  try {
    const request = new Request('http://' + incoming.headers.host + incoming.url, {
      method, headers: incoming.headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : Readable.toWeb(incoming), duplex: 'half',
    });
    const response = await worker.fetch(request, env);
    const headers = new Headers(response.headers);
    // Node fetch decodes upstream bodies. Do not advertise their old encoding or byte count.
    if (headers.has('Content-Encoding')) {
      headers.delete('Content-Encoding');
      headers.delete('Content-Length');
    }
    outgoing.writeHead(response.status, Object.fromEntries(headers));
    if (response.body && method !== 'HEAD') Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch {
    outgoing.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    outgoing.end('预览服务无法读取原站或构建资源。');
  }
}).listen(port, '0.0.0.0', () => console.log('Tailings preview http://localhost:' + port));
