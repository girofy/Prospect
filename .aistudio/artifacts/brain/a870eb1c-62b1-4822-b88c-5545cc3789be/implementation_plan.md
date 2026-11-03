# Dual Gateway WhatsApp & Micro-Disparos Cadenciados (Prospectfy)

Plano de engenharia para habilitar conexão direta via **Código de Pareamento de 8 Dígitos** no celular (sem necessidade de escanear QR Code em outro computador e sem cobrança por disparos de marketing da Meta), mantendo a **Cloud API Oficial** preservada, com **Micro-Disparos de Teste (5 a 10 contatos)** e **IA SDR Girofy** com mensagens humanas de 10 a 15 palavras.

---

## Revisão do Usuário & Decisões Críticas

> [!IMPORTANT]
> **Decisões confirmadas pelo usuário:**
> 1. **Modo Dual de Conexão:** A Meta Cloud API oficial continua totalmente configurada no backend (App ID, Phone ID e Webhook salvos), mas o app ganha o modo **Conexão Direta por Código de 8 Dígitos** (número do celular + código gerado para pareamento direto em *Aparelhos Conectados*).
> 2. **Custo Zero & Uso 100% no Celular:** Nenhum pagamento de servidor externo ou taxa de mensagem de marketing. O pareamento é feito digitando o código alfanumérico diretamente no WhatsApp Business do próprio aparelho.
> 3. **Micro-Disparos de Prospecção:** Fila controlada para lotes de teste de 5 a 10 contatos quentes, com intervalos seguros (15 a 45 segundos) entre cada mensagem ("Bom dia"), evitando risco de bloqueio.
> 4. **IA SDR Humana & Enxuta:** O motor Gemini 2.5 Flash assume assim que o lead responder ("Bom dia"), respondendo em 1 a 2 mensagens curtas (10 a 15 palavras cada), conversando como uma pessoa real e convidando para uma reunião de 15 minutos.

---

## 1. Visão Geral & Proposta de Valor

- **Para quem é:** Empreendedores e SDRs que operam sua prospecção inteiramente pelo smartphone, sem depender de um computador para ler QR Code.
- **O que faz:** Permite conectar o WhatsApp Business ao Prospectfy em segundos inserindo o número e o código de pareamento, disparar pequenas cadências de 5 a 10 mensagens de abordagem inicial, e deixar a IA responder as conversas iniciadas pelo cliente dentro da janela de gratuidade oficial ou via conexão direta.
- **Diferencial:** Elimina a frustração de pagar centavos por cada mensagem fria enviada e a barreira técnica de servidores de terceiros.

---

## 2. Experiência do Usuário & Design Mobile (Apple Style)

### Fluxos Principais
1. **Conexão por Código de 8 Dígitos (Mobile):**
   - No topo do app, um widget exibe o status de conexão.
   - Ao tocar em "Conectar WhatsApp", o usuário escolhe entre *Conexão Direta (Código no Celular)* ou *Meta Cloud API (Oficial)*.
   - Selecionando Conexão Direta: insere o número (ex: `74988126578`).
   - O app gera e exibe um código legível em destaque (ex: `G8KP - 92LF`) com botão de copiar em um toque.
   - Passo a passo visual em 3 passos: *WhatsApp > Aparelhos Conectados > Conectar com número de telefone > Digitar o código*.
   - Status muda para "🟢 Conectado via WhatsApp Business".

2. **Micro-Disparos Cadenciados (5 a 10 Leads):**
   - Painel intuitivo com seleção rápida de 5 ou 10 contatos da lista ou colagem rápida de números.
   - Mensagem de teste pré-definida amigável ("Bom dia!").
   - Indicador visual de progresso em tempo real com barra circular/linear e delay aleatório (ex: "Enviando 2 de 5... aguardando 18s").
   - Histórico instantâneo com status (Enviado, Respondido, Na Fila).

3. **Atendimento com IA Humanizada:**
   - Quando o lead responde "Bom dia" ou pergunta do que se trata, o Prospectfy processa via Gemini.
   - A IA envia no máximo 2 balões de 10 a 15 palavras cada (ex: *"Bom dia! Notei que vocês atendem bastante no WhatsApp. Vocês já usam IA para qualificar leads?"*).
   - O usuário pode acompanhar em tempo real na tela de conversas ou intervir a qualquer instante.

### Identidade Visual
- **Padrão Apple/iOS:** Superfícies brancas com sombras suaves sobre fundo cinza-gelo (`#F5F5F7`), cantos arredondados generosos (`rounded-2xl` e `rounded-3xl`), botões táteis grandes para toque com polegar.
- **Cores Semânticas:** Azul Apple (`#0071E3`), Verde WhatsApp (`#25D366`), Cinza de superfície (`#FFFFFF` e `#E5E5EA`).

---

## 3. Decisões Técnicas & Arquitetura

- **Dual Gateway no Backend:**
  - `Meta Cloud API`: Mantém endpoints `/api/webhook` e `https://graph.facebook.com/v18.0/...` intactos com os dados de App ID e Phone Number já cadastrados.
  - `Direct Pairing Gateway`: Endpoint `/api/pairing/request` que recebe o número de telefone, valida formato internacional (+55...), gera a sessão de pareamento e retorna o código de 8 dígitos de conexão.
  - Endpoint `/api/campaign/dispatch` para gerenciar a fila assíncrona de 5 a 10 contatos com delays humanos seguros.
- **Motor de Inteligência Artificial Gemini:**
  - Modelo `@google/genai` utilizando `gemini-2.5-flash`.
  - Prompt com diretivas rigorosas de concisão: proibição explícita de textos longos ou listas com marcadores; respostas limitadas estritamente a 10-15 palavras por mensagem, simulando digitação humana real.

---

## 4. Diagrama de Arquitetura & Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                   PROSPECTFY MOBILE UI                      │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │  Widget Status & Modo │       │  Micro-Disparos (5-10)│  │
│  │  [Direto / Cloud API] │       │  Delay Seguro 15-45s  │  │
│  └───────────┬───────────┘       └───────────┬───────────┘  │
│              │                               │              │
│              ▼                               ▼              │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Modal Código 8 Dígitos│       │ Chat & CRM em Tempo   │  │
│  │   "G8KP - 92LF"       │       │ Real com Balões iOS   │  │
│  └───────────┬───────────┘       └───────────▲───────────┘  │
└──────────────┼───────────────────────────────┼──────────────┘
               │                               │
               ▼                               │
┌──────────────────────────────────────────────┴──────────────┐
│                    BACKEND (server.ts)                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WhatsApp Gateway Controller                          │  │
│  │  ├─ /api/pairing/code  (Gera código para o celular)   │  │
│  │  ├─ /api/pairing/status (Verifica conexão ativa)      │  │
│  │  └─ /api/campaign/send (Fila de 5-10 disparos)        │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │  Motor IA SDR Gemini 2.5 Flash                        │  │
│  │  ├─ Regra estrita: 10 a 15 palavras por mensagem      │  │
│  │  ├─ Tom humano, direto e natural                      │  │
│  │  └─ Objetivo: Reunião de 15 minutos                   │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │  Meta Cloud API (Preservada & Pronta para Uso)        │  │
│  │  ├─ Webhook /api/webhook                              │  │
│  │  └─ App ID: 1572840733789529 | Phone: 1221241567748320│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Próximos Passos (Após Aprovação)

1. **Atualizar `server.ts`**:
   - Adicionar rotas `/api/pairing/code`, `/api/pairing/status` e a fila de micro-disparos com timer inteligente.
   - Ajustar o system prompt do Gemini SDR para o formato de mensagens curtas (10-15 palavras).
2. **Atualizar `src/App.tsx`**:
   - Modal com fluxo completo de pareamento por código de 8 dígitos no celular.
   - Novo widget de micro-disparos com seleção de 5 a 10 leads e contador com intervalo.
   - Alternador claro entre Conexão Direta e Meta Cloud API oficial.
3. **Validação & Compilação**:
   - Teste de compilação com `compile_applet` e verificação da integridade do dev server.
