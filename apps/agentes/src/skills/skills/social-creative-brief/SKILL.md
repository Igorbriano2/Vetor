# Briefing criativo pro Design

Skill original do VETOR (não importada de repositório externo) — não existe equivalente direto no
repo fonte, que assume o mesmo agente escrevendo e gerando a peça. No VETOR, Social Media e Design
são agentes separados (Tool Registry só dá `gerar_imagem` pro Design) — esta skill existe pra esse
handoff nunca virar telefone-sem-fio (pauta vaga chegando no Design sem contexto suficiente pra
gerar uma imagem que preste).

## Quando usar

Uma pauta/legenda já foi decidida e a próxima etapa da missão é o agente de Design gerar a peça
visual — sempre antes daquela etapa, nunca depois.

## O que o briefing precisa ter (Design não deveria precisar perguntar de novo)

1. **Formato/canal**: feed (1:1), story/reels (9:16), ou ambos.
2. **Texto que aparece na peça** (se houver) — literal, não parafraseado: título principal,
   subtítulo, preço/condição exatos.
3. **Cores da marca**: puxe de `brand_kit`, não invente.
4. **Composição sugerida**: o que deve estar em destaque (produto, preço, CTA) — não é preciso
   desenhar, mas dizer a prioridade visual.
5. **Referência de tom**: descontraído, sério, urgente — herda do `brand_kit`/onboarding.

## Regra

Nunca mande o Design gerar uma peça com preço/condição que a etapa de Estratégia/Growth não
confirmou — texto errado numa peça publicada é pior que atraso.

## Saída

`criar_briefing` com os 5 pontos acima preenchidos — a etapa de Design lê isso como parte do
contexto da missão (já é incluído automaticamente no montarContexto do especialista).
