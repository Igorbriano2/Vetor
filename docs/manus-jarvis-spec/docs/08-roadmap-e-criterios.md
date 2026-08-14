# VETOR — Roadmap e critérios de aceite

## 1. Estratégia

Construir o VETOR por fatias verticais. Cada fase deve entregar uma experiência navegável e testável, não somente tabelas ou componentes isolados. O cockpit futurista deve existir desde a primeira fase, mesmo que os agentes ainda sejam simulados ou tenham capacidade limitada.

| Fase | Entrega | Critério de passagem |
|---|---|---|
| 0. Fundação | Repositório, autenticação, organização, banco, design tokens, logging e CI | Usuário autenticado vê o cockpit VETOR com estado vazio real |
| 1. Primeiro contato | Onboarding, perfil do negócio, VetorCommandBar, VetorIntentCard e missão manual | Usuário transforma um comando em missão planejada |
| 2. VETOR funcional | Orquestrador, agente geral, fila, eventos, timeline e aprovações | Missão passa por planejamento, etapa e aprovação com auditoria |
| 3. Entregas | Copy, estratégia, design estático, biblioteca e versões | Usuário recebe, revisa e aprova uma entrega |
| 4. Voz e canal | Upload de áudio, transcrição, SSE e WhatsApp controlado | Usuário cria solicitação por áudio e acompanha por canal |
| 5. Analytics | Métricas normalizadas, insights e relatório | Sistema explica resultado, evidência e próximo teste |
| 6. Integrações de ação | Meta/Google em leitura; ações com feature flags | Nenhuma ação externa ocorre sem política e aprovação |
| 7. Escala | planos, uso, suporte, monitoramento, otimização e multi-modelo | Operação consegue monitorar custo, falhas e organizações |

## 2. Definition of Done

Uma feature só está concluída quando possui comportamento implementado, loading, estado vazio, erro, responsividade, acessibilidade básica, testes unitários e de integração, autorização no servidor, logs, documentação e atualização das migrations. Features com agentes também exigem schema de saída, prompt versionado, teste de regressão e registro de consumo.

## 3. Critérios de aceite do MVP

O usuário consegue criar uma organização e cadastrar o contexto do negócio. O cockpit exibe o estado do VETOR, o comando multimodal e missões. Um comando em texto cria uma intenção e uma missão depois da confirmação. Um áudio válido é transcrito e associado ao comando.

O VETOR cria um plano estruturado com hipótese, etapas, agentes, riscos, aprovações e critérios de sucesso. O orquestrador executa pelo menos três etapas de especialistas com saída JSON validada. A timeline mostra eventos em ordem e o SSE atualiza a interface.

O sistema cria pelo menos uma entrega de copy e uma entrega visual ou briefing visual. O usuário pode aprovar, rejeitar e solicitar alteração. Cada decisão gera auditoria. Nenhuma ferramenta externa de risco alto executa sem aprovação.

O sistema isola duas organizações em testes automatizados. Credenciais não aparecem em logs. Webhooks duplicados não criam mensagens ou missões duplicadas. Uma falha de agente aparece como falha explicada e pode ser reprocessada.

## 4. Testes indispensáveis

Criar testes de isolamento multi-tenant, RBAC, transições de missão, idempotência de webhook, expiração de aprovação, limite de orçamento, validação de schema, prompt injection em arquivo, retry de job, reconexão SSE, upload de áudio inválido e falha de integração.

Criar testes visuais para o cockpit, `VetorCore`, `VetorCommandBar`, `VetorIntentCard`, `VetorMissionTimeline`, aprovação e estados de loading. Testar `prefers-reduced-motion`, teclado, contraste e viewport móvel.

## 5. Regra para o Claude Code

Nunca implementar uma integração real antes de criar o adaptador, o mock local, a política de permissão, os testes e a tela de saúde da integração. Nunca adicionar uma ação externa apenas porque a API permite; a ação deve estar ligada a uma missão, um usuário, uma política e uma aprovação quando aplicável.
