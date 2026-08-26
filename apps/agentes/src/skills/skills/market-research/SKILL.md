# Pesquisa de mercado real

Skill original do VETOR (não importada de repositório externo) — fecha o maior gap identificado em
`docs/AUDITORIA-E-PROMPT-RECONSTRUCAO-2026-08.md`: até esta skill existir, todo diagnóstico de
mercado/concorrência do VETOR vinha só do que o modelo já sabia, nunca de uma busca real.

## Quando usar

Sempre que a etapa pedir diagnóstico de mercado, análise de concorrência, ou for uma Rota
Estratégica (seção "mercado") — antes de escrever qualquer coisa sobre concorrentes ou o mercado
local do cliente, chame `pesquisar_mercado` com uma query específica (nome da cidade/região + nicho
do negócio, ex: `"concorrentes hamburgueria Cambé PR"`).

## Regras inegociáveis

- **Nunca cite um concorrente que a busca não trouxe.** Se `pesquisar_mercado` não retornar nenhum
  concorrente específico, diga isso — "não identifiquei concorrentes diretos nesta busca" é uma
  resposta honesta e válida, um nome inventado não é.
- **Se a ferramenta não estiver disponível** (sem `TAVILY_API_KEY` configurada), sinalize
  explicitamente no diagnóstico que a pesquisa de mercado não pôde ser feita nesta rodada, em vez de
  preencher a seção como se tivesse pesquisado.
- A resposta da busca (`respostaDireta` + lista de resultados com título/url/resumo) é matéria-prima
  pra sua análise, não um texto pra colar cru — sintetize, mas sem adicionar fato que não veio da
  busca.
