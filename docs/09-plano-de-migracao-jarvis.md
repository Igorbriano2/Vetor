# 09 — Plano de migração para a visão "JARVIS" (Manus) → agente Vetor

> Decisão do dono do negócio (2026-08-14): adotar `docs/manus-jarvis-spec/` como norte do produto e
> migrar o sistema já existente (docs 00-08) aos poucos, por fatias — sem quebrar o que está no ar.
> Este documento traduz o roadmap de 8 fases do Manus (`docs/manus-jarvis-spec/docs/08-roadmap-e-criterios.md`)
> em tarefas concretas contra o repositório real, e registra o que já foi feito em cada rodada.
>
> **Nota de nomenclatura (2026-08-14):** o agente geral **nunca se chama "JARVIS" no produto** —
> esse é o nome do assistente fictício do personagem Tony Stark (Marvel), e usar seria risco de
> marca/personagem. O nome no produto é **Vetor** (o mesmo nome da empresa — de propósito, reforça
> a marca). "JARVIS" só aparece neste documento e em `docs/manus-jarvis-spec/` como referência à
> *arquitetura* proposta pelo Manus (cockpit, missões, governança), nunca como algo dito ao
> cliente final.

## Como ler este documento

Cada fase abaixo cita a fase equivalente do roadmap do Manus, o que já existe no repo que serve de
base, o que falta, e o status. Trabalhar nas fases fora de ordem só quando a base técnica permitir
sem retrabalho.

## Fase 0 — Fundação

*Equivalente Manus: Fase 0 ("Repositório, autenticação, organização, banco, design tokens, logging e CI").*

| Item | Status |
|---|---|
| Repositório, monorepo, CI implícito (build/test) | ✅ já existe (Fases 0-1 do doc06 original) |
| Autenticação e "organização" (aqui: `clientes` + `usuarios`) | ✅ já existe, RLS multi-tenant |
| Banco relacional com isolamento por tenant | ✅ já existe (Supabase/Postgres) |
| Design tokens na direção do ADR-001 (grafite/ciano/âmbar/coral) | ✅ tokens migrados (CTAs de decisão em âmbar); seções claras (`areia`) ainda não |
| Schema de missões (`missions`, `mission_steps`, `agent_runs`, `approvals`) | ✅ criado, aditivo (RLS aplicado, sem alterar `demandas`/`entregas`) |
| Logging estruturado / observabilidade dedicada | ⏳ pendente — hoje só existe `log_agentes`, mais simples que o `agent_runs` da spec |

## Fase 1 — Primeiro contato

*Equivalente Manus: Fase 1 ("Onboarding, perfil do negócio, CommandBar, IntentCard e missão manual").*

| Item | Status |
|---|---|
| Onboarding / perfil do negócio (`business_profiles`, `brand_kits`) | ⏳ pendente — hoje `clientes.manual_marca` é um jsonb solto, sem versão |
| `CommandBar` (entrada multimodal texto/áudio) | ⏳ pendente no painel — hoje a entrada é só via WhatsApp, não dentro do produto web |
| `IntentCard` (transcrição, entendimento, campos inferidos) | ⏳ pendente |
| Criar missão manualmente a partir de um comando | ⏳ pendente — depende do schema de missões (Fase 0) estar pronto |

## Fase 2 — Vetor (agente geral) funcional

*Equivalente Manus: Fase 2 ("Orquestrador, agente geral, fila, eventos, timeline e aprovações").*

| Item | Status |
|---|---|
| Prompt oficial do agente geral (Vetor) | ✅ adota o conteúdo de `system-jarvis.md` do Manus, renomeado — ver nota de nomenclatura acima |
| Mission Orchestrator (cria/avança missões, valida transições de estado) | ⏳ pendente |
| Fila de jobs (hoje não existe — precisa de Redis ou equivalente) | ⏳ pendente, decisão técnica em aberto |
| Policy Engine (classificação de risco por ferramenta, aprovação) | ⏳ pendente — hoje só existe a regra fixa "Tráfego não aumenta orçamento sozinho" |
| `MissionTimeline` no painel | ⏳ pendente |

## Fase 3 em diante

Entregas versionadas, voz/WhatsApp com transcrição real, analytics, integrações de ação (Meta/Google)
— ver `docs/manus-jarvis-spec/docs/08-roadmap-e-criterios.md` para os critérios completos de cada
fase. Ainda não iniciadas; nossa base de WhatsApp+áudio (docs/07) já cobre parte do que a Fase 4 do
Manus pede, adaptar em vez de recomeçar.

## O que muda de nome/lugar em relação aos docs 00-08 originais

| Conceito antigo (docs 00-08) | Conceito novo (spec Manus) | Decisão |
|---|---|---|
| Agente Geral | Vetor (agente geral/orquestrador) | Mesmo agente, prompt substituído pelo `system-jarvis.md` do Manus (mais rigoroso: schemas estruturados, separação fato/inferência/recomendação), mas com nome trocado de "JARVIS" para "Vetor" |
| `demandas` | `missions` + `mission_steps` | `missions` é aditivo por enquanto — `demandas` continua em uso pelo Agente Secretário até o orquestrador (Fase 2) existir de verdade |
| Plano cota + excedente (docs 05/07) | Assinatura em faixas + créditos (`docs/manus-jarvis-spec/docs/09-planos-e-economia.md`) | Ainda **não decidido** — os dois modelos coexistem em documentação até revisão de precificação dedicada |
| Paleta petróleo/menta/areia (doc 01) | Grafite/ciano/âmbar/coral (ADR-001) | Migrando nesta rodada nos tokens CSS; ainda falta reaplicar em componente por componente |

## Regra de trabalho para as próximas rodadas

Seguir a ordem de implementação do próprio Manus
(`docs/manus-jarvis-spec/docs/00-instrucoes-claude-code.md`): tipos e contratos primeiro, depois
backend e autorização, depois estados visuais, só então integrar componentes de UI ao estado real.
Nunca migrar uma fatia sem deixar o sistema em estado deployável — o dono do negócio está
publicando o que existe na DigitalOcean em paralelo (docs/08-deploy-digitalocean.md).
