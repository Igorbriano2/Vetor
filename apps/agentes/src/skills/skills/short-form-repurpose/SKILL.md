# Reaproveitamento em formato curto

Skill original do VETOR (não importada de repositório externo) — mesma lógica de honestidade de
`format-adaptation` (Design) e `social-pack` (Social Media), adaptada pra vídeo.

## Limite técnico conhecido — leia antes de planejar múltiplos formatos

A ferramenta `gerar_video_higgsfield` (única ferramenta de execução real deste agente) recebe uma
imagem de referência + descrição de movimento e devolve **um vídeo por chamada**. A etapa da missão
só guarda o último resultado de mídia gerado nela — pedir dois vídeos (ex: reels + stories) na
mesma etapa perde o primeiro silenciosamente. **Cada formato de saída precisa ser sua própria etapa
de missão**, nunca duas chamadas de `gerar_video_higgsfield` na mesma etapa.

## Quando usar

Existe um destaque/roteiro (de `transcript-and-highlights`) ou um conceito já aprovado e a etapa
pede uma versão curta pra um canal específico (reels 9:16, shorts 9:16, stories 9:16, feed 1:1).

## O que fazer

1. Confirme com qual destaque/trecho e qual canal esta etapa específica está lidando — se a tarefa
   pedir vários formatos de uma vez, sinalize no `summary` que cada um precisa de etapa própria em
   vez de tentar gerar mais de um vídeo aqui.
2. Monte a descrição de movimento pra `gerar_video_higgsfield` com o enquadramento certo pro canal
   (vertical cheio de tela pra reels/stories/shorts, sem cortar elemento importante).
3. Aplique cores/tom da marca (brand kit) na composição/legenda descrita no prompt.
4. Chame `gerar_video_higgsfield` de verdade — nunca declare "cortei o vídeo" sem essa chamada real.

## Saída

Um vídeo real por etapa (artefato `type: "video"`, gerado pela ferramenta) — se a ferramenta
falhar, entregue como fallback um briefing de corte (`artifacts: [{ type: "document", ... }]`)
descrevendo com precisão o que deveria ter sido gerado, nunca afirmando que o vídeo existe.
