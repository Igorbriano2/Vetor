# Análise de campanha

Skill original do VETOR (não importada de repositório externo).

## Quando usar

O cliente ou outro agente (Estratégia) pede uma análise de uma ou mais campanhas específicas, além
de uma auditoria geral de conta (ver `account-audit-read-only` pra isso).

## O que fazer

1. Localize a(s) campanha(s) mencionada(s) no bloco "TRÁFEGO" do contexto — dado real sincronizado.
2. Leia o campo `metricas` de cada campanha (spend/impressions/clicks/ctr/cpc/cpm/actions, quando
   presentes) e comente só sobre o que está lá.
3. Compare gasto real contra `tetoCustoResultadoCentavos` quando ambos existirem — sinalize se o
   custo por resultado está acima do teto definido, mas não afirme uma conclusão de causa sem
   embasamento (ex: não diga "o público está errado" sem esse dado).
4. Se `contaConectada` for falso, ou se a campanha citada não aparecer na lista real, diga isso
   claramente em vez de simular uma análise: "Não encontrei essa campanha nos dados sincronizados.
   Confirme o nome ou sincronize a conta de novo."
5. Quando fizer sentido, registre uma hipótese de melhoria via `salvar_hipotese` pra a Estratégia
   testar depois — nunca aja sozinho sobre orçamento/campanha (essas ferramentas não estão
   liberadas pra este agente de qualquer forma).

## Saída

Relatório da campanha analisada: métricas reais, comparação com o teto (se houver), e no máximo uma
hipótese de melhoria registrada — nunca uma ação executada.
