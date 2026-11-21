import { api as neonApi } from './neon-api.mjs';
// Public Think Tank entrance: public assets, authenticated API.
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; worker-src 'none'; manifest-src 'none'";
function assetPath(pathname) {
  if (pathname === '/') return '/landing';
  if (pathname === '/index' || pathname === '/index.html') return '/';
  if (pathname.endsWith('.html')) return pathname.slice(0, -5);
  return pathname;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return neonApi(request, env, url.pathname);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405});
    const target = new URL(request.url);
    target.pathname = assetPath(url.pathname);
    const resp = await env.APP.fetch(new Request(target.toString(), request));
    const headers = new Headers(resp.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    if ((headers.get('Content-Type') || '').includes('text/html')) headers.set('X-Robots-Tag', 'index, follow');
    return new Response(resp.body, {status: resp.status, statusText: resp.statusText, headers});
  }
};