# Vetor

Agência de marketing operada por agentes de IA — atendimento via WhatsApp, execução (design,
tráfego, social media, vídeo) e estratégia, supervisionados por humanos.

## Estrutura do monorepo

- `apps/landing` — landing page pública (Next.js + Tailwind)
- `apps/painel` — painel autenticado do cliente (Next.js + Tailwind)
- `apps/agentes` — backend dos agentes de IA e integrações (WhatsApp, Meta Ads, Asaas)
- `packages/shared` — tipos, clientes de API e utilitários compartilhados entre os apps
- `docs` — documentos de planejamento (00 a 06) usados como fonte de verdade do produto

## Documentação de referência

Todo o planejamento do produto está em `/docs`. Antes de alterar qualquer área, confira o
documento correspondente:

| Área | Documento |
|---|---|
| Visão geral / roadmap | `docs/00-resumo-executivo-e-guia-de-uso.md` |
| Marca, tom de voz, cores | `docs/01-identidade-de-marca-e-posicionamento.md` |
| Landing page | `docs/02-especificacao-landing-page.md` |
| Prompts dos agentes de IA | `docs/03-arquitetura-de-agentes-e-prompts-mestre.md` |
| Stack técnica e modelagem de dados | `docs/04-especificacao-tecnica-e-stack.md` |
| Pagamentos (Asaas) | `docs/05-integracao-pagamentos-assinatura.md` |
| Plano de execução por fases | `docs/06-plano-de-execucao-comandos-claude-code.md` |

## Status do projeto

Ver `docs/STATUS.md` para o que já está implementado, o que é stub/sandbox, e o que falta
configurar com credenciais reais antes de ir para produção.

## Ambientes

- **Desenvolvimento**: local, com `.env` a partir de `.env.example`.
- **Homologação**: para testes com clientes beta.
- **Produção**: só depois de credenciais reais (WhatsApp, Meta Ads, Asaas) validadas em sandbox.

Variáveis sensíveis nunca são commitadas — sempre em `.env`, listadas (sem valores) em
`.env.example`.
