// Extrai texto de arquivos enviados para a base de conhecimento (PDF, Word, texto).
// PDF escaneado (só imagem) não tem texto: devolve vazio e a tela avisa.
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function extractFromFile(filename: string, buf: Buffer): Promise<{ text: string; kind: string }> {
  const name = filename.toLowerCase();

  if (name.endsWith('.pdf')) {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return { text: String(text || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), kind: 'pdf' };
  }

  if (name.endsWith('.docx')) {
    const r = await mammoth.extractRawText({ buffer: buf });
    return { text: r.value.replace(/\n{3,}/g, '\n\n').trim(), kind: 'docx' };
  }

  if (/\.(md|markdown|txt|csv|json|html?)$/.test(name)) {
    let t = buf.toString('utf-8');
    if (/\.html?$/.test(name)) t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ');
    return { text: t.replace(/\r/g, '').trim(), kind: 'texto' };
  }

  throw new Error('Tipo de arquivo não suportado. Use PDF, Word (.docx), .md, .txt, .csv, .json ou .html.');
}
