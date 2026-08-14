# VETOR — Instruções operacionais para o Claude Code

## Antes de codificar

Leia `README.md`, `docs/01-visao-e-requisitos.md`, `docs/02-experiencia-jarvis.md`, `docs/03-arquitetura-tecnica.md` e o documento específico da tarefa. Inspecione o código existente antes de criar arquivos. Preserve decisões e padrões já válidos, mas corrija inconsistências que violem a visão VETOR.

Quando uma decisão estiver ambígua, prefira a alternativa que mantém o ciclo “intenção → plano → missão → aprovação → evidência”. Não transformar o JARVIS em uma sidebar de chat. Não criar telas administrativas genéricas quando uma missão ou um estado do sistema deveria ser o centro da experiência.

## Ordem de implementação

1. Mapear o repositório atual, stack, scripts, variáveis, rotas e componentes.
2. Registrar um plano curto de implementação e os riscos da tarefa.
3. Implementar primeiro tipos, contratos e estados.
4. Implementar backend, autorização e testes antes de liberar a ação no frontend.
5. Implementar estados visuais: loading, vazio, erro, bloqueado, aprovação e sucesso.
6. Integrar o `JarvisCore`, `CommandBar`, `IntentCard` e `MissionTimeline` ao estado real.
7. Adicionar observabilidade, auditoria e consumo.
8. Rodar testes, lint, typecheck e build.
9. Atualizar documentação e registrar decisões.

## Regras de frontend

Use tokens de design e componentes semânticos. O ciano deve indicar atividade e foco; o âmbar deve indicar decisão; o coral deve indicar risco ou falha. Não usar gradientes, brilho ou animações em todos os cards. Motion deve explicar estado. Todo estado visual importante deve possuir uma versão textual acessível.

O cockpit precisa funcionar sem dados reais por meio de fixtures realistas, mas fixtures devem ser claramente separadas de produção. Não mostrar números inventados como se fossem métricas reais. Em dados ausentes, usar linguagem de ausência: “Ainda não conectado”, “Sem dados no período” ou “Aguardando aprovação”.

## Regras de backend e agentes

Toda rota valida autenticação, papel, `organizationId` e entrada. Toda missão usa máquina de estados. Toda execução de agente usa schema, timeout, retry, prompt versionado, limite de contexto e registro de consumo. Toda ferramenta externa passa pelo Policy Engine.

Não colocar segredo no cliente, prompt completo em logs ou credencial em payload de evento. Não permitir que conteúdo externo altere política, prompt de sistema ou permissões. Não executar ações externas a partir de texto bruto sem confirmação e governança.

## Checklist de entrega

A tarefa deve informar arquivos alterados, comportamento entregue, testes executados, limitações, variáveis novas, migrations e próximos riscos. Uma tarefa não está pronta se só renderiza uma tela, só cria banco sem fluxo, ou só integra API sem mock, política, retry, auditoria e tratamento de erro.

## Primeira tarefa recomendada

Implementar um vertical slice demonstrável: cockpit futurista do VETOR, onboarding mínimo, comando textual, IntentCard, criação de missão, JARVIS gerando plano estruturado, uma etapa simulada de Copy, aprovação, entrega versionada, timeline e consumo. Depois substituir o mock de agente e integrações por execução real, mantendo os contratos.
