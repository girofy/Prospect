// Lê a lista de empresas de qualquer arquivo comum: CSV, TXT, planilha .xlsx ou texto colado.
// Acha sozinho a coluna de telefone (pelo nome ou pelo conteúdo) e guarda o resto como pesquisa.
export interface Row { phone: string; company?: string; notes?: string }

const PHONE_CELL = /^[\s+()\-.\d]{10,20}$/;
const isPhoneLike = (v: string) => { const d = String(v || '').replace(/\D/g, ''); return PHONE_CELL.test(String(v || '').trim()) && d.length >= 10 && d.length <= 13; };

function textToTable(text: string): string[][] {
  const first = text.split(/\r?\n/)[0] || '';
  const count = (c: string) => (first.match(new RegExp(c === '\t' ? '\t' : '\\' + c, 'g')) || []).length;
  const sep = count(';') > count(',') && count(';') >= count('\t') ? ';' : count('\t') > count(',') ? '\t' : ',';
  const rows: string[][] = [];
  let cur: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { cur.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; cur.push(cell); cell = ''; if (cur.some(x => x.trim())) rows.push(cur); cur = []; }
    else cell += ch;
  }
  if (cell || cur.length) { cur.push(cell); if (cur.some(x => x.trim())) rows.push(cur); }
  return rows;
}

export function tableToRows(table: string[][]): Row[] {
  if (!table.length) return [];
  const width = Math.max(...table.map(r => r.length));
  const headed = !table[0].some(isPhoneLike);
  const head = headed ? table[0].map(h => String(h || '').trim()) : [];
  const body = headed ? table.slice(1) : table;
  let iPhone = headed ? head.findIndex(h => /(telefone|phone|whats|celular|fone|n[uú]mero)/i.test(h) && !/link|wa\.me/i.test(h)) : -1;
  if (iPhone < 0) {
    let best = -1, bestN = 0;
    for (let c = 0; c < width; c++) { const n = body.slice(0, 60).filter(r => isPhoneLike(r[c])).length; if (n > bestN) { best = c; bestN = n; } }
    iPhone = best;
  }
  if (iPhone < 0) return [];
  let iName = headed ? head.findIndex((h, i) => i !== iPhone && /(neg[oó]cio|empresa|nome|name)/i.test(h)) : -1;
  if (iName < 0) iName = Array.from({ length: width }, (_, i) => i).find(i => i !== iPhone && body.slice(0, 20).some(r => r[i] && /[a-zA-ZÀ-ú]{3}/.test(r[i]) && !/^https?:/.test(r[i]))) ?? -1;
  return body.map(r => {
    const notes = r.map((v, i) => {
      const t = String(v || '').trim();
      if (i === iPhone || i === iName || !t || /^https?:/.test(t)) return '';
      return headed && head[i] ? `${head[i]}: ${t}` : t;
    }).filter(Boolean).join('. ');
    return { phone: String(r[iPhone] || ''), company: iName >= 0 ? String(r[iName] || '').trim() || undefined : undefined, notes };
  }).filter(r => isPhoneLike(r.phone));
}

// Texto solto (colado ou .txt sem colunas): procura telefones em cada linha; o resto da linha vira o nome.
function looseRows(text: string): Row[] {
  const out: Row[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/(\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}/);
    if (!m) continue;
    const rest = line.replace(m[0], '').replace(/[|;,\t]+/g, ' ').trim();
    out.push({ phone: m[0], company: rest || undefined });
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipSheet(buf: ArrayBuffer): Promise<{ shared: string; sheet: string }> {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('arquivo inválido');
  const total = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  for (let n = 0; n < total; n++) {
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(u8.slice(off + 46, off + 46 + nlen));
    off += 46 + nlen + elen + clen;
    if (name !== 'xl/sharedStrings.xml' && name !== 'xl/worksheets/sheet1.xml') continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = u8.slice(start, start + csize);
    out[name] = new TextDecoder().decode(method === 0 ? raw : await inflateRaw(raw));
  }
  return { shared: out['xl/sharedStrings.xml'] || '', sheet: out['xl/worksheets/sheet1.xml'] || '' };
}

async function xlsxToTable(buf: ArrayBuffer): Promise<string[][]> {
  const { shared, sheet } = await unzipSheet(buf);
  const parse = (x: string) => new DOMParser().parseFromString(x, 'application/xml');
  const strings = Array.from(parse(shared).getElementsByTagName('si')).map(si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent || '').join(''));
  const table: string[][] = [];
  for (const row of Array.from(parse(sheet).getElementsByTagName('row'))) {
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r') || '';
      const col = ref.replace(/\d/g, '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent || '';
      cells[col] = t === 's' ? strings[Number(v)] || '' : t === 'inlineStr' ? (c.getElementsByTagName('t')[0]?.textContent || '') : v;
    }
    table.push(Array.from(cells, x => x || ''));
  }
  return table;
}

export async function readList(file: File): Promise<Row[]> {
  if (/\.xlsx$/i.test(file.name)) return tableToRows(await xlsxToTable(await file.arrayBuffer()));
  return readText(await file.text());
}

export function readText(text: string): Row[] {
  const rows = tableToRows(textToTable(text));
  return rows.length ? rows : looseRows(text);
}
