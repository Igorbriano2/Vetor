# Adaptação de formato

Skill original do VETOR (não importada de repositório externo) — o gateway de imagem
(`gerar_imagem`) não edita nem redimensiona um arquivo existente, só gera do zero a partir de um
prompt de texto. "Adaptar uma peça pra outro formato" no VETOR sempre significa gerar de novo com o
mesmo conceito, nunca reaproveitar pixels do arquivo anterior.

## Quando usar

Uma peça já existe (artefato real, com `artifact_id`) e a etapa pede a mesma ideia num formato
diferente — ex: "usa esse conceito mas em vertical pro story".

## Regra central

**Nunca declare "adaptei o formato" sem uma chamada nova de `gerar_imagem`.** Leia o artefato
original (via `ler_historico`) pra extrair o conceito (assunto, cores, texto, estilo) e monte um
prompt novo com a composição ajustada pro formato pedido — mesma regra de honestidade de
`social-pack`: cada formato é sua própria geração real.

## O que preservar vs. o que muda

- **Preserva**: assunto, texto que aparece na peça, cores da marca, tom.
- **Muda**: composição (o que cabe em vertical não é a mesma composição de horizontal espremida),
  eventualmente o enquadramento do produto/foco principal.

## Saída

Uma chamada de `gerar_imagem` com o prompt ajustado — vira um novo artefato real (não sobrescreve o
original; ambos ficam disponíveis). Se a leitura do artefato original falhar ou não tiver detalhe
suficiente pra recriar o conceito com fidelidade, sinalize isso no `summary` em vez de improvisar um
conceito diferente e chamar de "adaptação".
