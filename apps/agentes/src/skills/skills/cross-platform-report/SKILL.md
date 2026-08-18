# Relatório multi-plataforma

Skill original do VETOR (não importada de repositório externo).

## Limite real desta versão

O VETOR hoje só tem sincronização real com o **Meta Ads** (`connections` com `provider =
'meta_ads'`). Google Ads é mencionado como "futuro" no prompt deste agente, mas não existe
integração de fato nesta versão. Um relatório "multi-plataforma" honesto, hoje, é: Meta Ads com
dado real + as demais plataformas listadas como "não conectada" — nunca um número estimado ou
inventado pra preencher a lacuna.

## Quando usar

O cliente pede uma visão consolidada de tráfego pago que soa como se cobrisse mais de uma
plataforma.

## O que fazer

1. Reporte o Meta Ads com os dados reais do bloco "TRÁFEGO" (mesma lógica de `account-audit-read-
   only`).
2. Para qualquer outra plataforma mencionada (Google Ads, TikTok Ads, etc.), declare explicitamente
   que não há integração conectada nesta versão do VETOR — sugira registrar isso como necessidade
   futura em vez de simular dado.
3. Nunca some/compare métricas de plataformas diferentes quando só uma tem dado real — isso
   distorceria a leitura do cliente.

## Saída

Relatório com uma seção por plataforma: Meta Ads (dado real, ou "sem conta conectada") e as demais
explicitamente marcadas como não integradas.
