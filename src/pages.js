import { escapeHtml } from './lib.js';

// /l/CODIGO → sirve liga.html con título y vista previa (WhatsApp) de esa liga.
export async function leaguePage(request, env, code) {
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new URL('/liga', url.origin));
  let html = await asset.text();
  code = String(code || '').toUpperCase();
  const lg = /^[A-Z0-9]{6}$/.test(code)
    ? await env.DB.prepare('SELECT name FROM leagues WHERE code = ?').bind(code).first()
    : null;
  if (lg) {
    const title = escapeHtml(`Únete a «${lg.name}» en Tepicas`);
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
      .replace(/(<meta property="og:url" content=")[^"]*/, `$1${escapeHtml(url.origin + '/l/' + code)}`);
  }
  html = html.replace(/https:\/\/tepicas\.com\/og\.png/g, url.origin + '/og.png');
  return new Response(html, {
    status: lg ? 200 : 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
