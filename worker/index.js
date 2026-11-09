const upstreamOrigin = 'https://hhudam.vip.cpolar.cn';
const apiPath = /^\/(?:auth|api|ai-gw|disaster-gw|emergency-api)(?:\/|$)/;
const forwardedHeaders = [
  'accept', 'accept-language', 'content-type', 'authorization', 'range',
  'if-modified-since', 'if-none-match', 'upgrade', 'sec-websocket-key',
  'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/engineering') {
      return Response.redirect(new URL('/engineering/', url), 308);
    }
    if (url.pathname.startsWith('/engineering/')) {
      if (!env.ASSETS) return new Response('工程分析资源尚未部署。', { status: 503 });
      return env.ASSETS.fetch(request);
    }

    const isApi = apiPath.test(url.pathname);
    const readOnly = request.method === 'GET' || request.method === 'HEAD';
    if (!readOnly && !isApi) return new Response('Method not allowed', { status: 405 });
    const upstream = new URL(upstreamOrigin);
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    const headers = new Headers();
    for (const key of forwardedHeaders) {
      const value = request.headers.get(key);
      if (value && (key !== 'authorization' || isApi)) headers.set(key, value);
    }
    if (isApi && request.headers.has('origin')) headers.set('Origin', upstreamOrigin);
    let response;
    try {
      response = await fetch(upstream, {
        method: request.method, headers, body: readOnly ? undefined : request.body, redirect: 'manual', duplex: 'half',
      });
    } catch {
      return new Response('原平台服务暂时无法连接，请稍后重试。', { status: 502 });
    }
    if (response.status === 101) return response;
    const resultHeaders = new Headers(response.headers);
    // Site identity and session are managed separately from the original application.
    resultHeaders.delete('Set-Cookie');
    const location = resultHeaders.get('Location');
    if (location) {
      const target = new URL(location, upstream);
      if (target.origin === upstreamOrigin) resultHeaders.set('Location', target.pathname + target.search + target.hash);
    }
    if (isApi) resultHeaders.set('Cache-Control', 'no-store');
    const root = url.pathname === '/' || url.pathname === '/index.html';
    const html = root && request.method === 'GET' && response.ok &&
      resultHeaders.get('Content-Type')?.includes('text/html');
    if (html) {
      resultHeaders.delete('Content-Length');
      resultHeaders.delete('Content-Encoding');
      resultHeaders.delete('ETag');
      resultHeaders.set('Cache-Control', 'no-store');
      const source = await response.text();
      return new Response(source.replace(/<\/body\s*>/i,
        '<script src="/engineering/integrate.js" defer></script></body>'), {
        headers: resultHeaders, status: response.status,
      });
    }
    return new Response(response.body, { headers: resultHeaders, status: response.status });
  },
};
