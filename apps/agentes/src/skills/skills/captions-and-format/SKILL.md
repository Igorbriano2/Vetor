# Legendas e formatação por canal

Skill original do VETOR (não importada de repositório externo).

## Limite real desta versão

Não existe motor de edição de vídeo conectado (nada de legenda "queimada" nos pixels do vídeo,
corte automático por fala, etc.) — o que esta skill produz é **texto**: a legenda de publicação
(caption) e, quando fizer sentido, o texto de subtítulo sugerido para quem for editar manualmente.
Nunca declare que a legenda foi aplicada dentro do arquivo de vídeo.

## Quando usar

Um vídeo (real, gerado por `gerar_video_higgsfield`, ou já existente no Drive) precisa da legenda de
publicação pro canal de destino.

## O que fazer

1. Leia o brand kit (tom de voz) e o objetivo da missão.
2. Escreva a legenda respeitando as convenções do canal:
   - **Reels/TikTok/Shorts**: gancho nas 3 primeiras palavras, frases curtas, CTA claro no fim.
   - **Feed/YouTube**: pode ser mais descritivo, mas sem enrolar antes do ponto principal.
3. Se o vídeo tiver fala relevante (vindo de `transcript-and-highlights`), sugira também o texto de
   subtítulo linha a linha — deixando explícito que é uma sugestão pra aplicação manual ou por uma
   ferramenta de edição fora do VETOR, não um arquivo já legendado.
4. Inclua hashtags/menções só se fizerem sentido pro nicho do cliente — nunca um pacote genérico.

## Saída

Artefato de documento com: legenda final, variações curtas (se pedido), e texto de subtítulo
sugerido quando aplicável.
