/**
 * [LAYOUT ARCHETYPE]: Asymmetric Knowledge Base & Prompt Studio
 * [RADIUS & BORDERS]: rounded-none to rounded (max 4px borders), high-contrast tactile panels
 * [ACCENT LOGIC]: #F2B705 Burnt Mustard Yellow for active frameworks & run CTA, #D9B48F Nude for secondary metrics
 */

import React, { useState } from 'react';
import { 
  BookOpen, 
  Cpu, 
  Sparkles, 
  CheckSquare, 
  Square, 
  MessageSquare, 
  RotateCcw, 
  Sliders, 
  Play, 
  Bot, 
  User, 
  CheckCircle2, 
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { KnowledgeBook, SystemPromptConfig } from '../types';

interface AITrainingProps {
  books: KnowledgeBook[];
  onToggleBook: (id: string) => void;
  onUpdateBookWeight: (id: string, weight: number) => void;
  systemPrompt: SystemPromptConfig;
  onUpdateSystemPrompt: (newConfig: SystemPromptConfig) => void;
}

export const AITraining: React.FC<AITrainingProps> = ({
  books,
  onToggleBook,
  onUpdateBookWeight,
  systemPrompt,
  onUpdateSystemPrompt,
}) => {
  const [copied, setCopied] = useState(false);
  const [testLeadMessage, setTestLeadMessage] = useState('Quanto custa a sua solução? Me passa a tabela de preços.');
  const [simulatedReply, setSimulatedReply] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Preset templates
  const presets = [
    {
      name: 'Consultor Estratégico (SPIN + Hormozi)',
      tone: 'consultivo' as const,
      prompt: `Você é um Consultor Sênior de Vendas B2B operando via WhatsApp.
Regras fundamentais:
1. Responda SEMPRE em tom humano, natural e conciso (máximo 2 a 3 frases por mensagem).
2. Nunca envie blocos longos de texto nem PDF na primeira mensagem.
3. Se o lead perguntar preço, aplique o princípio de Implicação do SPIN Selling e a Equação de Valor de Hormozi: valide o interesse e faça uma pergunta de diagnóstico de processo antes de revelar valores.
4. Conduza o lead para agendamento de um diagnóstico rápido via Google Meet.`,
    },
    {
      name: 'SDR Direto (Qualificação Rápida & Prospecção Fanática)',
      tone: 'direto' as const,
      prompt: `Você é um SDR focado em prospecção ativa de alta conversão.
Diretrizes:
1. Abordagem rápida e objetiva, eliminando atrito.
2. Identifique em até 2 trocas de mensagem se o lead é o tomador de decisão.
3. Se houver interesse, sugira imediatamente 2 opções de horário para call no Meet (ex: 'Amanhã às 10h ou às 15h?').`,
    },
    {
      name: 'Rapport Humanizado & Áudio First',
      tone: 'amigavel' as const,
      prompt: `Você é um assistente executivo humanizado e empático.
Diretrizes:
1. Use saudações descontraídas mas profissionais (ex: 'Opa, tudo bem por aí?').
2. Trate objeções acolhendo a dúvida do lead antes de redirecionar.
3. Indique que está gravando uma nota rápida quando o lead pedir explicação detalhada.`,
    },
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    onUpdateSystemPrompt({
      ...systemPrompt,
      presetName: preset.name,
      tone: preset.tone,
      prompt: preset.prompt,
    });
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(systemPrompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateResponse = () => {
    setIsSimulating(true);
    setSimulatedReply(null);

    setTimeout(() => {
      const activeBookTitles = books.filter(b => b.active).map(b => b.title);
      
      let reply = '';
      if (testLeadMessage.toLowerCase().includes('preço') || testLeadMessage.toLowerCase().includes('custa')) {
        if (activeBookTitles.includes('SPIN Selling') || activeBookTitles.includes('$100M Offers')) {
          reply = `Opa! Nossos planos variam conforme o volume de prospecção e a estrutura do seu time comercial. Hoje vocês já possuem alguém dedicado a SDR ou você mesmo faz os disparos? Pergunto isso pra te passar a estimativa exata.`;
        } else {
          reply = `Consigo te passar a proposta detalhada sim! Depende do tamanho da sua operação. Quantos contatos você costuma abordar por mês?`;
        }
      } else if (testLeadMessage.toLowerCase().includes('reunião') || testLeadMessage.toLowerCase().includes('agenda')) {
        reply = `Perfeito! Consigo abrir um slot rápido de 15 minutos amanhã. Fica melhor para você às 10h ou às 15h no Google Meet?`;
      } else {
        reply = `Entendi perfeitamente o seu ponto. A maioria dos clientes que chegam até nós tinham exatamente esse mesmo desafio. Se fizer sentido, posso te mostrar em 10 minutos na prática como resolvemos isso.`;
      }

      setSimulatedReply(reply);
      setIsSimulating(false);
    }, 800);
  };

  // Estimated tokens (approx 4 chars per token)
  const tokenCount = Math.round(systemPrompt.prompt.length / 3.8);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider">Engine Cognitivo</span>
            <span className="text-[10px] font-mono bg-[#141414] text-[#F2B705] border border-[#2c2c2c] px-1.5 py-0.2">
              BASE DE CONHECIMENTO & PROMPT
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            Treinamento da IA de Vendas
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Calibre a metodologia de vendas incorporada e as instruções do sistema do agente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 neu-sunken border border-[#222222] text-xs font-mono text-[#F2B705]">
            {books.filter(b => b.active).length} de {books.length} Livros Ativos no Contexto
          </span>
        </div>
      </div>

      {/* 1. KNOWLEDGE BASE BOOKS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-[#D9B48F] uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#F2B705]" />
            Metodologias e Livros Carregados
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            Clique no switch para ativar ou desativar o framework
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => {
            return (
              <div
                key={book.id}
                id={`card-book-${book.id}`}
                className={`neu-card p-4 transition-all flex flex-col justify-between border ${
                  book.active
                    ? 'border-[#F2B705]/60 bg-[#1a1a1a]'
                    : 'border-[#262626] bg-[#151515] opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-mono text-[#D9B48F] block">{book.author}</span>
                      <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                        {book.title}
                      </h3>
                    </div>

                    {/* Toggle Pill Switch */}
                    <button
                      type="button"
                      id={`toggle-book-${book.id}`}
                      onClick={() => onToggleBook(book.id)}
                      className={`w-11 h-6 neu-pill-track p-0.5 transition-colors flex items-center shrink-0 ${
                        book.active ? 'bg-[#181818]' : 'bg-[#121212]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 transition-transform duration-200 ${
                          book.active 
                            ? 'translate-x-5 bg-[#F2B705] shadow-[0_0_8px_#F2B705]' 
                            : 'translate-x-0 bg-zinc-600'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-3">
                    {book.tagline}
                  </p>

                  <div className="p-2.5 neu-sunken border border-[#222222] mb-3">
                    <span className="text-[10px] font-mono text-[#F2B705] block font-bold mb-1">
                      FRAMEWORK CENTRAL:
                    </span>
                    <p className="text-[11px] font-mono text-zinc-300">
                      {book.coreFramework}
                    </p>
                  </div>
                </div>

                {/* Key Techniques Checklist */}
                <div className="pt-2 border-t border-[#262626]">
                  <div className="space-y-1">
                    {book.keyTechniques.map((tech, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                        <div className={`w-1.5 h-1.5 ${book.active ? 'bg-[#F2B705]' : 'bg-zinc-600'}`} />
                        <span className="truncate">{tech}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SYSTEM PROMPT CONFIGURATION SECTION */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
          <div>
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#F2B705]" />
              System Prompt & Regras de Comportamento
            </span>
            <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
              Diretrizes do Robô no Atendimento
            </h3>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">Presets:</span>
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`px-2.5 py-1 text-[11px] font-mono whitespace-nowrap neu-btn border ${
                  systemPrompt.presetName === p.name
                    ? 'border-[#F2B705] text-[#F2B705] bg-[#141414]'
                    : 'border-[#2a2a2a] text-zinc-300 hover:text-white'
                }`}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea for System Prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="text-zinc-300 flex items-center gap-1">
              <span>Instruções do Sistema (Prompt Principal)</span>
            </span>
            <div className="flex items-center gap-3">
              <span>{tokenCount} Tokens Estimados</span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-[#D9B48F] hover:text-white"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <textarea
            id="textarea-system-prompt"
            rows={7}
            value={systemPrompt.prompt}
            onChange={(e) =>
              onUpdateSystemPrompt({
                ...systemPrompt,
                prompt: e.target.value,
              })
            }
            placeholder="Digite as instruções e regras para a IA..."
            className="w-full neu-sunken p-4 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#F2B705] border border-[#222222] leading-relaxed transition-colors"
          />
        </div>

        {/* Hyperparameter Adjustments */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="neu-sunken p-3 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-400 block mb-1">TOM DE VOZ</span>
            <select
              value={systemPrompt.tone}
              onChange={(e) =>
                onUpdateSystemPrompt({
                  ...systemPrompt,
                  tone: e.target.value as any,
                })
              }
              className="w-full bg-[#181818] border border-[#2c2c2c] text-xs font-mono text-[#F2B705] p-1.5 focus:outline-none"
            >
              <option value="consultivo">Consultivo & Estratégico</option>
              <option value="direto">Direto (SDR Rápido)</option>
              <option value="amigavel">Amigável & Rapport</option>
              <option value="formal">Corporativo Formal</option>
            </select>
          </div>

          <div className="neu-sunken p-3 border border-[#222222]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-zinc-400">CRIATIVIDADE (TEMP)</span>
              <span className="text-xs font-mono text-[#F2B705] font-bold">{systemPrompt.temperature}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={systemPrompt.temperature}
              onChange={(e) =>
                onUpdateSystemPrompt({
                  ...systemPrompt,
                  temperature: Number(e.target.value),
                })
              }
              className="w-full accent-[#F2B705] cursor-pointer"
            />
          </div>

          <div className="neu-sunken p-3 border border-[#222222]">
            <span className="text-[10px] font-mono text-zinc-400 block mb-1">MÁXIMO DE TOKENS</span>
            <select
              value={systemPrompt.maxTokens}
              onChange={(e) =>
                onUpdateSystemPrompt({
                  ...systemPrompt,
                  maxTokens: Number(e.target.value),
                })
              }
              className="w-full bg-[#181818] border border-[#2c2c2c] text-xs font-mono text-[#D9B48F] p-1.5 focus:outline-none"
            >
              <option value={150}>150 Tokens (~30 Palavras / Curto)</option>
              <option value={300}>300 Tokens (~60 Palavras / Médio)</option>
              <option value={600}>600 Tokens (~120 Palavras / Completo)</option>
            </select>
          </div>
        </div>

      </div>

      {/* 3. INTERACTIVE SIMULATOR / TEST SANDBOX */}
      <div className="neu-card p-6 bg-[#181818] border border-[#282828] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-[#D9B48F] uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#F2B705]" />
              Simulador de Resposta da IA
            </span>
            <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
              Teste de Diálogo em Tempo Real
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={testLeadMessage}
              onChange={(e) => setTestLeadMessage(e.target.value)}
              placeholder="Digite a mensagem do lead (ex: Quanto custa?)"
              className="flex-1 neu-sunken px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#F2B705] border border-[#222222]"
            />
            <button
              type="button"
              id="btn-simulate-ai-response"
              onClick={handleSimulateResponse}
              disabled={isSimulating || !testLeadMessage.trim()}
              className="px-4 py-2.5 neu-btn-accent text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              {isSimulating ? (
                <div className="w-4 h-4 border-2 border-[#121212] border-t-transparent animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 text-[#121212]" />
              )}
              <span>Testar IA</span>
            </button>
          </div>

          {/* Response Box */}
          {simulatedReply && (
            <div className="p-4 bg-[#141414] border-l-2 border-[#F2B705] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#F2B705] font-bold flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  RESPOSTA GERADA (Baseada nos livros ativos):
                </span>
                <span className="text-zinc-500">Latência: 120ms</span>
              </div>
              <p className="text-xs font-mono text-zinc-200 leading-relaxed bg-[#181818] p-3 border border-[#262626]">
                "{simulatedReply}"
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
