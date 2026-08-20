# Auditoria — Upgrade inspirado no Gravyx (Fase 0)

**Gerado em:** 2026-08-19
**Método:** leitura direta do código real no repo, migrations locais comparadas com as aplicadas no Supabase (`list_migrations`), inventário de tabelas via schema real, nenhuma suposição sobre trabalho de rodadas anteriores.

Este documento é só a **Fase 0** (reconciliação obrigatória) do prompt mestre do upgrade Gravyx. Nenhum schema foi alterado, nenhum componente foi criado. Aguardando confirmação antes de iniciar a Fase 1 (modelo de dados).

## 1. Linha de base

| Fato | Valor |
|---|---|
| Migrations locais (`supabase/migrations/*.sql`) | 28 arquivos (0001–0028) |
| Migrations aplicadas no Supabase | 28 — **sem deriva** (paridade 1:1 confirmada via `list_migrations`) |
| Serviços em produção | `vetor-agentes` (service + worker), `vetor-painel`, `vetor-render`, `vetor-landing` |
| Commit ativo (`vetor-agentes`) no momento desta auditoria | `7d347d1` |

## 2. Estado atual por área (o que já existe, código real)

### Design V1
- `supabase/migrations/0021_design_projects.sql`: `design_projects` — canvas versionado (`canvas_json` jsonb, `version` + `parent_design_project_id`, nunca sobrescreve), `source_asset_ids`, `logo_asset_id`, `reference_asset_ids` (**já existe um conceito de "referência" aqui — ver seção 4**), `brand_validation`, `design_brief`.
- `0022_design_critic.sql`: avaliação estruturada da peça (`designCritic.ts`).
- Código: `apps/agentes/src/negocio/{designProjects,designCritic,designLayout,designComposer,designFonts}.ts`; ferramenta do agente `criar_peca_de_design` em `specialistRunner.ts`; editor real em `apps/painel/src/components/design/DesignProjectEditor.tsx` (Fabric.js, camadas reais — texto/CTA/logo nunca rasterizados na composição, confirmado pela convenção `flat_image_legacy` já em uso).
- **Não existe** nenhum grafo de nós, nenhum "flow"/template reutilizável, nenhuma geração em lote real (`DesignCollection` não existe).

### Videomaker V1
- `0023_video_projects.sql`: `video_projects` — timeline versionada (`timeline_json` com tracks/captions/audioMix, ver `apps/painel/src/lib/video/timelineTypes.ts`), `preview_storage_path`/`output_storage_path` (populados de verdade nesta sessão — ver Fase 2 do round anterior).
- `0024_video_pipeline_stages.sql`: enum de 18 estágios do pipeline profissional (`upload` → `final_render`); **hoje só 5 têm código real** (`proxy`, `timeline_draft`, `captions`, `preview`, `final_render`, todos implementados/provados nesta sessão) — os ~13 restantes (`scene_detection`, `editorial_plan`, `cuts_pacing`, `sound_effects_mix`, `music_ducking`, `transitions_effects`, `critique`, `revision`, `approval`, etc.) são schema-only.
- `0025_reference_video_profiles.sql`: **isto já É o `ReferenceStyleProfile` do Gravyx, só que restrito a vídeo e a assets já no Drive** — extrai sinal real (ffmpeg scene-detect + Claude vision sobre frames reais: `pacing`, `cut_density_per_minute`, `hook_structure`, `caption_style`, `color_profile`...), nunca copia o conteúdo, só o perfil. `source_asset_id` é obrigatório e referencia `business_assets` — **não aceita URL externa nem upload solto fora do Drive**.
- `apps/render` (serviço Dockerfile separado, ffmpeg real): proxy, render final, análise de referência.

### BrandKit
- `brand_kits` (migration `0006`/`business_profiles_brand_kits` + `0019_brand_kits_update_policy.sql`): `is_atual` flag, cores/fontes/regras/logo, já consumido por Design e Vídeo via `montarContexto()` em `specialistRunner.ts`. Sem arquivo dedicado — lido direto via `supabase.from("brand_kits")` em `designProjects.ts`, `orchestrator.ts`, `businessContextSnapshot.ts`.

### Drive (business_assets)
- `0018_business_assets_drive.sql` + `0017_business_assets_uploads_trafego.sql`: `business_assets` com categoria/tags/status, `business_asset_usage` pra rastrear onde cada ativo foi usado. Código: `apps/agentes/src/negocio/businessAssets.ts` (`buscarAtivoPorId`, `baixarBytesDoAtivo`, `validarAtivoParaUso`, `registrarUsoDeAtivo`). UI: `apps/painel/src/components/video/MediaLibraryPanel.tsx` + `configuracoes/negocio/banco-de-imagens`.

### Memória operacional
- `0012_memoria_operacional.sql`: `memoria_operacional` (tipo: fato/preferencia/decisao/hipotese/resultado_experimento/feedback/restricao, com `confianca` e `origem`) — trilha ao longo do tempo, distinta do "perfil estático" (`business_profiles`).

### Mission Orchestrator, Tool Registry, Policy Engine
- `missions`/`mission_steps`/`agent_runs`/`approvals` (`0004_missions.sql` + `0010`/`0011`), `apps/agentes/src/missions/{orchestrator,stateMachine,policyEngine}.ts`, fila real via BullMQ (`apps/agentes/src/queue/missionQueue.ts`, worker dedicado). **Achado real desta sessão (corrigido, commit `af6b5c5`)**: reentrega de job pelo BullMQ podia travar uma etapa longa com erro de transição de estado inválida — corrigido antes desta auditoria.
- `agent_runs.custo_estimado_centavos` é calculado de verdade desde a rodada anterior (`agentRunCost.ts`) — mas é só **observabilidade**, não existe reserva/consumo/devolução de crédito.

### ProviderRouter
- `apps/agentes/src/providers/router.ts` (73 linhas): `executarComFallback()` — tenta provedores **na ordem dada**, pula indisponíveis, cai pro próximo só se a chamada real falhar. **Não tem** matriz de seleção por custo/qualidade/latência/modalidade/plano do tenant — é fallback sequencial simples, usado hoje só no TTS.

### Templates, canvas de nós, biblioteca de referências
Busca exaustiva no código (`grep` por `node.?graph`, `creative.?mission`, `design.?flow`, `reference.?librar*`, `reference_collection`) não encontrou nenhuma ocorrência real fora de build artifacts. **Confirmado: nada disso existe hoje.**

### Créditos
Não existe `credit_ledger`, `credit_reservations`, nem qualquer tabela de wallet/saldo. `agent_runs` grava custo real por chamada mas nunca é debitado de um saldo — é só um número histórico.

## 3. Código real que será reutilizado (não recriar)

- **Padrão de versionamento imutável** (`parent_X_id` + `version`, nunca update destrutivo) — já usado em `design_projects`, `video_projects`, `artifacts`. O `creative_mission_graphs` do Gravyx deve seguir o mesmo padrão.
- **Padrão RLS isolado-por-cliente** (`cliente_id = current_cliente_id() or current_papel() = 'admin_vetor'`) — replicar literalmente pras tabelas novas (`reference_library_items`, `design_flows`, etc.), não reinventar.
- **`reference_video_profiles` + `referenceVideoAnalysis.ts`**: a lógica de "extrair perfil abstrato, nunca copiar conteúdo" já existe e está provada em produção — o trabalho da Fase 2/3 do Gravyx é **generalizar** esse padrão pra Design e pra fontes externas (hoje só aceita vídeo já no Drive), não reescrever do zero.
- **`executarEstagioIdempotente` / `video_pipeline_stages`** (`apps/agentes/src/negocio/videoPipeline.ts`): mecanismo de estágio idempotente com `unique(video_project_id, stage)`, retry seguro, erro persistido por estágio — é literalmente o que a Fase 3 do Gravyx (Creative Mission Canvas) precisa pros nodes, só generalizado pra fora de vídeo.
- **`ProviderRouter` atual**: base certa pra evoluir (Fase 7), não substituir — falta só a camada de seleção por critério, o fallback sequencial já funciona e está testado (`router.test.ts`).
- **`design_projects.reference_asset_ids`**: já existe um conceito de "inspirar-se em peças aprovadas do próprio tenant" — a Biblioteca de Referências (Fase 2) precisa coexistir com isso, não duplicar.
- **`DEPARTAMENTOS_EXIGEM_ARTEFATO` + `entregar_documento`** (`specialistRunner.ts`, corrigido nesta sessão): mecanismo real de "nunca completar sem entrega verificável" — o Creative Mission Canvas deve usar o mesmo princípio pra cada node, não inventar um novo.

## 4. Lacunas reais (o que falta de verdade)

1. **Biblioteca de referências multi-fonte** (URL externa, upload do cliente, curada global) — hoje só existe pra vídeo já no Drive. Fase 2 do Gravyx é trabalho novo real.
2. **`design_flows`/templates reutilizáveis** — zero infraestrutura. Fase 4 é trabalho novo real.
3. **Creative Mission Canvas (grafo de nós persistido e versionado)** — zero infraestrutura visual; o "grafo" hoje é implícito (mission_steps sequenciais com `depende_de`), nunca visualizado como nós/edges. Fase 3 é trabalho novo real, mas pode reaproveitar `mission_steps.depende_de` como fonte de verdade das edges em vez de duplicar dependência em outro lugar.
4. **Geração em lote com coerência de campanha** (`DesignCollection`/`VideoCollection`) — zero infraestrutura.
5. **ProviderRouter por custo/qualidade/latência** — só fallback sequencial hoje.
6. **Carteira de créditos** (reserva/consumo/devolução/idempotência) — zero infraestrutura; só custo histórico em `agent_runs`.
7. **13 dos 18 estágios do pipeline de vídeo** ainda são schema-only (ver seção 2) — não é lacuna do Gravyx especificamente, mas é contexto relevante pra Fase 6 (preservar timeline sem quebrar).

## 5. Riscos identificados

- **Confusão entre `reference_video_profiles`/`design_projects.reference_asset_ids` (já existentes) e `reference_library_items` (novo)** — risco real de duplicar conceito. Mitigação: `reference_library_items` deve ser o catálogo/storage (fonte, direitos, tags), e as análises existentes (`reference_video_profiles`) devem passar a apontar pra uma linha de `reference_library_items` em vez de só `business_assets`, quando fizer sentido — sem quebrar o fluxo de vídeo já provado.
- **`mission_steps` como fonte de verdade de execução real** (BullMQ, Policy Engine, aprovação) — o Creative Mission Canvas não pode virar uma segunda fonte de verdade paralela desincronizada. `creative_mission_graphs` deve ser uma **visualização/versão** do que `mission_steps` já executa, nunca substituir o orchestrator real.
- **Scraping de Pinterest/Behance** — proibido pelo próprio prompt mestre; qualquer tentativa de integração oficial precisa ficar atrás de feature flag até termos/API confirmados (nenhuma credencial dessas está configurada hoje).
- **Custo/latência**: um turno adicional de "rascunho" já foi necessário nesta sessão pra forçar entregas de texto reais (ver commit `9548f02`/`7d347d1`) — geração em lote (Fase 5) e ProviderRouter por custo (Fase 7) precisam considerar que mais estrutura tende a exigir mais turnos de LLM, não menos.
- **RLS em tabela global curada** (`reference_library_items` com `tenant_id` nullable pra itens curados) — precisa de policy cuidadosa pra não vazar `tenant_id` de item privado nem permitir escrita cruzada; seguir o padrão já usado em `design_flows.tenant_id nullable` do próprio prompt mestre.

## 6. Plano de execução em fases (conforme ordem exigida pelo prompt mestre)

| Rodada | Escopo | Depende de | Status |
|---|---|---|---|
| A | Esta auditoria + modelo de dados da biblioteca (Fase 1: `reference_library_items`, `reference_collections`, `reference_collection_items`) | — | **Feita** — migration `0029_reference_library.sql` aplicada em produção, `apps/agentes/src/negocio/referenceLibrary.ts` criado, sem advisories novos. |
| B | Biblioteca com upload, URL externa, filtros, coleções (Fase 2, sem scraping) | A | **Feita** — página `/referencias` no painel (server component + client component, mesmo padrão de `configuracoes/negocio/banco-de-imagens`), entrada nova na sidebar. Testada ao vivo em produção: criar referência por URL, criar por arquivo do Drive, criar coleção, adicionar à coleção, filtrar por coleção, arquivar — todos confirmados via reload real da página (não só estado otimista do client). |
| C | `ReferenceStyleProfile` generalizado (hoje só vídeo) + fluxo de inspiração | B, `referenceVideoAnalysis.ts` existente | Próxima rodada — ainda não iniciada. |
| D | Creative Mission Canvas pra Design (Fase 3) — visualização sobre `mission_steps`/`creative_mission_graphs` | C |
| E | `design_flows`/templates + geração em lote (Fases 4/5) | D |
| F | Integração com Videomaker/Planejamento (Fase 6) — preservar timeline/estágios já provados | D, E |
| G | ProviderRouter por critério + créditos (Fase 7) | — (pode rodar em paralelo às demais) |
| H | Testes E2E, segurança, performance, deploy (Fase 8) | todas |

## 7. Arquivos que serão alterados (quando a Fase 1 for aprovada)

- Novo: `supabase/migrations/00XX_reference_library.sql` (`reference_library_items`, `reference_collections`, `reference_collection_items`)
- Novo: `apps/agentes/src/negocio/referenceLibrary.ts`
- Estender (não reescrever): `apps/agentes/src/negocio/referenceVideoAnalysis.ts` (generalizar pra aceitar `reference_library_items` como origem)
- Estender: `apps/painel/src` — nova página de biblioteca (departamento acessível, não substitui o painel principal)
- Sem alteração em: `videoPipeline.ts`, `designProjects.ts`, `orchestrator.ts`, `router.ts` nesta rodada (só leitura/reuso)

## 8. Migrations necessárias (Fase 1, ainda não aplicadas)

Todas com `create table if not exists`, RLS obrigatório, `tenant_id`/`cliente_id` + policy isolada, seguindo literalmente o padrão já usado em `reference_video_profiles`/`design_projects`:

1. `reference_library_items`
2. `reference_collections`
3. `reference_collection_items`

`design_flows`, `creative_mission_graphs`, `credit_ledger`/`credit_reservations` ficam para as Rodadas D/G respectivamente — não fazem parte da Fase 1.

## Conclusão da Fase 0

Nenhum conflito de arquitetura bloqueante encontrado. A base existente (versionamento imutável, RLS isolado, estágio idempotente, ProviderRouter com fallback, `ReferenceStyleProfile` já provado em vídeo) é sólida o suficiente pra estender em vez de reescrever. Recomendo prosseguir pra Rodada A (modelo de dados da biblioteca) mediante confirmação — nenhum schema foi alterado até aqui.
