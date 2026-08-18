# Plano mensal de marketing

Adaptado de `marketing-plan` (coreyhaines31/marketingskills, MIT) — o original produz um documento
de 13 seções pra apresentar a founders/investidores, com integrações MCP (Ahrefs, Stripe) que o
VETOR não tem. Esta versão é deliberadamente mais enxuta: usa só o que o VETOR já sabe fazer de
verdade (ler perfil/brand kit/histórico, gerar artefato type=plan já suportado nativamente pelo
pipeline de artefatos — ver `apps/agentes/src/artifacts/artifactsService.ts`), sem inventar seções
que dependem de dado que o sistema não coleta ainda.

## Quando usar

Pedido explícito de plano/roadmap mensal, ou como sequência natural depois de
`marketing-diagnosis` já ter apontado as áreas prioritárias.

## Estrutura AARRR (adaptada — só as seções relevantes pro estágio do cliente)

Nem todo cliente do VETOR precisa das 5 letras. Um restaurante local pensa quase só em
**Aquisição** (pedidos novos) e **Retenção** (cliente volta) — não force Referral/Revenue como
seções separadas se não fizer sentido pro nicho.

- **Acquisition** — de onde vêm pedidos/leads novos hoje, e o que a agência vai fazer pra aumentar
  isso no período (conteúdo, tráfego pago, parcerias locais).
- **Activation** — o que acontece entre "descobriu o negócio" e "virou cliente" — tem fricção óbvia
  aí?
- **Retention** — o que traz o cliente de volta (promoção recorrente, fidelidade, conteúdo que
  mantém lembrança de marca).
- **Referral** — só inclua se o nicho tiver indicação natural (ex: estética, arquitetura) — não
  force pra delivery.
- **Revenue** — ticket médio, como aumentar sem parecer "mais caro" (combo, upsell natural).

## Workflow

1. Leia o briefing de `product-marketing-context` e o relatório de `marketing-diagnosis` se
   existirem (via `ler_historico`) — não repita perguntas já respondidas.
2. Monte um calendário real com datas concretas do período (nunca "semana 1", sempre AAAA-MM-DD) —
   cada item aponta pra qual seção AARRR ele serve.
3. Defina indicadores mensuráveis por seção usada (ex: "pedidos via Instagram", não "engajamento" —
   prefira métrica que o cliente realmente consegue contar).
4. Se o plano pressupõe uma ferramenta que a agência não tem contratada pro cliente (ex: tráfego
   pago sem o Gestor de Tráfego contratado), sinalize como "upsell" — mesma regra do prompt do
   Vetor, nunca finja que a capacidade existe.

## Saída

`type: "plan"` via `artifacts` (usa o suporte nativo de `periodo`/`calendario`/`indicadores` do
pipeline — não declare como `document` solto). O plano fica automaticamente versionado
(`parent_artifact_id`) se um plano anterior do mesmo período já existir.
