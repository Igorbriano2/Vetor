# 00 — Resumo Executivo e Guia de Uso dos Documentos

## Como usar este pacote

Você não programa, e não precisa. Este pacote foi feito para ser **entregue ao Claude Code** (a ferramenta de linha de comando/desktop da Anthropic que escreve e executa código) em etapas. Cada documento tem uma função:

| Arquivo | Função | Quem usa primeiro |
|---|---|---|
| `00-resumo-executivo-e-guia-de-uso.md` | Este documento — visão geral e ordem de execução | Você |
| `01-identidade-de-marca-e-posicionamento.md` | Nome, tom de voz, cores, tipografia | Você (decide) + Claude Code (aplica) |
| `02-especificacao-landing-page.md` | Briefing completo da landing page | Claude Code |
| `03-arquitetura-de-agentes-e-prompts-mestre.md` | Os prompts/system prompts de cada agente de IA | Claude Code |
| `04-especificacao-tecnica-e-stack.md` | Stack técnica, banco de dados, integrações | Claude Code |
| `05-integracao-pagamentos-assinatura.md` | Asaas vs Stripe, modelo de cobrança, webhooks | Claude Code |
| `06-plano-de-execucao-comandos-claude-code.md` | **Os comandos prontos, em ordem, para colar no Claude Code** | Você → Claude Code |

**Fluxo recomendado:** leia o 01 e decida o nome da marca (ou aceite a sugestão). Depois abra o Claude Code na pasta do projeto, cole os documentos 02 a 05 como contexto (ou aponte o Claude Code para a pasta onde estão salvos) e siga o passo a passo do documento 06, um bloco por vez. Não cole tudo de uma vez — o documento 06 já está dividido em fases pequenas para isso.

---

## O que foi revisado antes de montar este pacote

Antes de gerar os prompts, revisei três coisas que mudam a estrutura do projeto:

1. **Meios de pagamento no Brasil:** hoje, para empresas sediadas no Brasil, o Pix pela Stripe está disponível apenas por convite (não é self-service). O Asaas, por ser brasileiro, já resolve Pix, boleto, cartão, split de pagamento e nota fiscal de forma nativa. Por isso a recomendação técnica (documento 05) é **Asaas como meio de pagamento principal**, com Stripe como opção secundária só se no futuro vocês quiserem cobrar clientes internacionais em cartão/dólar.
2. **Referência de landing page (octosolve.com.br):** analisei a estrutura da página que você indicou. Ela funciona bem porque conta uma "jornada" (um dia de trabalho do agente, hora a hora), personaliza por nicho de negócio, e é muito clara nos limites de cada plano (nada de "ilimitado" vago). O documento 02 usa essa mesma lógica, adaptada para agência de marketing.
3. **Escopo realista de agentes de IA:** manter os 9 agentes da sua ideia original, mas o documento 03 já organiza isso em prompts prontos e numa ordem de construção que começa pequena (não tentamos construir os 9 agentes ao mesmo tempo — isso é detalhado no documento 06).

---

## Decisão de nome e identidade (resumo — detalhes no documento 01)

Sugestão principal: **Vetor** (ou **Vetor IA**), com posicionamento de "a força que dá direção e ganho ao marketing do seu negócio". Duas alternativas também estão no documento 01, caso prefira outra linha. **Trocar o nome depois é simples**: é só usar localizar-e-substituir nos documentos antes de repassar ao Claude Code — todos os arquivos usam "Vetor" de forma consistente para isso funcionar.

---

## Visão geral do roadmap (detalhado no documento 06)

- **Fase 1 (MVP):** landing page + atendimento via WhatsApp com 1 agente (Secretário) + painel de solicitação de demanda simples + cobrança de assinatura via Asaas.
- **Fase 2:** Agente Geral (orquestrador) + Agente de Design + Agente de Tráfego básico.
- **Fase 3:** Agente de Social Media, Estratégia, Analítico.
- **Fase 4:** Growth, Edição de Vídeo, automações avançadas, relatórios com IA.

Essa ordem prioriza o que gera caixa mais rápido (atendimento + tráfego + design, que são os serviços mais vendáveis para o público-alvo de vocês) antes dos agentes mais "internos" (Growth, Analítico).
