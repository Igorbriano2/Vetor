# VETOR — Experiência VETOR e direção visual

## 1. Objetivo da experiência

A interface deve fazer o usuário se sentir como o operador de uma central de comando inteligente. A inspiração em VETOR não significa copiar uma interface de filme; significa reproduzir três sensações: **consciência do contexto**, **resposta imediata** e **controle sobre sistemas complexos**.

O VETOR precisa parecer vivo sem ser distraente. O sistema deve ter atividade, transições e sinais de estado, mas a informação principal sempre precisa vencer a decoração. O usuário deve entender o que o VETOR sabe, o que está fazendo, qual decisão precisa ser tomada e o que aconteceu depois da ação.

## 2. Linguagem visual

| Elemento | Diretriz |
|---|---|
| Fundo | Grafite profundo, quase preto, com gradientes radiais muito discretos. Evitar preto absoluto em todas as superfícies. |
| Cor de identidade | Azul-ciano elétrico para foco, dados e atividade do sistema. |
| Cor de ação | Âmbar/dourado para aprovações, recomendações e pontos de decisão. |
| Cor de risco | Vermelho coral usado apenas para alertas, falhas ou ações bloqueadas. |
| Superfícies | Painéis escuros translúcidos com bordas finas e sombras internas. |
| Tipografia | Sans-serif geométrica para interface e uma fonte monoespaçada apenas em métricas, IDs e logs. |
| Forma | Cards com cantos moderadamente arredondados; usar linhas, órbitas e retículas como estrutura, não como enfeite. |
| Densidade | Cockpit com densidade média; telas de execução e aprovação devem ser mais silenciosas. |
| Ícones | Ícones lineares, consistentes e com estados de preenchimento para indicar atividade. |

O logo VETOR deve comunicar direção, orientação e movimento. A marca deve evitar um robô literal. O símbolo recomendado é uma seta vetorial ou núcleo orbital formado por segmentos, com uma variação de “V” que também funcione como cursor de direção.

## 3. Layout do cockpit

A tela principal deve ter uma composição de três zonas. Na coluna esquerda fica a navegação compacta e o seletor de organização. No centro fica o núcleo da experiência: saudação do VETOR, comando multimodal, missão atual e timeline. Na coluna direita ficam sinais de negócio, aprovações, saúde das integrações e atividade dos agentes.

Em telas menores, a navegação vira uma barra inferior ou drawer. A coluna direita se transforma em uma fila priorizada de cards. O comando do VETOR permanece sempre acessível por um botão flutuante, atalho de teclado e ação de gravação.

A primeira dobra do cockpit deve responder: “Como está meu negócio?”, “O que o VETOR está fazendo?”, “O que precisa de mim?” e “Qual é a próxima oportunidade?”. Não iniciar a tela com gráficos genéricos nem com uma lista de tarefas sem contexto.

## 4. Núcleo visual do VETOR

O núcleo deve ser um componente reutilizável chamado `VetorCore`. Ele representa o estado operacional do agente com um centro luminoso, anéis de atividade e uma etiqueta textual. O componente deve funcionar em versões grande, compacta e inline.

| Estado | Texto | Visual | Ação do usuário |
|---|---|---|---|
| `idle` | “Pronto para a próxima missão” | Pulso lento, brilho ciano suave | Digitar ou gravar comando |
| `listening` | “Estou ouvindo” | Anel expandindo conforme o áudio | Parar ou cancelar gravação |
| `transcribing` | “Convertendo sua voz em instrução” | Partículas ou ondas discretas | Aguardar |
| `understanding` | “Entendendo o objetivo” | Segmentos orbitais em movimento | Revisar entendimento quando pronto |
| `planning` | “Montando a melhor rota” | Linhas convergindo para o núcleo | Ver plano preliminar |
| `delegating` | “Coordenando especialistas” | Pequenos nós conectados ao núcleo | Abrir agentes envolvidos |
| `executing` | “Executando missão” | Progresso circular e eventos na timeline | Acompanhar ou pausar |
| `approval` | “Sua decisão é necessária” | Âmbar pulsante, sem alerta agressivo | Aprovar, editar ou rejeitar |
| `success` | “Missão concluída” | Ciano/verde discreto, brilho único | Abrir entrega e evidências |
| `warning` | “Encontrei um ponto de atenção” | Âmbar fixo e mensagem clara | Ver risco e decidir |
| `error` | “Não consegui concluir esta etapa” | Coral/vermelho limitado | Ver causa, tentar novamente ou escalar |

## 5. Comando multimodal

O componente `VetorCommandBar` deve aceitar texto, áudio, anexos e comandos sugeridos. A entrada deve permitir frases naturais, sem exigir sintaxe específica. Depois do envio, o sistema deve mostrar um `VetorIntentCard` com transcrição, resumo, objetivo identificado, campos inferidos, campos ausentes e ações propostas.

Para áudio, mostrar gravação em tempo real, duração, cancelamento, regravação e transcrição editável. Nunca executar uma missão sensível somente porque uma palavra foi transcrita com baixa confiança. O sistema deve indicar confiança baixa, pedir confirmação e manter o áudio original associado à solicitação, sujeito à política de retenção.

## 6. Missões, não tarefas isoladas

A unidade de trabalho da interface é a `Mission`. Uma missão tem nome, objetivo, prioridade, prazo, orçamento, hipótese, status, agentes envolvidos, artefatos, aprovações, eventos e resultado. As tarefas dos especialistas aparecem dentro da missão, mas não devem substituir a narrativa da missão.

O componente `VetorMissionTimeline` deve apresentar eventos em linguagem humana. Exemplos: “VETOR identificou que o objetivo é aumentar pedidos de delivery”; “Estratégia definiu duas hipóteses”; “Design produziu três variações”; “Governança bloqueou publicação até aprovação”; “Analytics registrou o resultado do teste”. Cada evento pode expandir para mostrar dados técnicos, custo e versão do agente.

## 7. Telas obrigatórias

| Tela | Propósito | Elemento que não pode faltar |
|---|---|---|
| Cockpit | Visão executiva do negócio e do sistema | `VetorCore`, comando, missões, sinais e aprovações |
| Nova missão | Transformar intenção em plano | VetorCommandBar e VetorIntentCard |
| Detalhe da missão | Acompanhar execução | Timeline, agentes, artefatos, custo e política |
| Aprovações | Tomar decisões com segurança | Ação proposta, impacto, alterações e botões claros |
| Entregas | Revisar conteúdo e arquivos | Preview, versões, comentários e status |
| Insights | Entender desempenho | Métricas, hipóteses, diagnóstico e próximo teste |
| Biblioteca | Reutilizar ativos e contexto | Busca, filtros, tags, marca e histórico |
| Integrações | Conectar canais e dados | Saúde da conexão, permissões e último evento |
| Configurações do negócio | Ensinar o contexto ao VETOR | Perfil, público, ofertas, tom, restrições e consentimentos |
| Administração | Gerenciar equipe e plano | Usuários, papéis, uso, cobrança e auditoria |

## 8. Motion e som

Animações devem durar entre 150 e 500 milissegundos, respeitar `prefers-reduced-motion` e nunca impedir a leitura. O brilho do VETOR deve representar estado, não funcionar como decoração permanente. Sons são opcionais e devem vir desativados por padrão; quando ativados, devem ser curtos, discretos e não usar voz sintética sem solicitação.

## 9. Critérios de qualidade visual

O frontend não pode usar placeholders genéricos, gráficos sem dados ou cards repetitivos com a mesma hierarquia. Cada tela deve possuir uma composição clara, estado vazio intencional, loading coerente com o VETOR, feedback de erro e responsividade. O foco de acessibilidade deve incluir contraste, foco visível, navegação por teclado, textos alternativos e equivalentes textuais para sons, ondas e animações.
