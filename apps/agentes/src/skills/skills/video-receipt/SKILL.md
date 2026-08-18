# Recibo de entrega de vídeo

Skill original do VETOR (não importada de repositório externo).

## Quando usar

Depois que `gerar_video_higgsfield` já produziu um artefato real nesta missão (nesta etapa ou numa
etapa anterior referenciada no histórico) e a etapa atual pede o fechamento/resumo pro cliente.

## O que fazer

1. Confirme que existe mesmo um artefato real de vídeo — nunca escreva um recibo de algo que não
   foi gerado (mesma regra do `quality-gate`).
2. Resuma em linguagem simples: o que o vídeo mostra, formato/canal, duração aproximada (se souber
   pela descrição do prompt usado), e quais ativos reais do Drive foram usados como referência
   (imagem base, se houver).
3. Deixe claro que a entrega depende de aprovação antes de publicar, exceto se a etapa não exigir
   aprovação (etapas de baixo risco).

## Saída

Um resumo curto e claro no `summary` da etapa (não precisa de artefato de documento extra) —
funciona como o "recibo" que o cliente vê no painel antes de aprovar.
