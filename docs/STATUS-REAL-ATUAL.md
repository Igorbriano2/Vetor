# Status real do VETOR — inventário reconciliado

**Gerado em:** 2026-08-19
**Método:** código real no repo, migrations comparadas com as REALMENTE aplicadas no Supabase, testes rodados de verdade (`npx vitest run`), commit ativo em cada serviço DigitalOcean comparado com o HEAD do repo, dados reais consultados via SQL (não a existência vazia das tabelas), e evidência de produção coletada ao vivo nesta sessão sempre que possível.

Documentos de status anteriores a este (se existirem em `docs/`) devem ser tratados como **históricos, não como prova de estado atual** — nenhum deles foi usado como fonte de verdade aqui.

## Linha de base (fatos objetivos, não interpretação)

| Fato | Valor |
|---|---|
| HEAD local = origin/main | `63ad57f` |
| Commit ativo em produção — `vetor-agentes` (service + worker) | `63ad57f` (ACTIVE) |
| Commit ativo em produção — `vetor-painel` | `63ad57f` (ACTIVE) |
| Commit ativo em produção — `vetor-landing` | `63ad57f` (ACTIVE) |
| Commit ativo em produção — `vetor-render` | `63ad57f` (ACTIVE, `/health` 200) |
| **Deriva entre repo e produção** | **Nenhuma** — os 4 serviços rodam exatamente o commit do HEAD |
| Migrations locais (`supabase/migrations/*.sql`) | 25 arquivos (0001–0025) |
| Migrations aplicadas no Supabase (`list_migrations`) | 27 — 2 a mais que os arquivos locais (`restrict_helper_functions` e `oauth_states_deny_client_access`), aplicadas direto sem arquivo `.sql` correspondente no repo. **Achado de deriva real**: ver "Observações" no fim. |
| Testes automatizados | `apps/agentes`: 216/216 · `apps/painel`: 46/46 · zero falhas, zero skip |
| RLS / segurança (Supabase advisors) | 2 avisos menores (funções `SECURITY DEFINER` intencionais `current_cliente_id`/`current_papel`; leaked-password-protection desligada) — nada crítico |
| Cliente de prova usado nesta auditoria | "Vetor (conta de teste)" / negócio real Dog King Cambé, `cliente_id 15dfc324-c0ad-4fec-977f-33c6ea3c3624` |

## Tabela de status

| # | Item | Status | Commit(s) | Migration | Testes | Produção | Bloqueio | Próximo passo |
|---|---|---|---|---|---|---|---|---|
| 1 | Landing e domínios | `DONE_PROVED_IN_PRODUCTION` | `eec472d` | — | sem teste automatizado; smoke test manual documentado | `vetormkt.online`→landing, `painel.vetormkt.online`→painel, CTAs corrigidos, TLS ok, `/login` raiz 404 esperado | nenhum | escrever teste de rota pros CTAs (gap, não bug) |
| 2 | Painel e autenticação | `DONE_PROVED_IN_PRODUCTION` | `eec472d` (next=/open-redirect) + base anterior | — | sem teste automatizado do middleware; validado via curl real nesta sessão (401 JSON em API sem sessão, 307+next= preservado, open-redirect bloqueado) | login real testado ao vivo (brianoigor@gmail.com), sessão persistida | nenhum | teste automatizado do middleware; não há cadastro/recuperação de senha self-serve — decisão de produto, não bug |
| 3 | Agente Vetor (fluxo de comando) | `DONE_PROVED_IN_PRODUCTION` | `9c37a0f` base + `2f56007`, `1c66886`, `6ff6103` | `0004_missions.sql`, `0005_mensagens_plataforma.sql` | sem teste unitário de `vetorPlataforma.ts` | fluxo completo (texto→IntentCard→aprovação→mission→worker→artefato) exercitado 2x ao vivo nesta sessão; 32 `missions` reais no banco (19 completed) | nenhum | teste automatizado de `vetorPlataforma.ts` |
| 4 | Secretário e WhatsApp | `PARTIAL` | `788e02d` base, `2db18f4` voz | `0003_whatsapp.sql` | `whatsapp.test.ts` só cobre parsing de payload, não integração real | `WHATSAPP_MODE=sandbox`; `mensagens_whatsapp`: 0 linhas — nunca recebeu tráfego real | nenhum técnico — credenciais reais já configuradas, é escolha de modo | trocar pra `WHATSAPP_MODE=production` e mandar 1 mensagem real de teste |
| 5 | Mission Orchestrator, Redis e worker | `DONE_PROVED_IN_PRODUCTION` | `9c27c9f` base → `b9aea2b` | `0004_missions.sql`, `0010_missions_auditoria.sql`, `0011_risco_critical.sql` | `orchestrator.hash.test.ts`, `policyEngine.test.ts`, `stateMachine.test.ts` passam | `REDIS_URL` real nos 2 components do app; 32 missions reais, 68 `mission_steps` reais | nenhum | — |
| 6 | Memória operacional | `DONE_PROVED_IN_PRODUCTION` | inclui gravação em `specialistRunner.ts:1546`, leitura em `vetorPlataforma.ts:217` | `0012_memoria_operacional.sql` | sem teste unitário dedicado | **47 linhas reais** gravadas em produção | nenhum | teste unitário do read/write |
| 7a | Design V1 | `DONE_PROVED_IN_PRODUCTION` | `f62c2cd` (base: camadas reais) + `0683b88`/`8d4aa74` (fix deploy sharp) + `63ad57f` (fix 3 bugs + fontes de marca + BrandKit) | `0021_design_projects.sql`, `0022_design_critic.sql` | 216/216 (`apps/agentes`), inclui `designComposer`/`designCritic`/`designLayout`/`designFonts`/`designProjects` | 2 peças reais geradas ao vivo pro Dog King Cambé nesta sessão; headline/subheadline/CTA/logo confirmados como camadas Fabric reais e editáveis via inspeção direta do `canvas_json` no Postgres; fontes de marca (Passion One/Rubik) renderizando idênticas no servidor e no navegador | nenhum | fechado |
| 7b | Design V2 | `NOT_STARTED` | — | — | — | zero ocorrência de `ArtDirectionSpec`/`DesignCollection`/score no código | `BLOCKED_PRODUCT_DECISION` até agora — prompt mestre já autoriza começar | implementar `ArtDirectionSpec` primeiro, testar com Dog King + 1 empresa de serviço profissional |
| 8 | Videomaker V1 (base) | `PARTIAL` | `aa7119c` (pipeline), `d2e91b6` (referência) | `0023_video_projects.sql`, `0024_video_pipeline_stages.sql`, `0025_reference_video_profiles.sql` | 25/25 (`videoProjects`, `referenceVideoAnalysis`, `renderService`, `higgsfield`) | ver detalhamento abaixo — RLS confirmado ativo nas 3 tabelas | nenhum técnico | ver lista de sub-itens abaixo |
| 9a | Wake word customizado ("vetor") | `NOT_STARTED` | `1c66886`/`4e0f3b3` (infra em volta) | — | falha real reproduzida nesta sessão ("Modelo(s) ausente(s)") | `public/wake-word/` não tem nenhum `.onnx` | nenhum modelo foi treinado ainda | treinar/obter os 3 modelos ONNX (`docs/voice/wake-word-training.md`) |
| 9b | STT / TTS | `PARTIAL` | — | `0020_voice_wake_word_origem.sql` | `transcricao.test.ts`/`tts.test.ts` passam com provider mockado | `STT_PROVIDER=openai`, `TTS_PROVIDER=fish` (fallback `onyx`) — credenciais reais presentes, **zero evidência de uso real em produção** | nenhum de credencial — é falta de prova, não bloqueio | rodar 1 smoke test real de voz→texto→resposta e persistir o log |
| 10a | Onboarding | `DONE_PROVED_IN_PRODUCTION` | `8629077`, `2da7c0d`, `5ba4e87` | `0013_onboarding_brandkit_connections.sql` | sem teste dedicado | cliente de teste real com `onboarding_etapa_atual="revisao"`, público/objetivos preenchidos de verdade (não seed manual) | nenhum | — |
| 10b | Drive de assets | `DONE_PROVED_IN_PRODUCTION` | `5ba4e87` | `0018_business_assets_drive.sql` | `businessAssets.test.ts` passa | 5 linhas reais; usado ao vivo nesta sessão pra subir a logo do brandbook Dog King | nenhum | — |
| 10c | BrandKit | `DONE_PROVED_IN_PRODUCTION` | `8629077`, `0019_brand_kits_update_policy.sql` | `0013`, `0019` | — | 1 linha `is_atual=true` completa (cores/fontes/logo reais, populada nesta sessão) | nenhum | — |
| 11 | Planejamento e Entregas | `PARTIAL` | `5ba4e87`, `f314397`, `03c0a81` | nenhuma dedicada (usa `artifacts`/`missions`/`entregas`) | — | páginas reais, estado vazio honesto; `artifacts` type=plan: 0 linhas (fluxo nunca gerou um plano real ainda); `entregas` legado: 2 linhas reais | nenhum — é uso, não bug | gerar 1 planejamento mensal real via chat pra provar ponta a ponta |
| 12 | Tráfego e conexões Meta | `BLOCKED_CREDENTIAL` | `8629077`, `5ba4e87`, `5cda2b1` | `0014_oauth_states_facebook_provider.sql`, `0016`, `0017` | `providers.test.ts` + `metaAdsSync.test.ts` (5/5) | código completo e testado; `connections`: 0 linhas, `campanhas_trafego`: 0 linhas — nunca houve conexão real | precisa de app Meta aprovado pelo Facebook + token real de conta de anúncios | aprovar app Meta e testar 1 conexão real |
| 13 | ProviderRouter | `PARTIAL` | `758cf22` | — | `router.test.ts` passa | usado hoje só no TTS (fallback fish→openai, confirmado em teste real) | nenhum técnico | roteamento por custo/quota/saúde/latência de verdade é feature nova, não existe ainda |
| 14 | Skills externas | `PARTIAL` | `5cda2b1` (34 skills) | n/a | `skills.integration.test.ts`, `registry.test.ts`, `loader.test.ts`, `permissions.test.ts` passam | 34 skills reais com manifest real (permissões/proveniência) | nenhum técnico | schema de manifest não tem `custo`/`timeout`/`idempotencyKey` — feature nova |
| 15 | Observabilidade, custos, retries, auditoria | `PARTIAL` | — | `0004_missions.sql` (agent_runs), `0010_missions_auditoria.sql` | sem teste dedicado | `agent_runs`: 55 linhas reais, colunas de custo existem mas `custo_estimado_centavos` está **sempre NULL** | nenhum técnico | popular o cálculo de custo por chamada (barato de fechar) |
| 16 | Mobile | `NOT_STARTED` | — | — | — | nada no monorepo (`apps/mobile`, Expo, React Native, Capacitor — zero ocorrência) | nenhuma decisão de produto ainda | — |

### Detalhamento — Videomaker V1 (item 8, sub-itens pedidos no prompt mestre)

| Sub-item | Status | Evidência |
|---|---|---|
| Upload real + asset em storage | `DONE_PROVED_IN_PRODUCTION` | 1 projeto real com `proxy_storage_path` populado, `duration_ms=35067` |
| `editar_video_timeline` (mission→tool) | `DONE_PROVED_IN_PRODUCTION` | stage `timeline_draft` completed, `attempts=1` |
| `video_project` com timeline | `DONE_PROVED_IN_PRODUCTION` | 5 linhas reais na tabela, `timeline_json` real |
| Proxy real | `DONE_PROVED_IN_PRODUCTION` | stage `proxy` completed |
| Editor abrindo clip real | `DONE_PROVED_IN_PRODUCTION` | `VideoProjectEditor.tsx` lê/escreve `video_projects` direto |
| Captions estruturadas e editáveis | `PARTIAL` | schema (`CaptionTrack`/`CaptionCue`) e UI (`CaptionsAndAudioPanel.tsx`) prontos; stage `captions` **nunca rodou** (0 linhas) |
| Cortes persistidos | `DONE_PROVED_IN_PRODUCTION` | `timeline_json` real tem clip com `trimIn`/`trimOut` reais |
| Preview e render final do mesmo projeto | `NOT_STARTED` na prática | colunas `preview_storage_path`/`output_storage_path` existem, **0 de 5** projetos têm qualquer uma populada — nunca renderizado de verdade |
| Tracks separadas | `PARTIAL` | `TrackKind` suporta 6 tipos no schema, mas `montarTimelineInicial()` só cria 1 track de vídeo hoje |
| Versionamento e undo/redo | `PARTIAL` | versionamento **provado real** (`timeline_version`/`parent_video_project_id`, 2 linhas); undo/redo existe no código mas sem teste/evidência de uso |
| Retry seguro | `PARTIAL` | mecanismo real (`executarEstagioIdempotente`, `unique(video_project_id,stage)`), mas nunca exercitado através de uma falha de verdade |
| RLS | `DONE_PROVED_IN_PRODUCTION` | `rowsecurity=true` confirmado nas 3 tabelas |
| Logs de render persistidos | `NOT_STARTED` | nenhuma tabela/coluna de log de render existe |

**Achado extra relevante pra Fase 4:** `ReferenceVideoProfile` já está implementado e provado em produção (commit `d2e91b6`, 2 análises reais via Claude vision sobre frames reais) — não é trabalho pendente, é base pronta. A migration `0024` já define os 18 estágios do pipeline profissional completo, mas o código hoje só executa 2 deles (`proxy`, `timeline_draft`) + a análise de referência separada — os outros ~15 são schema-only. Isso é literalmente o escopo da Fase 4 do prompt mestre: a fundação existe, a implementação de cada estágio não.

## Observações de reconciliação (deriva real encontrada)

1. **2 migrations aplicadas em produção sem arquivo `.sql` correspondente no repo**: `restrict_helper_functions` (logo após `init_schema`) e `oauth_states_deny_client_access` (entre `onboarding_brandkit_connections` e `oauth_states_facebook_provider`). Ambas parecem ser hardening de segurança de curto alcance aplicado direto via MCP em sessão anterior. Não são destrutivas nem contradizem o schema atual, mas quebram a regra de "todo schema vem de um arquivo versionado". Recomendo, numa tarefa futura pequena, extrair o DDL real dessas duas via `pg_dump`/introspection e commitar os arquivos `.sql` retroativos — não fazer isso agora (é higiene, não bloqueio).
2. **`custo_estimado_centavos` em `agent_runs` existe desde a migration `0004` mas nunca foi preenchido** — é o gap de observabilidade mais barato de fechar (item 15).
3. Achado fora da lista de 16 itens, mas real e relevante: existe integração **Asaas** (gateway de pagamento brasileiro) configurada em `ASAAS_ENV=sandbox` com credenciais reais, rota `apps/agentes/src/routes/asaas.ts` montada — parece ser a base de billing/assinatura pra Fase 5, ainda não auditada em profundidade.
4. Existe um 4º serviço de produção não listado explicitamente no prompt mestre: **`vetor-render`** (app DigitalOcean separado, `RENDER_SERVICE_URL` usado pelo Videomaker), ACTIVE no mesmo commit `63ad57f`, `/health` respondendo 200.

## Tarefas ordenadas por prioridade

### Podem ser executadas imediatamente (sem credencial faltando)

1. Popular `custo_estimado_centavos` em `agent_runs` (observabilidade, item 15) — barato, sem dependência.
2. Rodar 1 vídeo real até o stage `captions` e até `final_render` (item 8) — prova o que já está construído e destrava a Fase 4 com uma base validada.
3. Escrever testes automatizados que faltam: `vetorPlataforma.ts`, middleware do painel (`safeRedirect`), read/write de memória operacional, editor de vídeo.
4. Gerar 1 planejamento mensal real via chat (item 11) pra confirmar o fluxo ponta a ponta com dado persistido.
5. Extrair e commitar os `.sql` retroativos das 2 migrations órfãs (observação 1).
6. Trocar `WHATSAPP_MODE` pra `production` e mandar 1 mensagem real de teste (item 4) — não depende de credencial nova, as credenciais já estão configuradas.
7. Rodar 1 smoke test real de voz (STT→TTS) e persistir o log (item 9b) — credenciais já configuradas.
8. Começar Design V2 (item 7b) pelo `ArtDirectionSpec`, testando com Dog King + uma empresa de serviço profissional, conforme o prompt mestre já autorizou.

### Bloqueadas por credencial ou decisão externa

- **Tráfego e conexões Meta (item 12)** — `BLOCKED_CREDENTIAL`: precisa de app Meta aprovado pelo Facebook + token real de uma conta de anúncios de cliente. Nenhum código a mais resolve isso.
- **Wake word customizado (item 9a)** — bloqueado por não ter os modelos ONNX treinados; não é falta de credencial de API, é um artefato de ML que precisa ser gerado/obtido separadamente.
- **Mobile (item 16)** — `NOT_STARTED` por falta de decisão de produto (nem escopo foi definido ainda), não por bloqueio técnico.

Nenhum item está bloqueado por falta de crédito/saldo na conta Anthropic — a sessão inteira rodou dezenas de chamadas reais (missões, DesignCritic, análise de vídeo de referência) sem falha de billing.
