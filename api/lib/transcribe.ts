import { db } from './db';

// Transcreve áudio do WhatsApp com o Whisper do Groq (grátis, modelo separado da cota de texto).
// Devolve '' se falhar: quem chama cai no plano B (o Gemini ouve o áudio direto).
export async function transcribeAudio(media: { mimeType: string; data: string }): Promise<string> {
  const cfg = await db.getConfig();
  const key = (cfg.groqApiKey || process.env.GROQ_API_KEY || '').trim();
  if (!key) return '';
  try {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(media.data, 'base64')], { type: media.mimeType || 'audio/ogg' }), 'audio.ogg');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'pt');
    form.append('response_format', 'verbose_json'); // traz no_speech_prob para descartar áudio sem fala
    form.append('temperature', '0');
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.error('[Audio] transcrição falhou:', res.status, (await res.text()).slice(0, 200));
      return '';
    }
    const j: any = await res.json();
    // Whisper "inventa" palavras em silêncio ou ruído: descarta se os trechos são quase todos sem fala.
    const segs: any[] = Array.isArray(j.segments) ? j.segments : [];
    if (!segs.length || segs.every(x => Number(x.no_speech_prob ?? 0) > 0.5)) return '';
    return String(j.text || '').trim();
  } catch (err: any) {
    console.error('[Audio] erro na transcrição:', String(err?.message || err).slice(0, 200));
    return '';
  }
}
