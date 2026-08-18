# Checagem de atribuição

Skill original do VETOR (não importada de repositório externo).

## Quando usar

Antes de confiar em métricas de conversão pra qualquer recomendação de orçamento ou análise de
campanha — ou quando o cliente pergunta diretamente se o rastreamento está funcionando.

## O que fazer

1. Olhe o campo `actions` dentro de `metricas` de cada campanha real no bloco "TRÁFEGO".
2. **Se `actions` estiver ausente ou vazio em campanhas com gasto real (`spend` > 0)**: isso é um
   sinal de alerta de atribuição — o pixel/evento de conversão pode não estar disparando. Reporte
   isso como um risco concreto, não como uma afirmação definitiva de que está quebrado (você não
   tem acesso direto ao Gerenciador de Eventos do Meta, só ao que já veio sincronizado).
3. **Se `actions` tiver dados**: descreva o que está sendo contado (tipo de ação, volume) sem
   inflar a confiança — mencione que a leitura é baseada só no que a API devolveu.
4. Nunca afirme "a atribuição está correta" ou "o pixel está funcionando perfeitamente" — o máximo
   que dá pra dizer com honestidade é "os dados sincronizados mostram eventos de conversão sendo
   registrados" ou o oposto.

## Saída

Relatório curto: por campanha, há ou não evidência de evento de conversão nos dados sincronizados,
e a recomendação de verificar manualmente o Gerenciador de Eventos quando o sinal for de risco.
