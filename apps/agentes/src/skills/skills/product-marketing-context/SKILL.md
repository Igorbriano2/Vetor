# Contexto de posicionamento e ICP

Adaptado de `product-marketing` (coreyhaines31/marketingskills, MIT) — a diferença central pro
original: lá o contexto vive num arquivo `.agents/product-marketing.md` no repositório do usuário;
no VETOR, o contexto já existe como dado real em `business_profiles`/`brand_kits` (Supabase,
isolado por `cliente_id`) — esta skill nunca cria um arquivo solto, ela lê o que já existe via
`ler_perfil_negocio`/`ler_brand_kit` e propõe o que falta preencher.

## Quando usar

O texto da etapa menciona posicionamento, ICP, público-alvo, proposta de valor, ou pede pra
"descrever o negócio" — normalmente a primeira coisa que roda numa missão nova, antes de qualquer
outra skill de Estratégia (as demais skills deste departamento assumem que este contexto já foi
lido).

## Workflow

1. **Leia o que já existe.** `ler_perfil_negocio` + `ler_brand_kit` primeiro, sempre — nunca
   pergunte algo que já está cadastrado.
2. **Identifique lacunas**, comparando contra as seções abaixo. Não pergunte tudo de uma vez — só o
   que falta e bloqueia a decisão atual.
3. **Monte o resumo** nas seções abaixo, com o que já existe + o que foi respondido agora.
4. Se alguma informação nova e reutilizável surgir (ex: uma frase que o cliente usa pra descrever o
   problema, um objetivo declarado), registre com `salvar_hipotese` (confiança "high" só se foi
   dito explicitamente pelo cliente, "medium" se foi inferido).

## Seções do contexto

- **Produto/serviço**: descrição em uma frase + 2-3 frases do que resolve.
- **Categoria**: em que "prateleira" o cliente se compara (como as pessoas procuram por ele).
- **ICP**: quem decide comprar, que problema urgente tem, como descreve esse problema com as
  próprias palavras (prefira citação literal do cliente a paráfrase — linguagem verbatim vale mais
  que descrição polida).
- **Diferenciação**: por que esse negócio e não o concorrente da esquina.
- **Tom de voz**: já deve estar em `brand_kits.regras` — só reforce, nunca reinvente sem
  aprovação.
- **Restrições**: nicho regulado (saúde/advocacia), palavras proibidas/permitidas já cadastradas.

## Saída

`criar_briefing` com o resumo estruturado — outras skills de Estratégia/Growth devem poder ler esse
briefing como ponto de partida em vez de re-perguntar o mesmo.
