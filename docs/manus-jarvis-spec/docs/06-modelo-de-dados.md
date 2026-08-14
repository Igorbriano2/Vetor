# VETOR — Modelo de dados

## 1. Princípios

O banco deve ser relacional e todas as tabelas de negócio precisam ter `organization_id`, salvo tabelas globais de configuração. O isolamento deve ocorrer no backend e, se possível, também por políticas de linha. IDs públicos devem ser UUIDs. Datas devem ser armazenadas em UTC e exibidas no fuso configurado pela organização.

O sistema deve preservar histórico em missões, mensagens, artefatos, prompts, aprovações e ações externas. Não sobrescrever resultados importantes; criar versões. Dados brutos de integrações devem ser armazenados com retenção configurável e redigidos quando contiverem segredos ou dados pessoais desnecessários.

## 2. Entidades principais

| Entidade | Campos essenciais | Relações |
|---|---|---|
| `organizations` | id, name, slug, vertical, timezone, plan_id, settings | possui usuários, missões, integrações e conhecimento |
| `users` | id, name, email, avatar, locale | participa de organizações |
| `memberships` | organization_id, user_id, role, status | autorização por organização |
| `business_profiles` | organization_id, description, offers, audience, tone, restrictions | contexto do negócio |
| `brand_kits` | organization_id, version, colors, fonts, logo_refs, rules | versões de marca |
| `missions` | organization_id, title, objective, status, priority, budget, due_at, created_by | possui etapas, eventos, aprovações e artefatos |
| `mission_steps` | mission_id, agent_type, task, status, depends_on, risk_level | execução do plano |
| `agent_runs` | mission_step_id, agent, model, prompt_version, tokens, cost, result | histórico de execução |
| `conversations` | organization_id, channel, external_thread_id, contact_ref | mensagens de entrada e saída |
| `messages` | conversation_id, direction, content, audio_ref, transcription, confidence, status | pode gerar missão |
| `approvals` | mission_id, step_id, action, payload, risk, status, decided_by | governança |
| `artifacts` | mission_id, type, title, storage_ref, version, status, metadata | entregas e arquivos |
| `insights` | organization_id, source, metric, diagnosis, confidence, status | analytics e recomendações |
| `integrations` | organization_id, provider, status, scopes, encrypted_credentials | conexões externas |
| `integration_events` | integration_id, external_event_id, type, payload_ref, processed_at | idempotência e auditoria |
| `knowledge_items` | organization_id, type, title, content_ref, source, visibility, embedding_ref | base de conhecimento |
| `usage_records` | organization_id, mission_id, operation, units, estimated_cost, occurred_at | consumo e cobrança |
| `audit_logs` | organization_id, actor_type, actor_id, action, entity, entity_id, metadata | trilha de auditoria |
| `notifications` | organization_id, user_id, type, title, body, read_at | alertas e aprovações |

## 3. Estados

`mission_steps.status` deve aceitar `pending`, `ready`, `running`, `awaiting_approval`, `completed`, `blocked`, `failed`, `skipped` e `cancelled`. `artifacts.status` deve aceitar `draft`, `in_review`, `approved`, `published`, `rejected`, `archived`. `approvals.status` deve aceitar `pending`, `approved`, `rejected`, `edited`, `expired` e `cancelled`.

## 4. Índices e consistência

Criar índices compostos por `organization_id` e campos de consulta frequente, como `missions(organization_id, status, created_at)`, `notifications(organization_id, user_id, read_at)`, `integration_events(integration_id, external_event_id)` e `usage_records(organization_id, occurred_at)`. Usar constraints para evitar dois eventos externos iguais, duas aprovações ativas para a mesma ação e referências a organizações diferentes.

## 5. Retenção e privacidade

Configurações de retenção devem distinguir logs operacionais, conteúdo de cliente, áudio original, transcrições, payloads externos e dados de cobrança. O usuário deve conseguir solicitar exportação e exclusão conforme a política aplicável. Áudio deve ser removido quando não for mais necessário, mantendo a transcrição apenas quando houver finalidade autorizada.
