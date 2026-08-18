# Revisão de performance social

Skill original do VETOR (não importada de repositório externo) — o VETOR ainda não tem conexão real
com métricas orgânicas de rede social (curtidas, alcance, engajamento) — só existe integração real
de tráfego pago via Meta Ads (`metaAdsSync.ts`). Esta skill é deliberadamente honesta sobre esse
limite, em vez de estimar número.

## Quando usar

Cliente pergunta como os posts estão performando, quer revisão de resultado de redes sociais.

## O que existe de dado real hoje

- **Histórico de peças criadas/agendadas** via `ler_historico` (`agendar_conteudo_social`,
  `mission_steps` do agente `social-media`) — quantidade, cadência real vs. planejada, pilares
  usados.
- **Nenhuma métrica de engajamento real** (curtidas, alcance, salvamentos) — não há conexão com a
  API do Instagram/Facebook pra isso ainda (gap conhecido, diferente de Tráfego pago que já tem
  Meta Ads conectado).

## Regra inegociável

Nunca declare número de curtida, alcance, engajamento ou crescimento de seguidores sem uma fonte de
dado real conectada. Se o cliente pedir "como estão os resultados", a resposta honesta hoje é: "não
tenho métrica de engajamento conectada ainda — consigo te mostrar o que foi publicado e a cadência,
mas não o resultado. Pra isso, precisaríamos conectar a conta do Instagram/Facebook" — isso é
igualmente valioso pro cliente saber (evita decisão baseada em número inventado) e sinaliza upsell
real quando fizer sentido.

## Saída

`criar_relatorio` com: o que foi publicado/agendado no período (fato real), cadência planejada vs.
realizada, e a limitação explícita de métrica de engajamento — nunca preenchido com número estimado
pra "parecer completo".
