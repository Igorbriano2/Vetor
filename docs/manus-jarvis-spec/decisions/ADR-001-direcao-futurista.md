# ADR-001 — Direção futurista e VETOR como experiência central

## Status

Aceita.

## Contexto

O VETOR precisa permitir que um cliente solicite marketing por texto ou áudio e acompanhe agentes executando uma missão. Um dashboard administrativo comum não comunica a proposta de valor nem cria a sensação de comando, contexto e inteligência que diferencia o produto.

## Decisão

A interface será construída como um cockpit operacional. VETOR será uma presença visual e funcional persistente, com estados, memória de contexto, timeline de missão, comando multimodal, aprovações e evidências. A estética usará grafite profundo, ciano elétrico, âmbar para decisão, superfícies translúcidas e motion funcional.

A inspiração cinematográfica será interpretada como sensação de controle e resposta, não como cópia de marca, personagem, frases ou elementos proprietários. Não usar o rosto de um robô, hologramas decorativos em excesso ou efeitos que prejudiquem acessibilidade e legibilidade.

## Consequências

O frontend precisa de um design system próprio, componente de estado do VETOR, eventos em tempo real e uma hierarquia baseada em missões. O backend precisa expor estados de execução, aprovações e eventos. A implementação será mais cuidadosa que um CRUD, mas a diferenciação será percebida em todo o produto.

A estética não pode esconder falhas. Em estados de erro, bloqueio ou baixa confiança, a mensagem textual e a ação recomendada devem prevalecer sobre a animação.
