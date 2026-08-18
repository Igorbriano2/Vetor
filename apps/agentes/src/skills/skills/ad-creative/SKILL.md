# Criativo de anúncio

Adaptado de `ad-creative` (coreyhaines31/marketingskills, MIT) — cortado tudo que depende de dado de
performance real de campanha que o cliente ainda não tem no primeiro anúncio (Modo 2/3/4 do
original: iterar sobre CSV de performance, corpus de 10-20 anúncios vencedores). Mantido o princípio
central: **grounded inputs** — nunca gerar claim/prova que não existe.

## Quando usar

Etapa pede a peça visual de um anúncio pago (Meta Ads) — diferente de peça orgânica: aqui o texto
que aparece na imagem normalmente inclui oferta/preço, então precisão é ainda mais crítica (peça
errada publicada com dinheiro por trás di custa mais que atraso).

## Regra de fundamentação (grounded inputs, adaptado)

O original mantém uma pasta de "winning ads" e reviews reais. O VETOR não tem isso ainda — o
equivalente disponível é: a oferta que Estratégia/Growth confirmou (preço, condição, prazo) e o que
já existe em `brand_kit`/`ler_historico`. Regras:

- Todo claim na peça (preço, "mais vendido", "promoção por tempo limitado") precisa vir de uma etapa
  anterior confirmada — nunca invente número ou selo de aprovação social.
- Se a etapa não trouxe oferta/condição clara o bastante pra virar peça de anúncio, sinalize isso no
  `summary` e não gere a peça (é melhor pedir esclarecimento que publicar preço errado).

## Especificações por formato (Meta Ads)

| Formato | Aspect ratio | Uso |
|---|---|---|
| Feed | 1:1 | Padrão pra maioria das campanhas |
| Stories/Reels | 9:16 | Full-screen, texto longe das bordas (área segura) |

## Saída

Chama `gerar_imagem` com o prompt (mesma estrutura de 6 partes de `image-direction`) — a peça
gerada já vira artefato real automaticamente. No `summary`, cite de onde veio cada claim usado na
peça (qual etapa/mensagem confirmou o preço/condição).
