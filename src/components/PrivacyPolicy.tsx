import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, Mail, Phone, FileText } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 font-sans p-4 sm:p-8 max-w-4xl mx-auto selection:bg-[#25D366] selection:text-black">
      
      {/* Header Bar */}
      <header className="border-b border-zinc-800 pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[#25D366]">
              CONFORMIDADE LEGAL & LGPD
            </span>
            <span className="font-mono text-[11px] text-zinc-500">LEI Nº 13.709/2018</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 font-mono uppercase">
            Política de Privacidade — Prospectfy
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Girofy Tecnologia • Última atualização: 31 de Outubro de 2026
          </p>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-none text-xs font-mono uppercase tracking-wider text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel</span>
          </button>
        )}
      </header>

      {/* Main Legal Content */}
      <div className="space-y-6 text-zinc-300 text-xs sm:text-sm leading-relaxed">
        
        {/* Section 1 */}
        <section className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#25D366]" />
            <span>1. Identificação do Controlador</span>
          </div>
          <p>
            O <strong>Prospectfy</strong> é uma plataforma comercial desenvolvida e operada pela <strong>Girofy Tecnologia</strong>. 
            Esta Política de Privacidade tem como objetivo esclarecer de forma transparente como os dados pessoais são coletados, tratados, 
            armazenados e protegidos ao utilizar nossos serviços e ao interagir via WhatsApp comercial.
          </p>
          <div className="font-mono text-xs text-zinc-400 bg-[#000000] p-2.5 border border-zinc-900 space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
              <span>Canal do Encarregado (DPO / Responsável): <strong>jlzin2603@gmail.com</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-zinc-500" />
              <span>Número Comercial Autorizado: <strong>+55 74 8812-6578</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span>Meta App ID Homologado: <strong>1572840733789529 (Meuapp)</strong></span>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2">
          <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            2. Dados Coletados e Origem
          </h2>
          <p>
            Coletamos e processamos exclusivamente as informações estritamente necessárias para a qualificação comercial e 
            atendimento de solicitações feitas via WhatsApp:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li><strong>Identificadores de Contato:</strong> Número de telefone no padrão internacional E.164 e nome do perfil público do WhatsApp.</li>
            <li><strong>Histórico de Mensagens:</strong> Conteúdo das mensagens de texto, áudios, data e hora de envio/recebimento recebidas diretamente pelo canal comercial.</li>
            <li><strong>Metadados Técnicos:</strong> Identificadores de mensagem (Meta Message ID), confirmações de entrega e leitura.</li>
            <li><strong>Dados Corporativos:</strong> Empresa e nicho informados voluntariamente durante a conversa para elaboração de propostas.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2">
          <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            3. Finalidade do Tratamento
          </h2>
          <p>Os dados são tratados com base nas seguintes bases legais (Art. 7º da LGPD):</p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li><strong>Execução de Procedimentos Preliminares (Art. 7º, V):</strong> Responder a dúvidas, apresentar serviços (sites, sistemas, automações) e agendar demonstrações de 15 minutos via Google Meet.</li>
            <li><strong>Legítimo Interesse (Art. 7º, IX):</strong> Melhoria do atendimento comercial, prevenção de spam e gestão de relacionamento com clientes.</li>
            <li><strong>Cumprimento de Obrigação Legal (Art. 7º, II):</strong> Registro de logs de auditoria e atendimento aos pedidos de exclusão de dados.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2">
          <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            4. Provedores de Tecnologia e Compartilhamento
          </h2>
          <p>
            Não comercializamos dados de contatos com terceiros. O compartilhamento ocorre exclusivamente com a infraestrutura tecnológica necessária:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li><strong>Meta Platforms, Inc. (WhatsApp Business Cloud API):</strong> Conexão oficial para transmissão segura de mensagens criptografadas de ponta a ponta.</li>
            <li><strong>Google LLC (Google Gemini AI):</strong> Processamento em backend de linguagem natural para geração de respostas contextuais de qualificação sem utilização dos dados para treinamento público.</li>
            <li><strong>Vercel Inc.:</strong> Hospedagem serverless segura e execução das rotas protegidas de webhook com verificação criptográfica SHA-256.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2">
          <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            5. Direitos dos Titulares e Opt-Out Imediato
          </h2>
          <p>
            Em conformidade com o Artigo 18 da LGPD, todo titular de dados possui os direitos de confirmação, acesso, correção, 
            anonimização, bloqueio ou eliminação de seus dados pessoais.
          </p>
          <div className="p-3 bg-[#000000] border border-zinc-800 space-y-1.5 font-mono text-xs">
            <p className="text-[#25D366] font-bold">Mecanismo de Opt-Out Imediato:</p>
            <p className="text-zinc-300">
              Ao enviar palavras como "sair", "parar", "não tenho interesse" ou "remover contato" no WhatsApp, 
              o sistema bloqueia instantaneamente qualquer nova abordagem automatizada.
            </p>
            <p className="text-zinc-400">
              Para solicitação formal de exclusão completa do banco de dados, utilize nosso portal dedicado em{' '}
              <a href="/data-deletion" className="text-[#25D366] underline">/data-deletion</a> ou envie um e-mail para{' '}
              <span className="text-white">jlzin2603@gmail.com</span>.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="p-4 bg-[#09090B] border border-zinc-800 rounded-none space-y-2">
          <h2 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
            6. Segurança da Informação
          </h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger dados contra acessos não autorizados:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li>Comunicação exclusivamente via HTTPS com TLS 1.3.</li>
            <li>Validação criptográfica X-Hub-Signature-256 em todas as requisições de webhook da Meta.</li>
            <li>Nenhuma chave de API ou credencial sensível é exposta no cliente web ou em repositórios públicos.</li>
            <li>Retenção restrita ao ciclo comercial ativo, com exclusão sob demanda do titular.</li>
          </ul>
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-zinc-500">
        <div>Prospectfy © 2026 • Girofy Tecnologia</div>
        <div className="flex items-center gap-4">
          <a href="/data-deletion" className="hover:text-zinc-300 transition-colors">Exclusão de Dados</a>
          <span>•</span>
          <a href="mailto:jlzin2603@gmail.com" className="hover:text-zinc-300 transition-colors">Contato DPO</a>
        </div>
      </footer>
    </div>
  );
};
