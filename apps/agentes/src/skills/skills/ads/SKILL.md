# Estratégia de anúncios (Meta)

Adaptado de `ads` (coreyhaines31/marketingskills, MIT) — o original cobre Google Ads, LinkedIn,
TikTok, Twitter/X, ABM, Performance Max, RSA e integrações MCP de várias plataformas. O Vetor
integra só o Meta Ads (Instagram/Facebook, ver `connections/metaAdsSync.ts`) — cortado todo o
resto. Cortada também toda menção a ação automática (criar campanha, ajustar lance, escalar
orçamento sozinho): essa skill só produz RECOMENDAÇÃO pro Agente de Tráfego, nunca executa —
`ajustar_orcamento_trafego`/`criar_campanha_trafego`/`criar_audiencia` são ferramentas críticas,
fora do alcance de qualquer skill deste departamento.

## Quando usar

Cliente já tem (ou vai ter) conta de anúncios conectada no Meta e pede ajuda pra estruturar
campanha, escrever/testar criativo, ou entender por que um anúncio não está performando.

## Fórmulas de copy

- **PAS (Problema-Agitação-Solução)**: [problema] → [agita a dor] → [apresenta a solução] → [CTA]
- **BAB (Antes-Depois-Ponte)**: [estado atual incômodo] → [estado desejado] → [o produto/serviço
  como ponte]
- **Prova social primeiro**: [número/depoimento forte] → [o que você faz] → [CTA]

## Estrutura de vídeo (15-30s)

1. Gancho (0-3s): pergunta, dado surpreendente ou corte seco — decide se a pessoa continua vendo
2. Problema (3-8s): a dor real do público, em linguagem que ele usa
3. Solução (8-20s): mostra o produto/serviço resolvendo
4. CTA (20-30s): uma ação só, clara ("chama no WhatsApp", "peça pelo link na bio")

**Sempre com legenda embutida** — a maioria assiste sem som. Vertical pra Stories/Reels, quadrado
pro feed.

## Testes de criativo — o que testar primeiro

Ordem de impacto (teste isso antes de mexer no resto):
1. Conceito/ângulo da peça (maior impacto)
2. Gancho/primeira linha
3. Estilo visual
4. Texto do corpo
5. CTA

Recomende sempre pelo menos 2-3 variações de criativo por campanha — uma peça só nunca dá sinal
suficiente pra saber o que funciona.

## Ritmo de orçamento (disciplina, não escalar demais de uma vez)

- Fase de teste (2-4 primeiras semanas): a maior parte do orçamento em campanha já validada, uma
  fatia menor testando público/criativo novo.
- Fase de escala: aumentar orçamento aos poucos — nunca mais que ~20% de uma vez, e esperar alguns
  dias entre aumentos (o algoritmo do Meta precisa reaprender a cada mudança grande).
- Nunca recomende pausar e reativar uma campanha repetidamente — isso reseta o aprendizado do
  algoritmo e piora o resultado.

## Remarketing por estágio de funil

| Estágio | Quem já interagiu | Mensagem |
|---|---|---|
| Quente | Clicou no anúncio recente, mandou mensagem | Urgência, remove última objeção |
| Morno | Visitou o perfil/viu stories | Prova social, mostra mais do produto |
| Frio | Só viu o anúncio uma vez | Educativo, reforça a marca |

Sempre excluir quem já é cliente recorrente do remarketing de primeira compra — mostrar a mesma
oferta de "primeira compra" pra quem já compra sempre desperdiça verba.

## Erros comuns a sinalizar

- Anúncio sem nenhum tipo de rastreio de resultado (sem saber quantos pedidos vieram, não dá pra
  saber se compensa)
- Público bom demais restrito (interesses empilhados demais) quando o criativo já é específico o
  bastante — deixar o algoritmo achar a pessoa certa costuma performar melhor que restringir tudo
  manualmente
- Um criativo só rodando por semanas sem variação (fadiga)
- Mudar orçamento ou pausar toda hora, sem deixar o algoritmo aprender

## Saída

`criar_relatorio` com a análise/diagnóstico (usando só dado real já sincronizado, nunca
inventado) e `criar_briefing` com a recomendação de estrutura/copy/teste — sempre deixando claro
que qualquer criação/alteração de campanha real precisa passar por aprovação humana antes de
acontecer.
