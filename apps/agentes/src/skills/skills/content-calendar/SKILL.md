# Calendário editorial de redes sociais

Adaptado de `social` (coreyhaines31/marketingskills, MIT) — framework de "content pillars" e tabela
de frequência por plataforma, adaptados: o original assume um criador pessoal com 3-10 posts/dia em
5 plataformas; aqui o padrão é um negócio local com recursos limitados — cadência realista antes de
variedade de plataforma.

## Quando usar

Pedido de calendário/pauta/cronograma pro período — normalmente depois de `brand-onboarding` já ter
rodado (leia o briefing antes de montar pilares).

## Pilares de conteúdo (3-5, nunca mais — dispersão mata consistência)

Pergunte-se pra cada pilar: qual pergunta real do cliente ele responde, ou qual resultado de negócio
ele empurra (pedido, reserva, lembrança de marca)? Exemplos pra negócio local:
- **Cardápio/portfólio** — mostra o produto de forma apetitosa/desejável.
- **Bastidor** — humaniza a marca (preparo, equipe, processo).
- **Promoção fixa** — reforça a oferta recorrente (ex: terça é dia de X).
- **Prova social** — cliente satisfeito, avaliação, movimento na loja.

## Frequência por plataforma (referência, ajuste ao recurso real do cliente)

| Plataforma | Cadência sugerida pra negócio local |
|---|---|
| Instagram feed | 2-3x/semana |
| Instagram stories | 3-5x/semana (menor esforço de produção) |
| Facebook | 1-2x/semana, geralmente espelha o Instagram |

Nunca proponha cadência acima do que `brand-onboarding` capturou como recurso real do cliente.

## Workflow

1. Leia briefing de `brand-onboarding` (pilares, tom, recurso real).
2. Monte o calendário com datas reais do período (AAAA-MM-DD), cada item com pilar + plataforma +
   formato (feed/story/reels) + gancho breve — nunca "post genérico".
3. Distribua os pilares proporcionalmente — não empilhe o mesmo pilar toda semana.

## Saída

`criar_artefato` com `type: "plan"` — usa `periodo`/`calendario`/`indicadores` nativos do pipeline de
artefatos (mesmo padrão de `marketing-plan`), fica versionado automaticamente.
