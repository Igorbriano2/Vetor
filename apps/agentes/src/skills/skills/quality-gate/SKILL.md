# Checklist de qualidade de vídeo

Skill original do VETOR (não importada de repositório externo) — mesmo papel de `brand-compliance`
(Design), adaptada pra vídeo.

## Quando usar

Antes de declarar `status: "completed"` numa etapa que envolveu (ou deveria ter envolvido) um vídeo
real gerado por `gerar_video_higgsfield`.

## Checklist obrigatório

- [ ] Existe um artefato real de vídeo desta etapa (a ferramenta `gerar_video_higgsfield` foi
      chamada e retornou sucesso) — nunca marque como pronto um vídeo que não foi gerado de fato.
- [ ] O formato/enquadramento bate com o canal pedido (vertical pra reels/stories/shorts, quadrado
      ou paisagem pra feed/YouTube).
- [ ] Não há uso de trilha sonora ou material de terceiros sem licença comercial (regra de
      `video.md`).
- [ ] Se o brand kit exige cores/tom específicos, o prompt de geração os refletiu.
- [ ] Se a ferramenta de geração falhou, a etapa NÃO foi marcada como "vídeo pronto" — foi entregue
      como briefing de fallback, com o motivo real da falha explicado no `summary`.

## Se algo falhar no checklist

Nunca corrija retroativamente o `summary` pra parecer que passou. Reporte a falha específica,
`status: "completed"` só se o fallback (briefing) for uma entrega válida por si só, ou
`needs_clarification`/reprovação se depender de decisão do cliente.

## Saída

Um resumo estruturado de qual item do checklist passou/falhou — vira parte do `summary` da etapa,
não precisa de artefato de documento separado a menos que a etapa peça só isso.
