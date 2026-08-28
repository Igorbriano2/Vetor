# Arquitetura — Suíte de IA (Image/Video/Voice/Design/3D/Spaces)

**Gerado em:** 2026-08-28, sessão autônoma noturna (autorização explícita do dono do produto:
"apesar de ser uma mudança grande você deve me entregar tudo amanhã... trabalhe com o que temos").

Este documento é a Fase 0 do prompt-mestre "Reproduzir a suíte de IA da Freepik/Magnific dentro do
Vetor". Registra decisões tomadas no lugar de perguntas (conforme instruído), pra nunca duplicar
infraestrutura que já existe.

## 1. Discovery — stack real (já conhecida, sessão em andamento no mesmo repo)

| Camada | Stack real |
|---|---|
| `apps/painel` | Next.js 16 (App Router) + TypeScript + Tailwind v4 + React 19. Sem shadcn/ui — componentes próprios em `components/ui/`. `@xyflow/react` (React Flow) já instalado. `fabric` (editor de canvas) já instalado. |
| `apps/agentes` | Express + TypeScript + `@anthropic-ai/sdk` + `@supabase/supabase-js` + BullMQ (fila real, Redis). Rotas registradas em `server.ts` via `Router()` + middleware `exigirAuthInterna`. |
| `apps/render` | Serviço dedicado com ffmpeg real (Dockerfile próprio) — proxy, render final, análise de referência. |
| Banco | Supabase Postgres, RLS universal por `cliente_id` (nunca um `workspace_id`/`tenant_id` paralelo — `clientes.id` já é o workspace). Migrations em `supabase/migrations/*.sql`, sequenciais, sempre `create table if not exists` + RLS + policies no mesmo arquivo. |
| Auth | Supabase Auth, `usuarios.cliente_id` resolve o cliente ativo (`resolverClienteAtivo.ts`). |
| IA já configurada | `ANTHROPIC_API_KEY` (Claude, usado em várias partes: specialistRunner, vetorPlataforma, designCritic, metaAdsSync). Geração de imagem já existe via `imageProvider.ts`/`ProviderRouter` (OpenAI + Gemini, fallback sequencial). Geração de vídeo já existe via Higgsfield (`integrations/higgsfield.ts`). |
| Sem SDK de terceiro pesado | Toda integração externa no `apps/agentes` usa `fetch` nativo direto (ver `metaAdsSync.ts`, `higgsfield.ts`) — nunca um SDK novo só pra uma chamada HTTP. Os novos adapters desta suíte seguem o mesmo padrão. |

## 2. Decisão arquitetural central — nunca duplicar o que já existe

O Vetor já tem DOIS paradigmas de criação que continuam existindo sem mudança:

1. **Paradigma "agente"** (existente): o cliente conversa com o Vetor (`/vetor`), um especialista
   (Design/Vídeo/Tráfego/...) decide e executa via `mission_steps`/`specialistRunner.ts`. Ferramentas
   de geração real (`criar_peca_de_design`, `gerar_video_higgsfield`, `editar_video_timeline`) já
   existem e continuam exatamente como estão.
2. **Paradigma "estúdio direto"** (novo, esta suíte): o cliente abre uma tela dedicada
   (`/imagem`, `/video-ia`, `/voz`, `/3d`), escolhe modelo/parâmetros e gera na hora, sem passar por
   missão/aprovação — o padrão Magnific/Freepik. É um SEGUNDO caminho de entrada, não substitui o
   primeiro.

Os dois paradigmas devem **compartilhar a mesma execução real de baixo nível** (mesmo provider,
mesmo storage, mesmo registro de uso de crédito) sempre que fizer sentido — mas isso é trabalho de
uma rodada futura de unificação, não desta. Nesta rodada, a suíte nova é aditiva e isolada
(`ai-providers/`, tabelas novas, rotas novas), sem tocar em `specialistRunner.ts`/`orchestrator.ts`
existentes.

### Mapeamento módulo-a-módulo (o que é novo vs. o que já existe)

| Módulo do prompt-mestre | Decisão |
|---|---|
| 1. Image Generator | **Novo** — `/imagem`, tela dedicada de geração rápida. Não existia UI dedicada (a geração de imagem só acontecia dentro do fluxo de Design via agente). |
| 2. Video Generator | **Novo** — `/video-ia`. Diferente de `/videomaker` (que é EDITOR de timeline pra montar/cortar clipes já existentes, não gerador). Os dois convivem: `/video-ia` gera um clipe novo do zero, que pode depois entrar no `/videomaker` como fonte. |
| 3. Voice Generator | **Novo** — `/voz`. Não existia nada de voz gerada no Vetor (só TTS de locução do sistema, `integrations/tts.ts`, que é pra saudação do cockpit, não pro cliente). |
| 4. Design | **Reaproveitado** — `/design` já tem editor real (Fabric.js, `DesignProjectEditor.tsx`, camadas reais, brand kit). Esta rodada só adiciona: (a) `<TemplateGallery/>` compartilhada alimentando `/design` também, (b) ação "Transformar em design editável" a partir de uma imagem gerada em `/imagem`. Nunca um segundo editor. |
| 5. 3D Scenes | **Novo, escopo reduzido** — `/3d`. Dado o orçamento de uma sessão, prioriza o modo "Meu espaço real" (maior valor comercial, conforme o prompt-mestre) com upload + job mock + viewer three.js básico. Modo "Criar do zero" fica como shell (schema/rota prontos, UI mínima). |
| 6. Spaces | **Documentado, não implementado nesta rodada** — o Vetor já tem `@xyflow/react` rodando em produção (`CreativeCanvasEditor.tsx`, `MissionCanvas.tsx`). "Spaces" deve ser uma EXTENSÃO do Creative Canvas existente (novos tipos de nó: Gerador de Imagem/Vídeo/Voz chamando os mesmos `AIProviderAdapter`), nunca um canvas paralelo. Ver seção 7 — fica como próximo passo documentado, dado que o próprio prompt-mestre pede pra implementar por último e depender dos módulos 1-5 estáveis.

## 3. Modelo de dados — decisões

- **Sem tabela `workspaces`/`projects` nova.** `clientes.id` já é o workspace (mesma convenção usada
  em toda a base — `design_projects.cliente_id`, `video_projects.cliente_id`, etc.). Um cliente que
  precisar de múltiplas marcas já é um problema de produto separado, fora do escopo desta suíte.
- **Tabelas novas** (migration `0041_ai_suite.sql`): `ai_models`, `generation_jobs`, `credit_ledger`,
  `templates`, `voices`. Todas com `cliente_id` + RLS isolado (`current_cliente_id() or
  current_papel() = 'admin_vetor'`, o padrão literal já usado em toda tabela do projeto) — exceto
  `ai_models`/`templates`/`voices`, que são catálogos GLOBAIS (sem `cliente_id`, leitura pública pra
  qualquer cliente autenticado, escrita só admin — mesmo padrão de `reference_library_items` com
  `tenant_id` nullable já usado no upgrade Gravyx anterior).
- `generation_jobs.kind` cobre `image|video|voice|3d` (enum textual, sem check constraint — mesmo
  padrão livre já usado em `campanhas_trafego.status`).

## 4. Provedores — decisão sobre ElevenLabs → FishAudio

Instrução explícita do dono do produto: usar **FishAudio** no lugar de ElevenLabs (custo menor,
mesma categoria de produto — TTS realista + clonagem de voz). A interface `AIProviderAdapter` é
agnóstica de provider, então a troca é só no adapter concreto (`FishAudioAdapter` em vez de
`ElevenLabsAdapter`) — nenhuma tela ou lógica de negócio referencia o provider pelo nome.

**Nenhuma chave de API nova está configurada neste ambiente.** Todos os adapters reais (fal.ai/
Replicate pra imagem+vídeo, FishAudio pra voz) são implementados como código real e testável, mas
`MockAdapter` é o único registrado/ativo até as chaves existirem — ver `docs/relatorio-manha.md`
pra lista exata de variáveis de ambiente que faltam.

### 3.1. `ai_models` (Postgres) vs. o catálogo em código do adapter

`MockAdapter.listModels()` devolve um array fixo em código (`MODELOS_MOCK`), testado e usado de
verdade pela rota de geração — é a fonte de verdade EM EXECUÇÃO nesta rodada. A tabela `ai_models`
foi populada com os mesmos 6 modelos (mesmos ids) só pra: (a) satisfazer a FK de
`generation_jobs.model_id`, (b) já deixar pronta a base pra uma futura tela de admin
"ligar/desligar modelo sem deploy" (lendo a tabela em vez do array). Enquanto isso não existir, as
duas fontes precisam ser mantidas em sincronia manualmente se um modelo mudar — documentado aqui
pra não virar uma inconsistência silenciosa.

## 5. Vocabulário — nichos

Reaproveita a mesma modelagem de nicho já usada em `templates.niche`: `restaurante | advocacia |
clinica | geral` (os 3 nichos-alvo do prompt-mestre + fallback genérico).

## 6. Fases desta rodada (ordem real de execução, ver TaskList da sessão)

Fase 0 (este doc) → Fase 1 (ai-providers + MockAdapter) → Fase 2 (migrations) → Fase 3 (Image
Generator completo) → Fase 4 (extrair componentes) → Fase 5 (Video Generator) → Fase 6 (Voice
Generator, FishAudio) → Fase 7 (créditos + templates seed) → Fase 8 (Design: Auto layers) → Fase 9
(3D Scenes, escopo reduzido) → Fase 10 (Spaces: só documentado).

Dado o tamanho real do prompt-mestre (6 módulos completos de produto), esta sessão prioriza
profundidade real nas Fases 1-4 (a fundação + o módulo mais visível pra demo) sobre tentar rasear
todos os 6 módulos — ver `docs/relatorio-manha.md` pro estado real de cada fase ao final.

## 7. Próximo passo pós-sessão (Spaces)

Quando os módulos 1-3 estiverem estáveis em produção: adicionar novos tipos de nó em
`apps/painel/src/components/canvas/` (`nodeIcons.tsx`, `canvasActions.tsx` já têm o padrão de
registro de tipo de nó) que chamam `POST /ai/generate` (mesma rota dos módulos dedicados) em vez de
duplicar a lógica de geração. `CreativeCanvasEditor.tsx` já persiste o grafo em JSON por projeto —
reaproveitar exatamente essa persistência, nunca uma tabela `spaces` paralela.
