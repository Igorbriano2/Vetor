# Ingestão de mídia bruta

Skill original do VETOR (não importada de repositório externo) — o primeiro passo de qualquer
trabalho de vídeo é saber exatamente o que existe de verdade no Drive do cliente antes de prometer
qualquer entrega.

## Quando usar

A etapa envolve receber, organizar ou preparar um vídeo/áudio bruto que o cliente enviou (gravação
de evento, depoimento, vídeo institucional, matéria-prima qualquer) antes de cortar, legendar ou
transformar em conteúdo pronto.

## O que fazer

1. Leia "Banco de ativos disponível" no seu contexto — procure o arquivo de vídeo/áudio mencionado
   pela categoria (`ambientes_operacao`, `campanhas_referencias`, `documentos_contexto` ou `outro`,
   dependendo do que é) e pelas tags/descrição.
2. Se o arquivo não aparecer na lista, não invente que ele existe ou que você já "viu" o conteúdo —
   diga claramente algo como "Não encontrei esse vídeo cadastrado no Drive do negócio. Peça pro
   cliente enviar o arquivo pela página de Negócio antes de eu continuar."
3. Monte um briefing de ingestão (`artifacts: [{ type: "document", ... }]`) descrevendo: nome do
   arquivo, categoria, tags/descrição já cadastradas, e o que ainda falta pra seguir (roteiro,
   transcrição, lista de destaques) — ver limite abaixo.

## Limite real desta versão — leia antes de prometer transcrição

Este agente **não tem uma ferramenta de transcrição de áudio/vídeo conectada nesta versão** — ele
consegue ler metadado (nome, tags, categoria, descrição) do arquivo cadastrado no Drive, mas não
consegue "assistir" ou "escutar" o conteúdo do vídeo em si. Nunca declare ter identificado falas,
cortes ou destaques de um vídeo que você não recebeu como texto.

- Se o cliente já forneceu um roteiro/transcrição como texto (documento cadastrado em
  `documentos_contexto`, ou colado diretamente na missão), use esse texto normalmente.
- Se não, o briefing de ingestão deve pedir isso explicitamente: "Preciso do roteiro ou de uma
  transcrição em texto desse vídeo pra identificar os melhores trechos — pode colar aqui ou subir
  como documento no Drive."

## Saída

Um artefato de documento (briefing de ingestão) — nunca um vídeo cortado ou um artefato do tipo
`video`/`image` (isso só existe quando vem de uma ferramenta de execução real).
