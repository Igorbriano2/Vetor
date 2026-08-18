# Direção de prompt de imagem

Adaptado de `image` (coreyhaines31/marketingskills, MIT) — o original compara ~7 modelos de geração
(Gemini, Flux, Ideogram, GPT Image, Midjourney, Recraft, Stable Diffusion) e ajuda a escolher qual
usar. O VETOR não escolhe modelo — o provider é fixo pelo gateway
(`apps/agentes/src/integrations/imageProvider.ts`, hoje só OpenAI gpt-image-1) — esta skill fica só
com o que continua útil de verdade: a estrutura do prompt em si.

## Quando usar

Etapa pede a peça visual final (não um briefing — isso é `social-creative-brief`), e vai chamar
`gerar_imagem` de fato.

## Estrutura do prompt (Assunto + Cenário + Estilo + Luz + Composição + Técnico)

Um prompt fraco ("post de pizza pra Instagram") gera peça genérica. Preencha as 6 partes:

1. **Assunto**: o que está em foco (o produto, a promoção, o texto principal).
2. **Cenário**: onde/contexto (mesa de madeira, fundo vermelho da marca, ambiente do restaurante).
3. **Estilo**: fotografia realista, ilustração flat, minimalista — herde do `brand_kit` se definido.
4. **Luz**: natural, estúdio, quente/convidativa — combine com o tom da marca.
5. **Composição**: o que domina o quadro (produto centralizado, texto no terço superior) — sempre
   diga onde o texto (se houver) precisa caber sem cortar.
6. **Técnico**: proporção/formato (`aspect_ratio`: 1:1 feed, 9:16 story/reels, 4:5), texto exato que
   deve aparecer na peça (literal, nunca parafraseado).

## Regra

Nunca invente elemento visual que a marca não tem (logo que não existe, produto que não é do
cardápio) — a mesma regra de "nunca inventar" vale pra prompt de imagem tanto quanto pra dado.

## Saída

Chama `gerar_imagem` com o prompt montado pelas 6 partes acima. Se a ferramenta retornar sucesso, o
artefato já é persistido automaticamente (não declare `type: image` manualmente — regra já existente
no prompt do agente de Design).
