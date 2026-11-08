# Auditoria do sistema Girofy Prospect (8 nov 2026)

Mapa de como as peças se ligam, o que roda sozinho, e onde estão as falhas. Números do banco lidos em 8/11 às 01h50 (Bahia).

## 1. Peças e conexões

| Peça | Onde roda | Liga com | Custo |
|---|---|---|---|
| Painel (React) | Render, serviço `girofy` | API do próprio serviço, com senha | grátis |
| API + timers (Node) | Render, serviço `girofy` | Supabase, Evolution, Gemini, Groq | grátis (horas limitadas por mês) |
| Evolution API | Render, serviço `evolution-zap` | WhatsApp do número comercial (instância `prospectfy`) | grátis |
| Banco | Supabase | contatos, mensagens, config, conhecimento, aprendizados, auditoria | grátis |
| Despertador | Cloudflare Worker `girofy-keepalive` | chama os dois serviços a cada 10 min | grátis |
| IA | Gemini (20 chamadas/dia) e Groq (limite por minuto) | cadeia com troca automática | grátis |
| Áudio | Groq Whisper | transcreve antes da IA | grátis |

## 2. Fluxos (do começo ao fim)

**A. Prospecção (sozinha)**
Fila de contatos `novo` → timer a cada minuto → confere janela (6h30 às 19h, domingo ligado), teto 40/dia, pausa, intervalo 4 a 9 min → confere telefone real, banco e histórico no WhatsApp → manda abertura curta variada → grava mensagem e auditoria.

**B. Resposta a lead (sozinha)**
WhatsApp → Evolution → webhook → transcreve áudio → opt-out para tudo → aviso de lead quente para você → IA (com conhecimento, aprendizados e histórico) → espera humana → envia em até 2 bolhas. Se a IA estiver fora: contato vira `aguardando_humano` e entra na fila de atrasadas.

**C. Fila de atrasadas (sozinha)**
A cada minuto tenta responder quem ficou sem resposta, até 12 h depois. Hoje a fila está vazia.

**D. Modo dono (seu WhatsApp)**
Seu número manda mensagem → IA entende o pedido → executa só ações permitidas (status, pausar, retomar, resumir, listar, enviar com confirmação, ler link, alarme).

**E. Alarmes (sozinho)**
Timer de 30 s dispara lembrar, retomar ou pausar na hora pedida.

**F. Aprendizado (sozinho)**
Lê conversas encerradas e grava o que funcionou e o que falhou; os 8 melhores entram no prompt. Agora roda só entre 20h e 5h.

**G. Painel**
Home com placar do dia e sistema mental; Conversas; Girofy IA (resumo, retomar, conhecimento, modelos, aprendizado); Ajustes.

## 3. Falhas encontradas

| # | Falha | Efeito | Situação |
|---|---|---|---|
| 1 | Aprendizado usava o Gemini de dia, 5 por passe, 4 passes por dia | podia gastar as 20 chamadas grátis e deixar lead sem resposta | **corrigido**: só de 20h a 5h |
| 2 | Só 9 aprendizados gravados, o último em 7/11 | a IA quase não aprende ainda | melhora sozinho com volume |
| 3 | 2 leads em `aguardando_humano` | gente esperando você | aparece agora em "A única coisa de hoje" |
| 4 | Nenhuma reunião ou venda registrada no sistema | não dá para medir o funil até o fim | falta um botão "fechou" na conversa |
| 5 | Notas da pesquisa (dossiê e Barreiras) estão no banco mas não entram no prompt | a IA não usa o que se sabe da empresa | PR #37 espera seu sim |
| 6 | Cloudflare (Gateway e Workers AI) não ligado | sem segunda fonte de IA grátis | token ainda recusado |
| 7 | Gemini 20/dia é o gargalo em dia de volume | depende do Groq e da fila | monitorar hoje |
| 8 | Conversas com número escondido (LID) são ignoradas | lead some sem aviso | limitação do WhatsApp |
| 9 | Render grátis tem horas limitadas por mês | serviço pode parar no fim do mês | sem solução grátis |
| 10 | Exportação pessoal temporária ainda existe | código que devia sumir | apagar quando você confirmar |
| 11 | Card "Meta Cloud API" na Home e campos da Meta | coisa que não é usada | escondido em Avançado; card a trocar |
| 12 | Cores escritas à mão em centenas de lugares | visual inconsistente | próximo passo: tokens |

## 4. O que fazer, em ordem

1. Hoje: acompanhar as primeiras respostas e responder os 2 que esperam você.
2. Aprovar o PR #37 (a IA passa a usar a pesquisa de cada empresa).
3. Botão "fechou / reunião" na conversa, para o funil e o pote de biscoito contarem vendas.
4. Tokens de cor e espaçamento no painel.
5. Cloudflare quando o token passar.
