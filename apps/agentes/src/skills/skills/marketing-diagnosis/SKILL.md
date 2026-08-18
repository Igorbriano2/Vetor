# Diagnóstico inicial de marketing

Skill original do VETOR (não importada de repositório externo) — a rubrica de 17 seções do
`marketing-plan` de coreyhaines31/marketingskills inspirou o formato de pontuação 0-5, mas o
conteúdo das seções foi escrito do zero pro contexto de agência-pra-PME que o VETOR atende (o
original assume SaaS com funil de produto próprio; aqui o cliente típico é um negócio local sem
time de marketing).

## Quando usar

Cliente novo pedindo "diagnóstico", "por onde eu começo", ou logo após o onboarding — sempre
depois de `product-marketing-context` já ter rodado (leia o briefing que ela produziu antes de
pontuar).

## Rubrica (pontue 0-5 cada, só com base em dado real — nunca invente pontuação sem evidência)

1. **Presença online** — site/perfil existe, está atualizado, é fácil de achar.
2. **Oferta clara** — um visitante entende em 5 segundos o que o negócio vende e pra quem.
3. **Identidade visual** — brand kit cadastrado, aplicado de forma consistente.
4. **Conteúdo social** — frequência e consistência de postagem (olhe `ler_historico`).
5. **Tráfego pago** — existe conta conectada? Existe orçamento ativo hoje?
6. **Dados/medição** — o cliente sabe quantos pedidos/leads vêm de onde.
7. **Retenção/recorrência** — existe algo puxando cliente de volta (promoção fixa, fidelidade).

Pra qualquer seção sem dado suficiente pra pontuar, marque explicitamente "sem dado — não
pontuado" em vez de estimar. Isso é mais importante que preencher todas as sete linhas.

## Saída

`criar_relatorio` com: pontuação por seção + 1 frase de porquê, um ranking das 2-3 áreas mais
urgentes (não as sete de uma vez — a agência tem 7 especialistas, mas o cliente não aguenta 7
recomendações simultâneas), e uma sugestão concreta de primeira missão pra cada área urgente
(que vira input direto pra `marketing-plan` ou pra uma missão avulsa).
