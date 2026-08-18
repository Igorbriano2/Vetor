# Pacote de formatos por conceito

Skill original do VETOR (não importada de repositório externo) — existe pra deixar explícito um
limite real da execução atual: **uma etapa do agente de Design só persiste a mídia da ÚLTIMA
chamada de `gerar_imagem` feita nela** (o loop de execução guarda só o resultado mais recente —
ver `apps/agentes/src/agents/specialistRunner.ts::rodarComFerramentaDeExecucao`). Chamar
`gerar_imagem` duas vezes na mesma etapa pra "gerar feed e story" perde a primeira imagem em
silêncio — nenhum erro aparece, o artefato simplesmente não existe.

## Quando usar

O conceito visual já foi definido (por `image-direction` ou `ad-creative`) e a missão precisa do
mesmo conceito em mais de um formato — ex: "a mesma arte pro feed e pro story".

## Regra central (contorna o limite acima)

**Cada formato precisa ser uma etapa separada da missão, nunca duas chamadas de `gerar_imagem`
dentro da mesma etapa.** Isso é decisão de planejamento do Vetor ao montar `propor_missao`, não algo
que esta skill resolve sozinha dentro de uma etapa — se a etapa atual já pede mais de um formato no
mesmo texto, sinalize isso no `summary` (etapa deveria ter sido dividida) e gere só o formato
principal, deixando explícito no resultado que os outros formatos precisam de etapas próprias.

## Composição por formato (ao gerar cada etapa)

Mantenha o conceito (assunto, cores, texto) idêntico entre formatos — só a composição muda:
- **1:1 (feed)**: composição centralizada, texto cabe em qualquer recorte.
- **9:16 (story/reels)**: composição vertical, texto longe das bordas superior/inferior (área seguraa
  de UI da plataforma).
- **4:5**: meio termo, mais vertical que o feed clássico.

## Saída

Uma chamada de `gerar_imagem` pra o formato desta etapa específica — vira um artefato real. Se a
etapa recebida pedir múltiplos formatos, o `summary` deixa claro que só um foi gerado e por quê
(limite da execução atual), nunca finge ter coberto todos.
