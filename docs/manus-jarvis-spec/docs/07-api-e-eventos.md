# VETOR — API, eventos e webhooks

## 1. Convenções

A API deve usar JSON, versionamento em `/api/v1`, autenticação por sessão ou token de curta duração e autorização por organização em todas as rotas. Respostas de erro devem conter `code`, `message`, `details` e `requestId`. Operações que criam missão, enviam mensagem, executam ferramenta ou processam webhook devem aceitar `Idempotency-Key`.

## 2. Rotas principais

| Método e rota | Finalidade |
|---|---|
| `GET /api/v1/me` | Usuário atual, organizações e permissões. |
| `POST /api/v1/organizations` | Criar organização e iniciar onboarding. |
| `GET/PATCH /api/v1/business-profile` | Ler ou atualizar contexto do negócio. |
| `POST /api/v1/commands` | Criar comando de texto ou referência de áudio. |
| `POST /api/v1/audio/upload` | Receber áudio com validação de tipo e tamanho. |
| `POST /api/v1/missions` | Criar missão a partir de intenção confirmada. |
| `GET /api/v1/missions` | Listar missões com filtros e paginação. |
| `GET /api/v1/missions/:id` | Detalhe, timeline, etapas, artefatos e aprovações. |
| `POST /api/v1/missions/:id/cancel` | Solicitar cancelamento seguro. |
| `POST /api/v1/approvals/:id/approve` | Aprovar ação proposta. |
| `POST /api/v1/approvals/:id/reject` | Rejeitar com motivo. |
| `POST /api/v1/approvals/:id/request-change` | Solicitar nova versão ou ajuste. |
| `GET /api/v1/artifacts` | Biblioteca de entregas. |
| `GET /api/v1/insights` | Insights e recomendações. |
| `GET /api/v1/usage` | Consumo, limites e estimativas. |
| `POST /api/v1/integrations/:provider/connect` | Iniciar conexão externa. |
| `POST /api/v1/integrations/:provider/sync` | Solicitar sincronização. |
| `POST /api/v1/webhooks/:provider` | Receber evento externo validado. |
| `GET /api/v1/events` | Stream SSE de eventos da organização. |

## 3. Eventos internos

Os eventos devem ser imutáveis e conter `eventId`, `type`, `occurredAt`, `organizationId`, `actor`, `correlationId`, `payloadVersion` e `payload`. Tipos mínimos: `command.received`, `command.transcribed`, `mission.created`, `mission.planned`, `mission.approval_required`, `mission.started`, `agent.started`, `agent.completed`, `agent.failed`, `artifact.created`, `approval.decided`, `integration.connected`, `integration.event_received`, `insight.created`, `usage.recorded` e `notification.created`.

## 4. Webhooks

Cada webhook deve validar assinatura, rejeitar payload malformado, registrar o evento bruto em armazenamento seguro, criar uma chave de deduplicação e responder rapidamente com sucesso antes de processar tarefas longas. O processamento deve ocorrer na fila. Eventos duplicados devem retornar sucesso sem executar a ação novamente.

No caso do WhatsApp, o webhook deve separar verificação inicial, mensagem recebida, status de entrega, erro e evento não suportado. Mensagens recebidas devem ser normalizadas em `messages`, vinculadas a `conversations` e então encaminhadas ao secretário. Nenhuma resposta externa deve ser enviada sem passar pelo limite de sessão, consentimento, política de mensagem e controle anti-spam.

## 5. Streaming

O cockpit deve receber atualizações por SSE no MVP, com canal filtrado por organização e autorização do usuário. Eventos de progresso não devem expor prompts completos, tokens, credenciais ou dados de outra organização. O frontend deve reconectar com backoff e buscar o estado atual quando perder eventos.

## 6. Jobs

Jobs mínimos: `transcribe-audio`, `understand-command`, `plan-mission`, `run-agent-step`, `validate-artifact`, `sync-integration`, `process-webhook`, `generate-report`, `send-notification` e `record-usage`. Cada job deve ter timeout, número máximo de tentativas, backoff, dead-letter queue e chave de idempotência.
