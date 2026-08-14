# VETOR — Fluxos e casos de uso

## 1. Onboarding

O usuário cria a conta, escolhe ou cria uma organização e informa o tipo de negócio. O sistema coleta contexto suficiente para o primeiro plano, mas não deve transformar o onboarding em um formulário longo. O JARVIS deve explicar por que cada pergunta importa e permitir completar o perfil depois.

Ao final, o sistema gera um diagnóstico inicial como rascunho, apresenta lacunas de dados e recomenda a primeira missão. O usuário deve poder entrar no cockpit mesmo com perfil incompleto.

## 2. Comando por áudio

O usuário toca no microfone, grava a solicitação e encerra. O frontend envia o arquivo, mostra estado de upload e cria um comando. O worker transcreve, calcula confiança e devolve a transcrição. O secretário resume a intenção. O IntentCard mostra áudio, transcrição editável, entendimento, campos inferidos e pergunta de confirmação.

Se a confiança estiver baixa ou houver ambiguidade sobre canal, orçamento, público ou ação externa, o sistema não cria uma missão executável. Ele cria uma intenção pendente. Ao confirmar, a intenção vira missão.

## 3. Criação de missão

A missão começa com um objetivo de negócio, não com um agente escolhido manualmente. O JARVIS identifica o resultado, propõe hipótese, escolhe especialistas e estima consumo. O usuário pode editar título, prazo, prioridade, orçamento e escopo antes de iniciar.

A missão deve mostrar uma prévia de etapas. O cliente pode retirar uma etapa, alterar a aprovação necessária ou pedir uma nova interpretação. Depois do início, mudanças relevantes devem criar uma nova versão do plano.

## 4. Execução

O orquestrador coloca etapas sem dependência na fila. Cada especialista recebe contexto mínimo e retorna saída validada. O JARVIS acompanha, resolve conflitos e pode bloquear uma etapa. O usuário vê o progresso na timeline, sem receber detalhes internos desnecessários.

Se uma integração falhar, o sistema tenta novamente. Se o limite for atingido, a etapa fica bloqueada com causa, impacto e opções. O JARVIS nunca simula sucesso para esconder uma falha.

## 5. Aprovação

A aprovação deve ser um momento de decisão, não um botão genérico. A tela deve mostrar exatamente o que será publicado ou alterado, quais contas serão afetadas, orçamento, período, público, criativo, copy, riscos, política aplicada e como desfazer quando possível.

Ao aprovar, registrar usuário, data, versão, IP ou contexto de sessão conforme política, payload aprovado e hash da ação. Ao rejeitar, solicitar motivo opcional ou obrigatório conforme risco. Ao editar, criar nova versão e devolver à validação.

## 6. Entrega e aprendizado

Uma missão concluída deve gerar um resumo executivo, lista de artefatos, alterações realizadas, evidências, métricas, limitações e recomendação seguinte. O usuário pode avaliar a entrega. O feedback entra como dado de qualidade, não como verdade absoluta.

O Analytics deve transformar resultado em hipótese futura. Exemplo: “A variação B teve maior taxa de clique no período observado; recomendamos testar a mesma promessa com novo criativo, mas não há dados suficientes para concluir impacto em vendas.”

## 7. WhatsApp

Mensagem recebida deve aparecer na caixa de entrada, ser vinculada ao contato e ser interpretada pelo secretário. O JARVIS deve responder com confirmação de entendimento ou solicitar informação. A conversa deve permitir visualizar a missão relacionada, aprovar uma ação de baixo atrito e receber atualização de status.

O WhatsApp não deve virar uma superfície onde qualquer mensagem autoriza gasto ou publicação. Para ações de risco, enviar uma notificação resumida e direcionar o usuário à aprovação segura no VETOR.

## 8. Caso de uso principal

Um restaurante diz: “JARVIS, quero aumentar os pedidos de delivery em 20% nas próximas quatro semanas, mas não quero gastar mais de R$ 1.500 em mídia”. O sistema confirma localização, margem, ticket médio, canais de pedido e ativos disponíveis. O JARVIS cria uma missão, propõe hipóteses, delega estratégia, copy, design e tráfego, exibe o orçamento como limite e solicita aprovação antes de qualquer publicação.

Depois de executar os rascunhos, o sistema mostra criativos, copies, público sugerido, calendário e projeções como cenários, não garantias. Após aprovação, sincroniza a ação permitida, acompanha métricas e gera um relatório com o que foi observado e qual próximo teste é recomendado.
