import { db } from '../lib/db';
import { probeModel } from '../lib/gemini';

// Leitor de chave: recebe (ou usa a salva) a chave de um provedor, lista os modelos que ela enxerga,
// classifica por capacidade/preço e, no Groq, faz um teste real de resposta em cada candidato.
// Não salva nada. Protegida pelo login.

type Info = {
  id: string;
  context: number | null;
  vision: boolean;
  audio: boolean;
  reasoning: boolean;
  priceIn: number | null; // US$ por milhão de tokens
  priceOut: number | null;
  kind: 'chat' | 'audio' | 'seguranca' | 'outro';
  score: number;
};

const NOT_CHAT = /(whisper|orpheus|guard|safeguard|allam|embed|tts|imagen|veo|aqa|live|image|robotics|computer-use|audio)/i;

function sizeOf(id: string): number {
  const m = id.match(/(\d+(?:\.\d+)?)b\b/i);
  return m ? Number(m[1]) : 0;
}

async function readGroq(key: string): Promise<Info[]> {
  const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw Object.assign(new Error(r.status === 401 ? 'Chave recusada pelo Groq (inválida ou revogada).' : `Groq respondeu ${r.status}.`), { status: r.status });
  const j: any = await r.json();
  return (j.data || [])
    .filter((m: any) => m.active !== false)
    .map((m: any): Info => {
      const inp: string[] = m.input_modalities || ['text'];
      const feats: string[] = m.supported_features || [];
      const isAudio = inp.includes('audio') || /whisper|orpheus/i.test(m.id);
      const kind: Info['kind'] = isAudio ? 'audio' : /guard|safeguard/i.test(m.id) ? 'seguranca' : NOT_CHAT.test(m.id) ? 'outro' : 'chat';
      const vision = inp.includes('image');
      const reasoning = feats.includes('reasoning');
      const pin = m.pricing?.prompt != null ? Number(m.pricing.prompt) * 1e6 : null;
      const pout = m.pricing?.completion != null ? Number(m.pricing.completion) * 1e6 : null;
      const ctx = m.context_window ?? null;
      const score = kind === 'chat' ? Math.min(sizeOf(m.id), 130) + (vision ? 40 : 0) + (reasoning ? 10 : 0) + ((ctx || 0) >= 100000 ? 5 : 0) : 0;
      return { id: m.id, context: ctx, vision, audio: isAudio, reasoning, priceIn: pin, priceOut: pout, kind, score };
    });
}

async function readGemini(key: string): Promise<Info[]> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw Object.assign(new Error(r.status === 400 || r.status === 403 ? 'Chave recusada pelo Gemini (inválida ou revogada).' : `Gemini respondeu ${r.status}.`), { status: r.status });
  const j: any = await r.json();
  return (j.models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m: any): Info => {
      const id = String(m.name || '').replace(/^models\//, '');
      const kind: Info['kind'] = NOT_CHAT.test(id) || /gemma/i.test(id) ? 'outro' : 'chat';
      const ver = Number((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
      const flash = /flash/i.test(id) && !/lite/i.test(id);
      const lite = /lite/i.test(id);
      const preview = /preview|exp|latest/i.test(id);
      const score = kind === 'chat' ? ver * 20 + (flash ? 25 : 0) + (lite ? 10 : 0) - (preview ? 5 : 0) : 0;
      return {
        id,
        context: m.inputTokenLimit ?? null,
        vision: true,
        audio: true,
        reasoning: !!m.thinking,
        priceIn: null,
        priceOut: null,
        kind,
        score,
      };
    });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const provider = body.provider === 'gemini' ? 'gemini' : 'groq';
  const cfg = await db.getConfig();
  const saved = provider === 'gemini' ? cfg.geminiApiKey || process.env.GEMINI_API_KEY : cfg.groqApiKey || process.env.GROQ_API_KEY;
  const key = String(body.apiKey || saved || '').trim();
  if (!key) return res.status(400).json({ error: `Sem chave do ${provider === 'gemini' ? 'Gemini' : 'Groq'}. Cole a chave primeiro.` });

  try {
    const all = provider === 'gemini' ? await readGemini(key) : await readGroq(key);
    const chat = all.filter(m => m.kind === 'chat').sort((a, b) => b.score - a.score);

    // Teste real só no Groq (cota própria e generosa). No Gemini cada teste gastaria a cota diária.
    const probes: Record<string, { ok: boolean; reply: string; ms: number; problem: string | null; error?: string }> = {};
    if (provider === 'groq' && body.probe !== false) {
      for (const m of chat.slice(0, 4)) probes[m.id] = await probeModel('groq', m.id, key);
    }

    const passed = chat.filter(m => probes[m.id]?.ok && !probes[m.id]?.problem);
    const suggested = provider === 'groq' ? (passed.length ? passed : chat).slice(0, 2).map(m => m.id) : chat.filter(m => /flash/i.test(m.id)).slice(0, 2).map(m => m.id);

    return res.status(200).json({
      provider,
      total: all.length,
      models: all.sort((a, b) => b.score - a.score).map(m => ({ ...m, probe: probes[m.id] || null })),
      suggested,
      note:
        provider === 'groq'
          ? 'Teste real feito nos 4 melhores candidatos de texto. Modelos de áudio (whisper) servem para transcrever, não para conversar.'
          : 'No Gemini não testo cada modelo (gastaria a cota diária). A lista vem da própria chave; o ranking usa versão e família.',
    });
  } catch (err: any) {
    return res.status(err?.status === 401 || err?.status === 403 ? 400 : 502).json({ error: err?.message || 'Não consegui ler a chave.' });
  }
}
