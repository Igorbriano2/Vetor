# Status do projeto Vetor

Este documento resume o que foi construído até agora, o que já é real e funcional, e o que ainda
precisa de decisão ou credencial de negócio antes de ir para produção.

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
- **Landing page completa** (`apps/landing`), com todas as 9 seções do documento 02, na ordem
  descrita, com a identidade visual (cores/tipografia) do documento 01 aplicada. Testada em
  desktop e mobile. Formulário de lead grava direto na tabela `leads` via `/api/leads`.
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
| Mission Orchestrator (fila de missões) | `REDIS_URL` — **decisão de custo pendente, ver abaixo**, não configurar sem confirmar com o Igor | `.env` de `apps/agentes`, no service `agentes` **e** no worker `mission-worker` |

Sem essas chaves, o sistema roda (builda, sobe, responde health check) mas não troca dados de
verdade com WhatsApp/Asaas/Anthropic — isso é intencional: nunca conectamos dinheiro ou número real
sem sandbox testado antes, conforme pedido no documento 06. O "Fale com o Vetor" do painel também
precisa de `ANTHROPIC_API_KEY` real pra responder de verdade (mesma chave da tabela acima).

### Mission Orchestrator — pendente de decisão de custo (não provisionado)

O Mission Orchestrator (Fase 2: `missions`/`mission_steps`/`approvals` viram execução de verdade,
com fila BullMQ/Redis) está implementado, testado (28 testes) e com o bug de segurança que ele
introduziu (aprovação entre clientes diferentes) já corrigido — mas **ainda não está no ar**. Falta
uma peça de infraestrutura com custo recorrente que este agente (rodando em sandbox, sem acesso à
API/console da DigitalOcean) não pode e não deve provisionar sozinho:

1. Um Redis (ex.: DigitalOcean Managed Database — Redis, menor tier ~US$15/mês) — gera o `REDIS_URL`.
2. Um segundo processo (`workers:` já adicionado em `.do/app-agentes.yaml`, componente
   `mission-worker`) rodando ao lado do `agentes` — mais uma instância `basic-xxs` (~US$5/mês) na
   conta da DigitalOcean.

Sem isso, nada quebra: o servidor HTTP sobe normal, WhatsApp/demandas/entregas seguem funcionando
como sempre. Só a criação de uma missão real (`POST /plataforma/missoes`) falharia ao tentar
enfileirar. Quando o Igor confirmar que quer pagar por isso, os passos são: criar o Redis na
DigitalOcean, colar o `REDIS_URL` como secret nos dois componentes (`agentes` e `mission-worker`) e
aplicar o spec atualizado de `.do/app-agentes.yaml` (que já inclui o worker).

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
