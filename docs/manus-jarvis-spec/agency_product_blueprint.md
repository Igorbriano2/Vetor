# Blueprint do produto — agência autônoma JARVIS

## Tese do produto

A empresa não deve se posicionar como um conjunto de ferramentas de IA nem como uma agência tradicional com “robôs executores”. O produto deve ser uma camada operacional de crescimento para pequenos negócios: o cliente descreve um objetivo por texto ou áudio, o JARVIS transforma a intenção em plano, coordena especialistas, executa o que estiver autorizado, solicita aprovação quando houver risco e devolve evidências de resultado.

A promessa central é: **“Você fala o objetivo; o JARVIS pensa, coordena, executa e explica.”** A promessa deve ser condicionada a dados, permissões e aprovações, evitando vender autonomia irrestrita.

## Hierarquia de agentes

O JARVIS é o agente geral e único responsável por interpretar a demanda do cliente, priorizar objetivos, decompor o trabalho, delegar tarefas, consolidar resultados e decidir o próximo passo. Ele não deve executar diretamente todas as tarefas nem permitir que agentes especialistas se acionem livremente; a coordenação central evita conflitos, custos imprevisíveis e decisões contraditórias.

O agente secretário funciona como porta de entrada multimodal. Ele transcreve áudio, identifica intenção, coleta informações ausentes, confirma escopo e encaminha uma solicitação estruturada ao JARVIS. Os agentes especialistas são Growth, Estratégia, Tráfego, Social Media, Design, Vídeo, Copy, CRM/Atendimento, SEO/Conteúdo e Analytics. O agente de governança verifica permissões, políticas, orçamento, consentimento, qualidade e necessidade de aprovação humana antes de publicar, gastar, enviar mensagens sensíveis ou alterar ativos irreversíveis.

| Camada | Responsabilidade | Exemplo de saída |
|---|---|---|
| Cliente | Expressar objetivo, contexto e aprovações | “Quero 30 novos pedidos no delivery este mês” |
| Secretário | Converter texto/áudio em briefing estruturado | Objetivo, prazo, público, orçamento e lacunas |
| JARVIS | Pensar, priorizar, delegar e explicar | Plano de crescimento com tarefas e hipóteses |
| Especialistas | Produzir análises, ativos e ações de domínio | Campanha, criativos, calendário, auditoria |
| Governança | Controlar risco, permissões e qualidade | Aprovação necessária antes de publicar anúncio |
| Analytics | Medir, diagnosticar e alimentar o ciclo | Insight, causa provável, recomendação e próximo teste |

## Experiência visual

A interface deve fazer o usuário se sentir no centro de uma sala de comando, sem parecer um painel gamer. A direção visual recomendada combina fundo grafite quase preto, superfícies translúcidas, linhas finas em azul-ciano, detalhes âmbar para alertas e tipografia limpa. A estética “Tony Stark” deve vir da sensação de controle, contexto e inteligência operacional, não de excesso de neon, animações ou elementos decorativos.

A tela inicial deve apresentar o JARVIS como um cockpit: uma área central de conversa multimodal; um anel de status que mostre “ouvindo”, “pensando”, “executando” ou “aguardando aprovação”; uma linha do tempo de missões; indicadores de crescimento; e um painel de atividades recentes. O usuário deve compreender em poucos segundos o que foi feito, o que está em andamento, o que precisa de autorização e qual impacto foi observado.

O comando principal deve aceitar texto, gravação de áudio, anexos e comandos rápidos. Depois de interpretar a solicitação, o JARVIS deve mostrar um cartão de intenção com três partes: entendimento, plano proposto e ações que exigem aprovação. Isso transforma a automação em uma experiência verificável e evita que o usuário descubra uma ação importante somente depois da execução.

## Fluxo de uma missão

1. O usuário envia texto ou áudio.
2. O secretário transcreve, resume e identifica objetivo, prazo, canal, público, orçamento e restrições.
3. O JARVIS apresenta a interpretação e faz apenas as perguntas essenciais.
4. O JARVIS monta um plano com hipótese, tarefas, dependências, custo estimado, risco e critério de sucesso.
5. Os especialistas executam em ambiente de trabalho e produzem artefatos versionados.
6. O agente de governança aplica regras: ações de baixo risco podem seguir automaticamente; ações financeiras, públicas ou irreversíveis aguardam aprovação.
7. O JARVIS entrega resultado, evidências, limitações e recomendação do próximo experimento.
8. O agente analítico registra o aprendizado no perfil do cliente e atualiza o sistema de decisão.

## Painéis do MVP

O primeiro produto deve ter cinco áreas, em vez de tentar entregar todos os módulos de uma agência completa. O cockpit apresenta o estado geral. A caixa de entrada reúne solicitações por texto, áudio e WhatsApp. A central de missões mostra tarefas, responsáveis, status, aprovações e entregas. O laboratório de crescimento apresenta hipóteses, campanhas e métricas. A biblioteca reúne criativos, cópias, relatórios, versões e referências da marca.

O MVP deve começar com diagnóstico de marketing, planejamento de campanha, copy e criativos estáticos, calendário de conteúdo, relatório analítico e aprovação de publicação. Gestão autônoma de pagamentos, criação irreversível de contas, resposta pública sem revisão e alterações ilimitadas de orçamento devem ficar fora do primeiro lançamento.

## Princípio de autonomia

A autonomia precisa ser graduada por risco. O produto pode operar no modo sugestão, no modo execução com aprovação e no modo automático limitado. Cada cliente deve configurar teto diário de mídia, canais permitidos, tipos de mensagem, horários, palavras proibidas e usuários autorizados. Toda ação precisa registrar quem ou qual agente decidiu, quais dados foram usados, qual política autorizou a ação e qual resultado ocorreu.
