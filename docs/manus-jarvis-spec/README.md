# VETOR — Especificação-mestre para implementação

**Versão:** 0.1

**Objetivo:** orientar o Claude Code na implementação do VETOR, uma plataforma de crescimento e marketing autônomo para pequenos negócios, com experiência futurista de sala de comando e um agente geral chamado JARVIS.

## 1. O que é o VETOR

O VETOR não deve parecer uma agência tradicional digitalizada. Ele deve ser percebido como um sistema operacional de crescimento: o cliente descreve um objetivo por texto ou áudio, o JARVIS entende a intenção, formula um plano, coordena agentes especialistas, executa ações autorizadas, solicita aprovação quando necessário e explica os resultados.

A frase de posicionamento é: **“VETOR transforma intenção em crescimento. Você fala o objetivo; JARVIS pensa, coordena, executa e aprende.”**

O produto atende inicialmente pequenos negócios que não possuem uma equipe completa de marketing, com foco em restaurantes e delivery, profissionais jurídicos, arquitetura e engenharia, saúde, estética e serviços locais. O VETOR deve ser generalista na plataforma, mas trabalhar com perfis verticais, playbooks e limites de comunicação por segmento.

## 2. O princípio mais importante

O JARVIS é o agente geral e a interface cognitiva do VETOR. Os demais agentes não devem disputar a atenção do cliente nem conversar diretamente entre si de forma descontrolada. O JARVIS recebe a intenção, cria a missão, delega tarefas, consolida respostas e decide o próximo passo dentro das políticas do sistema.

A implementação deve evitar um “chat bonito em cima de CRUD”. A experiência precisa comunicar que existe um sistema operacional inteligente trabalhando em segundo plano. Toda missão deve ter estado, plano, agentes envolvidos, evidências, aprovações, custo estimado e resultado.

## 3. Regras inegociáveis para o Claude Code

| Regra | Aplicação |
|---|---|
| JARVIS é o centro | O cockpit, a timeline e as missões devem sempre mostrar o JARVIS como coordenador. |
| Futurista, mas utilizável | Usar profundidade, luz, transparência e motion com disciplina; não criar um painel confuso ou cheio de neon. |
| Estado visível | O usuário deve saber se o sistema está ouvindo, entendendo, planejando, executando, aguardando aprovação ou concluído. |
| Autonomia com controle | Ações de publicação, gasto, mensagens públicas, alterações irreversíveis e dados sensíveis exigem política e aprovação. |
| Evidência antes de promessa | Cada entrega deve mostrar o que foi feito, fonte de dados, limitações e próximo teste. |
| Áudio é primeira classe | Gravação, transcrição, confirmação de entendimento e histórico devem ter o mesmo nível de qualidade do texto. |
| Mobile-first para operação | O cliente deve conseguir solicitar demandas e aprovar ações no celular, principalmente pelo WhatsApp. |
| Dados multi-tenant | Toda consulta deve ser isolada por organização, com autorização no servidor. |
| Observabilidade | Toda ação de agente precisa gerar logs, custo, duração, versão do prompt e resultado. |
| Implementação incremental | Começar com um vertical slice funcional, não com todos os agentes e integrações ao mesmo tempo. |

## 4. O que o produto deve transmitir

Ao abrir o VETOR, o usuário deve sentir que entrou em uma central de comando pessoal. A tela não deve ser uma lista de menus com um chatbot lateral. O sistema deve exibir uma visão viva do negócio: sinais importantes, missões em andamento, oportunidades detectadas, aprovações pendentes e impacto acumulado.

O tom do JARVIS deve ser preciso, calmo, proativo e respeitoso. Ele pode usar linguagem natural em português brasileiro, mas nunca deve fingir certeza. Quando faltarem dados, deve declarar a lacuna e pedir apenas a informação necessária. Quando uma ação tiver risco, deve explicar o risco e o que será alterado.

## 5. MVP obrigatório

O MVP deve provar o ciclo completo “pedido → entendimento → plano → execução → aprovação → entrega → aprendizado”. Ele deve conter login, organização, onboarding do negócio, cockpit, entrada por texto, gravação de áudio com transcrição, criação de missão, JARVIS coordenador, agentes de Estratégia, Copy, Design estático e Analytics, biblioteca de entregas, aprovações, notificações e um adaptador inicial de WhatsApp.

A integração de anúncios deve começar em modo de leitura e planejamento. A publicação real de anúncios, cobrança, alteração de orçamento e ações irreversíveis devem ter feature flag, limites configuráveis e aprovação explícita.

## 6. Critério de sucesso do primeiro ciclo

Um usuário novo deve conseguir cadastrar seu negócio, dizer em áudio “quero vender mais no delivery este mês”, revisar o entendimento do JARVIS, aprovar um plano, receber uma campanha com copy e criativos, visualizar a missão na timeline, aprovar a entrega e receber um relatório explicando o que foi realizado e qual experimento deve ser executado em seguida.

## 7. Documentos desta especificação

| Arquivo | Finalidade |
|---|---|
| `docs/01-visao-e-requisitos.md` | Requisitos funcionais, personas e escopo do MVP. |
| `docs/02-experiencia-jarvis.md` | UX, UI, direção visual, motion e estados da interface. |
| `docs/03-arquitetura-tecnica.md` | Arquitetura, serviços, filas, agentes, integrações e segurança. |
| `docs/04-agentes-e-prompts.md` | Contratos dos agentes, políticas, entradas, saídas e prompts-base. |
| `docs/05-fluxos-e-casos-de-uso.md` | Fluxos detalhados de onboarding, missão, aprovação e WhatsApp. |
| `docs/06-modelo-de-dados.md` | Entidades, relações, estados e requisitos de isolamento. |
| `docs/07-api-e-eventos.md` | APIs internas, webhooks, eventos e idempotência. |
| `docs/08-roadmap-e-criterios.md` | Fases de implementação, testes e critérios de aceite. |
| `docs/09-planos-e-economia.md` | Pacotes, créditos de uso, limites e fórmula de margem. |
| `prompts/system-jarvis.md` | Prompt de sistema inicial do agente geral. |
| `decisions/ADR-001-direcao-futurista.md` | Decisão de produto e linguagem visual. |

## 8. Como o Claude Code deve usar estes arquivos

Antes de implementar uma feature, o Claude Code deve ler este README, o documento da área correspondente e o roadmap. Deve então verificar se a alteração respeita multi-tenancy, governança, acessibilidade, observabilidade e a experiência central do JARVIS. Cada etapa deve terminar com testes, atualização da documentação e registro das decisões técnicas relevantes.
