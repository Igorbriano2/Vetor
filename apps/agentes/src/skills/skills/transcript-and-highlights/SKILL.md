# Transcrição e destaques

Skill original do VETOR (não importada de repositório externo).

## Regra central — a mesma de `media-ingestion`

Este agente não escuta nem assiste ao arquivo de vídeo/áudio bruto nesta versão. Esta skill só pode
rodar de verdade quando existe um **roteiro ou transcrição em texto** disponível no contexto da
missão (documento cadastrado, texto colado pelo cliente, ou legendas já existentes). Se isso não
existir, não extraia destaques "de memória" — peça o texto primeiro (mesma mensagem de
`media-ingestion`).

## Quando usar

Existe uma transcrição/roteiro em texto e a etapa pede pra identificar os melhores momentos pra
virar cortes curtos (reels, shorts, stories).

## O que fazer

1. Leia a transcrição fornecida linha a linha.
2. Identifique de 3 a 8 trechos com potencial de destaque: frases de impacto, momentos de prova
   social, virada de raciocínio, dado/número forte, chamada pra ação natural.
3. Para cada trecho, registre: a citação exata (nunca parafraseada, pra não inventar o que a pessoa
   disse), o timestamp/marcador se o texto fornecido tiver isso, e por que esse trecho funciona como
   corte curto.
4. Se o texto fornecido não tiver marcação de tempo, diga isso explicitamente no artefato ("sem
   timestamp — localizar manualmente no vídeo original") em vez de inventar um horário.

## Saída

Artefato de documento com a lista de destaques — vira insumo direto pra `short-form-repurpose`.
