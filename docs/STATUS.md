# Status do projeto Vetor

Este documento resume o que foi construído nesta primeira rodada (Fase 0 + Fase 1 do
`docs/06-plano-de-execucao-comandos-claude-code.md`), o que já é real e funcional, e o que
ainda precisa de decisão ou credencial de negócio antes de ir para produção.

## O que está pronto e funcional

- **Monorepo** (`apps/landing`, `apps/painel`, `apps/agentes`, `packages/shared`) com Next.js 16 +
  Tailwind v4 + TypeScript, buildando sem erros.
- **Banco de dados real**, provisionado no Supabase (projeto `vetor`, região São Paulo, plano
  gratuito): tabelas `clientes`, `usuarios`, `demandas`, `entregas`, `campanhas_trafego`,
  `conteudo_social`, `assinaturas`, `relatorios`, `log_agentes`, `leads`, `mensagens_whatsapp` —
  todas com Row Level Security habilitada e isolamento por `cliente_id` (multi-tenancy). Migrations
  versionadas em `supabase/migrations/`.
- **Landing page completa** (`apps/landing`), com todas as 9 seções do documento 02, na ordem
  descrita, com a identidade visual (cores/tipografia) do documento 01 aplicada. Testada em
  desktop e mobile. Formulário de lead grava direto na tabela `leads` via `/api/leads`.
- **Painel do cliente** (`apps/painel`): login com Supabase Auth, dashboard mostrando demandas e
  histórico de entregas, protegido por middleware (usuário não autenticado é redirecionado).
  Testado (build + tela de login renderizada).
- **Agente Secretário** (`apps/agentes`): servidor Express com webhook do WhatsApp Business (Meta
  Cloud API) — verificação de assinatura do webhook, recebimento de mensagens, chamada real à API
  da Anthropic com o system prompt do documento 03 e tool-use para registrar o ticket estruturado
  na tabela `demandas`. Roda em `WHATSAPP_MODE=sandbox` por padrão (loga a resposta no console em
  vez de enviar de verdade). Testado localmente (health check, verificação de webhook).
- **Integração Asaas**: criação de cliente + assinatura recorrente (Pix/boleto/cartão) para os
  planos fixos (`design`, `social_media`, `duplo` — conforme comando 1.5 do documento 06), endpoint
  de webhook (`PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_CANCELED`) atualizando o status
  da assinatura e do cliente. Aponta para `api-sandbox.asaas.com` por padrão.
- **Prompts dos 9 agentes** (documento 03) salvos em `apps/agentes/src/agents/prompts/`, prontos
  para orquestração nas Fases 2-4.
- Testes automatizados (`vitest`) para as partes com lógica pura (parsing de webhook do WhatsApp,
  validação de plano) — todos passando.

## O que é estrutura pronta, mas precisa de credencial real para funcionar de verdade

Nada disso foi "fingido" — o código está implementado contra as APIs reais, só falta a chave:

| Integração | O que falta | Onde configurar |
|---|---|---|
| WhatsApp Business (Meta Cloud API) | Criar app no Meta for Developers, número de teste, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | `.env` de `apps/agentes` |
| Anthropic (LLM dos agentes) | `ANTHROPIC_API_KEY` real | `.env` de `apps/agentes` |
| Asaas | Conta sandbox no Asaas, `ASAAS_API_KEY`, configurar URL do webhook + `ASAAS_WEBHOOK_TOKEN` no painel Asaas | `.env` de `apps/agentes` |
| Supabase (chave secreta) | `SUPABASE_SERVICE_ROLE_KEY` — não é exposta por ferramentas automatizadas por segurança; pegue em Project Settings → API no painel do Supabase (projeto `vetor`, ref `rhqkzhiuweiblfkfsqxm`) | `.env`/`.env.local` de `apps/agentes` e `apps/landing` |

Sem essas chaves, o sistema roda (builda, sobe, responde health check) mas não troca dados de
verdade com WhatsApp/Asaas/Anthropic — isso é intencional: nunca conectamos dinheiro ou número real
sem sandbox testado antes, conforme pedido no documento 06.

## Limitações conhecidas do MVP (esperadas nesta fase)

- **Provisionamento de cliente é manual**: hoje não existe tela de "criar conta" — um cliente só
  aparece no painel depois que alguém (admin) cria a linha em `clientes` + `usuarios` (isso é
  proposital: no fluxo do documento 05, o cliente é criado *depois* da confirmação de pagamento,
  não por autocadastro).
- **Agente Secretário não decide nada sozinho** ainda além de registrar o ticket — não aciona
  Agente Geral nem outros agentes (isso é o Comando 2.1 em diante, Fase 2).
- **Cobrança variável (excedente de créditos) e % sobre verba de mídia** não implementadas —
  ficam para a Fase 4 (comando 4.3), como o próprio documento 06 recomenda.
- Vulnerabilidades `npm audit` reportadas em `apps/agentes` são todas em dependências de
  desenvolvimento (`vitest`/`vite`/`esbuild`, servidor de dev), não afetam o build de produção.

## Próximos passos sugeridos (Fase 2 em diante)

Seguir os comandos do `docs/06-plano-de-execucao-comandos-claude-code.md`, a partir do Comando 2.1
(Agente Geral / orquestrador), um bloco por vez, testando com clientes beta antes de avançar —
exatamente como o documento recomenda.
