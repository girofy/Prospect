// Leitura de páginas da internet, sob pedido do dono. Trava contra endereços internos (SSRF):
// só http/https, nada de rede privada, loopback ou link-local, e redirecionamentos conferidos a cada passo.
import dns from 'dns/promises';
import net from 'net';

const MAX_BYTES = 1_500_000;
export const MAX_PAGE_CHARS = 6000;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
  }
  return true; // formato desconhecido: recusa
}

export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr|section|article|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export async function readPage(raw: string): Promise<{ url: string; title: string; text: string }> {
  let url = new URL(raw);
  for (let hop = 0; hop < 5; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('só links http ou https');
    const addrs = await dns.lookup(url.hostname, { all: true });
    if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('esse endereço não é permitido');

    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'GirofyAgente/1.0 (leitura pedida pelo dono)', Accept: 'text/html,text/plain' },
      signal: AbortSignal.timeout(15_000),
    });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, url); continue; }
    if (!res.ok) throw new Error(`a página respondeu ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|xml/i.test(ct)) throw new Error('isso não é uma página de texto');

    const html = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_BYTES).toString('utf8');
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
    return { url: url.toString(), title, text: htmlToText(html).slice(0, MAX_PAGE_CHARS) };
  }
  throw new Error('redirecionamentos demais');
}
