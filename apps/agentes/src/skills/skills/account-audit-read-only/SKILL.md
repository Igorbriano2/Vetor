# Auditoria de conta (somente leitura)

Skill original do VETOR (não importada de repositório externo).

## Regra central

Esta skill NUNCA chama `criar_campanha_trafego`, `ajustar_orcamento_trafego`, `criar_audiencia` ou
qualquer ferramenta crítica — essas nem estão liberadas pra este agente. O trabalho aqui é 100%
leitura: descrever o que já está configurado e sinalizar problemas, nunca corrigi-los sozinho.

## Quando usar

O cliente pede um raio-x da conta de anúncios: o que está ativo, o que está gastando, o que parece
mal configurado.

## O que fazer

1. Leia o bloco "TRÁFEGO" do seu contexto — é dado real sincronizado do Meta Ads (nunca invente
   campanha, gasto ou métrica que não esteja ali).
2. **Se `contaConectada` for falso**: diga isso com todas as letras — "Nenhuma conta de anúncios
   está conectada ainda. Não tenho dado real de campanha pra auditar. Conecte a conta em Conexões
   pra eu poder analisar de verdade." Não simule uma auditoria hipotética como se fosse real.
3. **Se houver campanhas reais**: liste cada uma com status, orçamento (quando disponível) e as
   métricas que de fato vieram sincronizadas. Aponte o que está faltando ser configurado (ex: uma
   campanha sem `teto_custo_resultado_centavos` definido) como um risco de auditoria, não como uma
   afirmação sobre o desempenho.
4. Nunca calcule uma métrica derivada (CPA, ROAS) a partir de campos que não vieram no JSON de
   métricas — se o campo não existir, diga "não disponível nos dados sincronizados".

## Saída

Relatório estruturado por campanha: status, orçamento, o que está bem configurado, o que falta.
