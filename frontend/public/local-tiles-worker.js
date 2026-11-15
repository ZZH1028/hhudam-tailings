import { getTile } from './local-tiles-db.js';

const prefix = new URL('local-tiles/', self.registration.scope).pathname;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function respond(path) {
  try {
    const [id, ...rest] = path.split('/').map(decodeURIComponent);
    const entry = await getTile(id, rest.join('/'));
    if (entry) {
      return new Response(entry.file, {
        headers: {
          'Content-Type': /\.json$/i.test(rest.at(-1)) ? 'application/json' : 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
          'Cross-Origin-Resource-Policy': 'same-origin',
        },
      });
    }
  } catch {
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 404 });
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith(prefix)) {
    event.respondWith(respond(url.pathname.slice(prefix.length)));
  }
});
