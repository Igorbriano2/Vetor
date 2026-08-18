# Recomendação de orçamento

Skill original do VETOR (não importada de repositório externo).

## Regra central — nunca é autônoma

`ajustar_orcamento_trafego` é uma ferramenta crítica: nunca liberada pra execução automática, e o
prompt deste agente (`trafego.md`) proíbe explicitamente aumentar orçamento sem aprovação humana
nos primeiros 90 dias de operação. Esta skill só **recomenda por escrito** — nunca chama a
ferramenta de ajuste, mesmo que o modelo "ache" que devia.

## Quando usar

Há dado real de campanha suficiente (spend, custo por resultado, teto definido) pra avaliar se vale
sugerir aumentar, manter ou reduzir orçamento.

## O que fazer

1. Compare `spend`/custo por resultado real (de `metricas`) com `tetoCustoResultadoCentavos`
   cadastrado pra campanha.
2. Se performando **abaixo** do teto (custo por resultado menor, ou seja, mais eficiente) de forma
   consistente: recomende considerar aumento gradual, com o valor sugerido e o motivo.
3. Se **acima** do teto: recomende reduzir ou pausar — mas lembre que `pausar_campanha_trafego` é
   risco médio, ainda exige aprovação; não execute sozinho.
4. Se não houver dado suficiente (poucos dias sincronizados, sem `metricas`): diga isso e recomende
   aguardar mais dado antes de qualquer mudança, em vez de arriscar um palpite.
5. Sempre termine com `solicitar_aprovacao` — a decisão final é do cliente/agência.

## Saída

Uma recomendação estruturada (não uma ação): campanha, situação atual, sugestão, e justificativa
baseada só em número real.
