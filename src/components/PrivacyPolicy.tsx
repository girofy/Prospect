import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, Mail, Phone, FileText } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans p-4 sm:p-8 max-w-4xl mx-auto selection:bg-[#0071E3] selection:text-white">
      
      {/* Header Bar */}
      <header className="border-b border-black/[0.08] pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-[#34C759]/10 text-[#248A3D] rounded">
              Conformidade Legal & LGPD
            </span>
            <span className="text-[11px] text-zinc-500">Lei nº 13.709/2018</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Política de Privacidade — Prospectfy
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Girofy Tecnologia • Última atualização: 31 de Outubro de 2026
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-black/[0.08] rounded text-xs font-semibold text-zinc-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel</span>
          </button>
        )}
      </header>

      {/* Main Legal Content */}
      <div className="space-y-4 text-zinc-700 text-xs sm:text-sm leading-relaxed">
        
        {/* Section 1 */}
        <section className="p-4 bg-white border border-black/[0.08] rounded shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
            <span>1. Identificação do Controlador</span>
          </div>
          <p>
            O <strong>Prospectfy</strong> é uma plataforma comercial desenvolvida e operada pela <strong>Girofy Tecnologia</strong>. 
            Esta Política de Privacidade tem como objetivo esclarecer de forma transparente como os dados pessoais são coletados, tratados, 
            armazenados e protegidos ao utilizar nossos serviços e ao interagir via WhatsApp comercial.
          </p>
          <div className="text-xs text-zinc-600 bg-[#F5F5F7] p-3 border border-black/[0.06] rounded space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
              <span>Canal do Encarregado (DPO / Responsável): <strong>jlzin2603@gmail.com</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-zinc-500" />
              <span>Número Oficial Autorizado: <strong>+55 74 8812-6578</strong></span>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section className="p-4 bg-white border border-black/[0.08] rounded shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
            <FileText className="w-4 h-4 text-[#0071E3]" />
            <span>2. Dados Coletados</span>
          </div>
          <p>Tratamos estritamente os dados necessários para o atendimento comercial e qualificação de interesse em soluções digitais:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li><strong>Identificadores de Contato:</strong> Número de telefone celular (formato E.164, ex: +55...), nome de perfil informado no WhatsApp.</li>
            <li><strong>Conteúdo das Mensagens:</strong> Mensagens de texto trocadas durante a conversa para contextualização e continuidade do atendimento.</li>
            <li><strong>Metadados Técnicos:</strong> Identificador único da mensagem atribuído pela Meta (wamid), timestamp e status de entrega.</li>
            <li><strong>Registros de Auditoria:</strong> Data e hora da interação, ação executada pelo agente ou operador humano, consentimentos e opt-out.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="p-4 bg-white border border-black/[0.08] rounded shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
            <Lock className="w-4 h-4 text-[#0071E3]" />
            <span>3. Finalidades do Tratamento e Bases Legais</span>
          </div>
          <p>
            O tratamento de dados é respaldado pelas seguintes bases legais da Lei Geral de Proteção de Dados (LGPD - Art. 7º):
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li><strong>Procedimentos Preliminares relacionados a Contrato (Art. 7º, V):</strong> Qualificação de interesse, apresentação de propostas de desenvolvimento de sites, landing pages e sistemas Girofy.</li>
            <li><strong>Legítimo Interesse do Controlador (Art. 7º, IX):</strong> Resposta a prospects comerciais que interagem ativamente, com respeito irrestrito aos direitos do titular.</li>
            <li><strong>Cumprimento de Obrigação Legal (Art. 7º, II):</strong> Registro de solicitações de exclusão de dados e logs de consentimento.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="p-4 bg-white border border-black/[0.08] rounded shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
            <span>4. Subprocessadores e Provedores de Serviço</span>
          </div>
          <p>Para prover a infraestrutura técnica e de inteligência artificial, utilizamos provedores com alto padrão de segurança:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded">
              <strong className="text-[#1D1D1F] block mb-0.5">Meta Platforms Ireland Ltd.</strong>
              <span>WhatsApp Business Cloud API para transmissão segura e recebimento de mensagens.</span>
            </div>
            <div className="p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded">
              <strong className="text-[#1D1D1F] block mb-0.5">Google Cloud / Gemini API</strong>
              <span>Processamento semântico no backend para compreensão de contexto. Seus dados não são usados para treinar modelos públicos.</span>
            </div>
            <div className="p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded">
              <strong className="text-[#1D1D1F] block mb-0.5">Vercel Inc.</strong>
              <span>Hospedagem serverless segura com isolamento de ambiente e variáveis secretas criptografadas.</span>
            </div>
            <div className="p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded">
              <strong className="text-[#1D1D1F] block mb-0.5">SQLite / Firestore</strong>
              <span>Armazenamento isolado de contatos, histórico e status de atendimento com controle de acesso estrito.</span>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="p-4 bg-white border border-black/[0.08] rounded shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
            <FileText className="w-4 h-4 text-[#0071E3]" />
            <span>5. Direitos do Titular (Art. 18 LGPD)</span>
          </div>
          <p>O titular dos dados tem o direito garantido de solicitar a qualquer momento:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Confirmação da existência de tratamento e acesso aos dados.</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários.</li>
            <li><strong>Eliminação simplificada:</strong> Disponibilizamos uma página pública direta para solicitação de exclusão em <a href="/data-deletion" className="text-[#0071E3] underline">/data-deletion</a>.</li>
            <li>Opt-out imediato por mensagem no próprio WhatsApp comercial enviando palavras como "sair", "parar" ou "descadastrar".</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="p-4 bg-white border border-black/[0.08] rounded shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">
            <Lock className="w-4 h-4 text-[#0071E3]" />
            <span>6. Retenção e Segurança</span>
          </div>
          <p>
            Armazenamos os dados apenas pelo período necessário para atender às finalidades comerciais legítimas ou prazos legais prescricionais.
            Empregamos criptografia em trânsito (HTTPS/TLS), autenticação por assinatura SHA-256 no webhook Meta, e segregação de credenciais 
            exclusivamente no servidor backend.
          </p>
        </section>

      </div>

      <footer className="mt-8 pt-4 border-t border-black/[0.08] text-center text-xs text-zinc-500">
        Prospectfy • Girofy Tecnologia • Contato DPO: jlzin2603@gmail.com
      </footer>
    </div>
  );
};
