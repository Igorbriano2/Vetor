# Status do projeto Vetor

Este documento resume o que foi construído até agora, o que já é real e funcional, e o que ainda
precisa de decisão ou credencial de negócio antes de ir para produção.

**2026-08-17 — corrigido deploy quebrado (`apps/landing` e `apps/painel`):** o push da nova
landing page derrubou o deploy na DigitalOcean com `Cannot find module 'react'` — a DO só
publica o conteúdo de `source_dir` (ex.: `apps/landing/`), não o monorepo inteiro, e o
`npm install` deste workspace hoisted `react`/`react-dom` pro `node_modules` da raiz depois
que novas dependências foram instaladas. O build local mascarava isso (rodava com o monorepo
inteiro ao lado). Corrigido ativando `output: "standalone"` no `next.config.ts` dos dois apps
Next.js (`apps/landing` e `apps/painel` — mesmo risco, mesma causa, `apps/painel` só ainda não
tinha sido redeployado desde a mudança) e ajustando o script `build` pra copiar `public/` e
`.next/static/` pra dentro de `.next/standalone/`, e o script `start` pra rodar
`node .next/standalone/apps/<app>/server.js` diretamente. Testado copiando o `.next/standalone/`
resultante pra um diretório isolado, sem nenhum acesso ao resto do monorepo, e confirmando que o
servidor sobe e responde normalmente — reproduz o ambiente de runtime da DO. `apps/agentes` já
tinha resolvido o mesmo tipo de problema antes com bundle via esbuild (`dist/server.js`
standalone); esse é o equivalente pro Next.js.

**2026-08-17 — landing page substituída pelo design "command console":** a LP de
`apps/landing` foi trocada pela referência visual construída no Lovable
(`vetor-ai-marketing`, repositório externo, não faz parte deste monorepo) — tema escuro
oklch, fontes Sora + JetBrains Mono, painéis com blur/scanlines, animações de scroll
reveal, núcleo `VetorCore` orbital e uma sequência interativa de "diagnóstico" (boot
sequence + modo de operação em tela cheia). O design/layout/componentes React vieram do
Lovable; os dados factuais (plano Completo R$ 1.997/mês com cota+excedente, os 7 papéis
reais — Design, Estrategista, Social Media, Editor de Vídeo, Copywriter, Gestor de
Tráfego, Atendente —, a comparação de custo de montar a equipe e o FAQ) vieram dos
componentes antigos (`Planos.tsx`, `CustoAgencia.tsx`, `Comparativo.tsx`, `Faq.tsx`,
`PorTras.tsx`), pois o Lovable foi montado antes do posicionamento/preço final e tinha
números de placeholder. O formulário de lead continua gravando em `leads` via
`/api/leads` (mesmo contrato com `SUPABASE_SERVICE_ROLE_KEY`); o número de WhatsApp
placeholder em `src/lib/whatsapp.ts` não mudou. Nenhuma dependência do Supabase do
Lovable foi usada — o único componente puramente demonstrativo (`CommandBar`, a
simulação de diagnóstico) ficou local/estático, sem chamar nenhum backend externo.

**2026-08-14 — mudança de direção:** o dono do negócio decidiu adotar a spec do Manus
(`docs/manus-jarvis-spec/`) como norte do produto (cockpit, missões, governança por risco,
créditos), migrando o que já existe aos poucos. Ver `docs/09-plano-de-migracao-jarvis.md` para o
plano fase a fase. Nesta rodada: tokens visuais migrados para a paleta grafite/ciano/âmbar, schema
de missões criado (aditivo, ainda não conectado a um orquestrador), e o Agente Geral ganhou o
prompt mais rigoroso do Manus — mas **o nome do agente é "Vetor", nunca "JARVIS"** (risco de
marca/personagem — ver nota de nomenclatura em docs/09). O Agente Secretário também vai responder
em voz quando o cliente perguntar por áudio (ver seção de áudio abaixo).

## O que está pronto e funcional

- **Monorepo** (`apps/landing`, `apps/painel`, `apps/agentes`, `packages/shared`) com Next.js 16 +
  Tailwind v4 + TypeScript, buildando sem erros.
- **Banco de dados real**, provisionado no Supabase (projeto `vetor`, região São Paulo, plano
  gratuito): tabelas `clientes`, `usuarios`, `demandas`, `entregas`, `campanhas_trafego`,
  `conteudo_social`, `assinaturas`, `relatorios`, `log_agentes`, `leads`, `mensagens_whatsapp` —
  todas com Row Level Security habilitada e isolamento por `cliente_id` (multi-tenancy). Migrations
  versionadas em `supabase/migrations/`.
- **Landing page completa** (`apps/landing`), agora no design "command console" escuro
  portado do Lovable (ver nota de 2026-08-17 acima) — boot sequence, rede de agentes
  orbital com os 7 papéis reais, seletor de vertical, comparação de custo, planos e FAQ
  com o conteúdo/preço aprovados. Testada em desktop e mobile (build + lint limpos).
  Formulário de lead grava direto na tabela `leads` via `/api/leads`.
- **Painel do cliente** (`apps/painel`): login com Supabase Auth, visual cockpit (grafite/ciano/
  âmbar, núcleo `VetorCore` com estado computado a partir dos dados reais, sinais, timeline de
  demandas), protegido por middleware. Testado (build + telas renderizadas).
- **Fale com o Vetor, dentro do painel** (`ComandoVetor.tsx`): o cliente digita ou grava um áudio
  direto no cockpit, o Vetor entende (mesmo motor do Agente Secretário, agora compartilhado em
  `apps/agentes/src/agents/core.ts`), responde em texto e, quando a pergunta veio por áudio,
  também em voz — sem precisar do WhatsApp. Cria ticket estruturado do mesmo jeito. Canal
  autenticado por segredo compartilhado (`INTERNAL_API_TOKEN`) entre `apps/painel` e
  `apps/agentes`; histórico fica em `mensagens_plataforma` (RLS por cliente).
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
- **Reposicionamento "agência completa"** (documento 07): landing page mostra os 7 papéis (Design,
  Estrategista, Social Media, Editor de Vídeo, Copywriter, Gestor de Tráfego, Atendente) como
  agentes de IA, com seção de comparação de custo (`CustoAgencia.tsx`) e o plano Completo
  (R$ 1.997/mês) como carro-chefe. Animações de scroll reveal e microinterações.
- **Entendimento e resposta em áudio no Agente Secretário**: o webhook do WhatsApp reconhece
  mensagens de voz, baixa a mídia da Meta Cloud API e transcreve via provedor de STT plugável
  (`STT_PROVIDER`) antes de entrar na mesma pipeline de ticket estruturado. Quando o cliente
  pergunta por áudio, o agente Vetor **responde em áudio também** (síntese de voz via
  `TTS_PROVIDER`, mesmo padrão plugável) — se a síntese falhar ou não estiver configurada, cai
  para texto automaticamente, nunca trava o atendimento. Em modo sandbox (padrão, sem
  `STT_PROVIDER`/`TTS_PROVIDER` configurados), pede pro cliente escrever.
- Testes automatizados (`vitest`) para as partes com lógica pura (parsing de webhook do WhatsApp,
  extração de mensagens de áudio, validação de plano, fallback de síntese de voz) — todos
  passando.

## O que é estrutura pronta, mas precisa de credencial real para funcionar de verdade

Nada disso foi "fingido" — o código está implementado contra as APIs reais, só falta a chave:

| Integração | O que falta | Onde configurar |
|---|---|---|
| WhatsApp Business (Meta Cloud API) | Criar app no Meta for Developers, número de teste, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | `.env` de `apps/agentes` |
| Anthropic (LLM dos agentes) | `ANTHROPIC_API_KEY` real | `.env` de `apps/agentes` |
| Asaas | Conta sandbox no Asaas, `ASAAS_API_KEY`, configurar URL do webhook + `ASAAS_WEBHOOK_TOKEN` no painel Asaas | `.env` de `apps/agentes` |
| Supabase (chave secreta) | `SUPABASE_SERVICE_ROLE_KEY` — não é exposta por ferramentas automatizadas por segurança; pegue em Project Settings → API no painel do Supabase (projeto `vetor`, ref `rhqkzhiuweiblfkfsqxm`) | `.env`/`.env.local` de `apps/agentes` e `apps/landing` |
| Transcrição de áudio (STT) | Decidir provedor (implementado: OpenAI Whisper) e configurar `STT_PROVIDER=openai` + `OPENAI_API_KEY` | `.env` de `apps/agentes` |
| Resposta em voz (TTS) | Mesma chave `OPENAI_API_KEY` acima + `TTS_PROVIDER=openai` (implementado: OpenAI TTS, voz configurável em `TTS_VOICE`) | `.env` de `apps/agentes` |
| Canal "Fale com o Vetor" no painel | `INTERNAL_API_TOKEN` (mesmo valor nos dois apps) + `AGENTES_API_URL` apontando pro backend publicado — **diferente das outras linhas, sem isso o botão de enviar simplesmente não funciona** (erro 503 tratado, não trava a tela) | `.env`/`.env.local` de `apps/agentes` **e** `apps/painel` |
| Mission Orchestrator (fila de missões) | ✅ Provisionado — ver seção abaixo | `.env` de `apps/agentes`, no service `agentes` **e** no worker `mission-worker` |

Sem essas chaves, o sistema roda (builda, sobe, responde health check) mas não troca dados de
verdade com WhatsApp/Asaas/Anthropic — isso é intencional: nunca conectamos dinheiro ou número real
sem sandbox testado antes, conforme pedido no documento 06. O "Fale com o Vetor" do painel também
precisa de `ANTHROPIC_API_KEY` real pra responder de verdade (mesma chave da tabela acima).

### Mission Orchestrator — provisionado e no ar (2026-08-17)

O Mission Orchestrator (Fase 2: `missions`/`mission_steps`/`approvals` viram execução de verdade,
com fila BullMQ/Redis) está implementado, testado (28 testes), com o bug de segurança que ele
introduziu (aprovação entre clientes diferentes) já corrigido, **e agora no ar**: Redis gerenciado
(`vetor-missions-redis`) provisionado na DigitalOcean e o worker `mission-worker` rodando dentro do
app `vetor-agentes`. `https://api.vetormkt.online/health` confirmado 200.

Antes disso, sem essa infra, nada quebrava: o servidor HTTP subia normal, WhatsApp/demandas/entregas
seguiam funcionando como sempre — só a criação de uma missão real (`POST /plataforma/missoes`)
falharia ao tentar enfileirar. Próximo teste natural: criar uma missão de verdade pelo painel e
acompanhar ela avançar de etapa em etapa até completar (ver checklist sugerido na conversa).

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
