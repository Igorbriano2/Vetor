# VETOR — Arquitetura técnica

## 1. Direção de implementação

O VETOR deve ser construído como uma aplicação web multi-tenant com frontend responsivo, backend orientado a módulos, banco relacional, armazenamento de arquivos, fila de jobs, camada de eventos e adaptadores de integração. O desenho deve permitir começar pequeno e evoluir para execução assíncrona e múltiplos clientes sem reescrever o núcleo.

A arquitetura recomendada é uma aplicação TypeScript com frontend React, backend Node.js, API tipada, PostgreSQL, armazenamento compatível com S3, Redis para filas e cache, e um worker separado para missões. O provedor de modelo deve ser abstraído por uma interface `LLMProvider`, para evitar acoplamento de prompts e chamadas ao fornecedor.

## 2. Componentes

| Componente | Responsabilidade |
|---|---|
| Web App | Cockpit, comando multimodal, missões, aprovações, entregas, insights e administração. |
| API | Autenticação, autorização, CRUD, streaming de eventos e comandos do cliente. |
| Mission Orchestrator | Cria e avança missões, valida estados e coordena agentes. |
| Agent Runtime | Executa agentes com contexto limitado, ferramentas permitidas e saída estruturada. |
| Policy Engine | Avalia risco, permissões, orçamento, consentimento e necessidade de aprovação. |
| Job Queue | Executa transcrição, geração, análise, sincronização e tarefas longas sem bloquear HTTP. |
| Event Bus | Publica eventos de missão, agente, integração, aprovação e auditoria. |
| Knowledge Layer | Armazena perfil do negócio, brand kit, documentos, aprendizados e referências. |
| Analytics Layer | Normaliza métricas, calcula indicadores e cria insights versionados. |
| Integration Adapters | WhatsApp, Meta Ads, Google Ads, Instagram, e-mail, calendário e analytics. |
| Observability | Logs estruturados, métricas, tracing, custo por execução e alertas. |

## 3. Regras de execução de agentes

Agentes não devem receber acesso irrestrito ao banco, rede ou credenciais. Cada agente deve receber um `AgentContext` com `organizationId`, `missionId`, usuário solicitante, objetivo, dados relevantes, ferramentas permitidas, limites e versão do prompt. Toda chamada a uma ferramenta deve passar por autorização e ser registrada.

A saída de cada agente deve ser JSON validado por schema. Texto livre pode existir como campo de explicação, mas o orquestrador deve depender de estados e campos estruturados. Se a saída for inválida, o runtime deve tentar uma correção limitada e, depois, marcar a etapa como falha recuperável.

## 4. Ciclo de missão

Uma missão passa pelos estados `draft`, `understanding`, `awaiting_clarification`, `planned`, `awaiting_approval`, `queued`, `running`, `blocked`, `completed`, `failed`, `cancelled` e `archived`. As transições devem ser validadas no servidor. A interface não pode alterar o status diretamente.

O fluxo é: receber comando; normalizar entrada; detectar intenção; buscar contexto; gerar plano; calcular risco; solicitar esclarecimento ou aprovação; enfileirar etapas; executar especialistas; validar artefatos; registrar evidências; produzir resumo; atualizar aprendizados; concluir missão.

## 5. Governança e níveis de autonomia

Cada ferramenta deve possuir uma classificação de risco. Operações de leitura e criação de rascunho são de baixo risco. Publicação, envio de mensagem externa, alteração de orçamento, criação de audiência, alteração de identidade visual oficial, exclusão e uso de dados sensíveis são de médio ou alto risco.

| Nível | Exemplo | Comportamento padrão |
|---|---|---|
| Baixo | Diagnóstico, copy em rascunho, relatório | Execução automática com registro |
| Médio | Agendar post, atualizar público, enviar mensagem segmentada | Aprovação conforme política do cliente |
| Alto | Publicar anúncio, gastar mídia, excluir campanha, usar dado sensível | Aprovação explícita e limites obrigatórios |
| Proibido | Bypass de política, fraude, spam, discriminação ou ação sem consentimento | Bloqueio e explicação |

A aprovação deve apresentar ação, canal, conta afetada, orçamento, duração, criativo, copy, público, previsão, risco, reversibilidade e alterações em relação à versão anterior. O usuário deve poder aprovar, rejeitar, editar, pedir nova versão ou transferir para revisão humana.

## 6. Integrações

A integração com WhatsApp deve usar um adaptador baseado em webhook e API oficial. Eventos de mensagens recebidas e status de entrega devem ser idempotentes. O número do cliente deve ser associado a uma organização por configuração explícita, e mensagens recebidas devem criar ou atualizar uma conversa antes de gerar qualquer missão.

A integração com Meta Ads deve começar com leitura de contas, campanhas, conjuntos, anúncios, métricas e estado. A criação e publicação de ativos deve ser isolada por feature flag e governança. O sistema deve manter `externalId`, versão da API, timestamp de sincronização, payload normalizado e referência ao payload bruto.

Cada integração deve possuir um contrato comum: `connect`, `disconnect`, `healthCheck`, `receiveEvent`, `sync`, `executeAction`, `refreshCredentials` e `redact`. Falhas externas devem gerar retry com backoff, limite de tentativas, dead-letter queue e mensagem compreensível para o usuário.

## 7. Segurança

Todas as entidades de negócio devem conter `organizationId` e ser filtradas por autorização no servidor. Papéis mínimos: proprietário, administrador, operador, aprovador, analista e somente leitura. Tokens de integração devem ser criptografados em repouso e nunca aparecer em logs ou prompts.

O sistema deve ter proteção contra prompt injection em arquivos, mensagens e páginas externas; limites de tamanho e tipo de arquivo; sanitização de conteúdo; rate limiting; verificação de assinatura de webhooks; idempotency keys; trilha de auditoria; expiração de sessões; exclusão e exportação de dados; e políticas de retenção configuráveis.

## 8. Observabilidade

Cada missão deve possuir `traceId`. Cada execução deve registrar agente, modelo, promptVersion, início, fim, tokens de entrada e saída quando disponíveis, custo estimado, ferramentas chamadas, resultado, erro, retry e usuário relacionado. O dashboard interno deve mostrar taxa de sucesso, latência, falhas de integração, custo por missão e volume por organização.

## 9. Estratégia de implantação

O primeiro lançamento pode usar um único repositório modular, um serviço web e um worker. A fila deve estar presente desde o início para transcrição, geração e sincronização. O sistema deve ser projetado para separar o worker em serviço independente quando a carga aumentar. Jobs demorados não devem depender de uma requisição HTTP aberta.

O Claude Code deve criar `.env.example`, migrations versionadas, seeds de desenvolvimento, scripts de teste, documentação de setup, logs estruturados e um comando único para iniciar web, API, worker e banco local.
