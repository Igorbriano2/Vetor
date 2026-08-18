# Treino do modelo de wake word "VETOR"

Esta rodada implementou a arquitetura completa do assistente de voz (interface `WakeWordEngine`,
seleção de provider, máquina de estados, captura de solicitação, integração com o pipeline
existente do painel) — ver `apps/painel/src/lib/voice/`. **Nenhum provider tem hoje um modelo
"VETOR" real e pronto pra produção**, exceto o `browser-speech-fallback` (reconhecimento contínuo
nativo do navegador, que não é detecção local de verdade — ver aviso no topo de
`browserSpeechEngine.ts`). Este documento explica exatamente o que falta pra ativar detecção local
de verdade via `openwakeword-wasm`, e por que essa foi a rota escolhida em vez do Porcupine.

## Por que openWakeWord em vez de Porcupine

- **openWakeWord**: código Apache-2.0. Os modelos pré-treinados de terceiro ("hey jarvis" etc.) são
  CC BY-NC-SA 4.0 (não comercial) — mas os modelos-base de extração de features
  (`melspectrogram.onnx`/`embedding_model.onnx`, derivados de um módulo do Google) são Apache-2.0,
  e servem de base pra treinar um classificador **nosso**, comercial, sem mensalidade.
- **Porcupine**: SDK Apache-2.0, detecção local de verdade, treino de palavra-chave self-serve e
  rápido — mas **não tem mais tier gratuito de produção** (encerrado em 30/06/2026, confirmado em
  pesquisa ao vivo ago/2026). Planos pagos partem de centenas de dólares/mês, com plano
  "Foundation" citado por volta de US$ 6.000. Ativar exigiria negociação comercial antes de
  qualquer código — ver `apps/painel/src/lib/voice/providers/porcupineEngine.ts` pro caminho de
  ativação caso essa decisão de custo seja aprovada no futuro.

## O que falta pra "openwakeword-wasm" funcionar de verdade

`apps/painel/src/lib/voice/providers/openWakeWordEngine.ts` já carrega 3 arquivos `.onnx` de
`apps/painel/public/wake-word/` e roda a inferência local no navegador via `onnxruntime-web`. Faltam
os arquivos em si:

| Arquivo | Origem | Status |
|---|---|---|
| `melspectrogram.onnx` | Release oficial do openWakeWord (Apache-2.0, Google/TFHub) | Baixar, nunca treinar do zero |
| `embedding_model.onnx` | Idem | Baixar, nunca treinar do zero |
| `vetor.onnx` | **Precisa ser treinado** — não existe em nenhum lugar | Pendente |

## Por que o treino não foi tentado neste ambiente

Investigado ao vivo antes de escrever este documento: o extra `openwakeword[full]` (necessário pro
notebook de treino) fixa `tensorflow-cpu==2.8.1` + `onnx-tf==1.10.0` + `onnx==1.14.0` **junto** com
`torch`/`torchaudio`/`speechbrain` no mesmo ambiente — uma combinação de versões antigas e pinadas,
historicamente frágil em macOS/Apple Silicon sem GPU dedicada. Rodar isso aqui (Python 3.9.6, sem
GPU, ambiente de desenvolvimento comum) teria alta chance de travar em conflito de dependência antes
de chegar no treino em si — e mesmo se instalasse, o treino em CPU levaria muito mais que a ~1h
estimada pra GPU do Colab. Por isso o treino real fica documentado como passo manual (Colab, que já
resolve esse ambiente pronto) em vez de uma tentativa aqui com alta chance de gastar tempo sem
resultado.

Confirmado na prática (não só por análise de dependência): `python3 -c "import torch"`,
`import onnxruntime` e `import openwakeword` falham todos com `ModuleNotFoundError` neste ambiente
(Python 3.9.6, sem nenhum pacote de ML instalado), e a única GPU disponível é uma Intel Iris
integrada sem CUDA — reforça que o treino de verdade precisa mesmo do Colab.

O único passo genuinamente possível aqui foi um teste de pronúncia: o macOS tem 9 vozes `pt_BR`
embutidas (`say -v '?'`). Gerei 5 amostras reais da palavra "vetor" (`say -v <voz> -o vetor_<voz>.aiff
"Vetor"`, vozes Luciana/Eddy/Flo/Reed/Sandy) só pra confirmar que a palavra é curta e foneticamente
limpa o bastante pra treinar bem — isso NÃO é treino nem dado de treino usável (são só 5 amostras de
um único TTS, muito longe das milhares recomendadas + augmentação), e os arquivos não foram
commitados no repositório (ficaram só no ambiente local desta sessão). Serve só como sinal de
viabilidade antes de investir a ~1h de Colab, não como substituto do passo a passo abaixo.

## Passo a passo pra treinar "vetor.onnx"

1. Abrir o notebook oficial de treino automático do openWakeWord:
   `https://github.com/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb`
   no Google Colab (GPU gratuita, ~1h de execução conforme a documentação do projeto).
2. Definir a palavra-chave como `vetor` (não `vector`, não `Vetor Marketing` — só a palavra isolada,
   em português). O notebook gera dados de treino sintéticos via text-to-speech; revisar/adicionar
   vozes em português do Brasil na configuração de geração de dados pra pronúncia ficar fiel.
3. Rodar o pipeline de treino (o notebook já baixa `melspectrogram.onnx`/`embedding_model.onnx`
   automaticamente das releases do openWakeWord — não precisam ser baixados à parte).
4. Exportar o classificador treinado como ONNX — o notebook já tem essa opção de exportação.
5. Testar localmente contra gravações reais de pessoas falando "vetor" em português antes de
   considerar pronto — falso positivo/negativo em PT-BR não é coberto pelos exemplos padrão do
   notebook (majoritariamente em inglês).
6. Copiar os 3 arquivos (`melspectrogram.onnx`, `embedding_model.onnx`, o `vetor.onnx` treinado) pra
   `apps/painel/public/wake-word/`.
7. Abrir `apps/painel/src/lib/voice/providers/openWakeWordEngine.ts` e conferir o TODO no final do
   arquivo — `FRAMES_EMPILHADOS_NO_EMBEDDING` (hoje 16, convenção padrão do openWakeWord) precisa
   bater com o shape de entrada real do classificador treinado; ajustar se o notebook usado tiver
   configurado uma janela diferente.
8. Ajustar `sensitivity` (limiar de confiança, hoje 0.5 por padrão) observando a taxa real de falso
   positivo/negativo em uso real — nunca aceitar o valor padrão sem testar.
9. Fazer deploy do painel — a partir daí `selecionarWakeWordEngine()` passa a escolher
   `openwakeword-wasm` automaticamente (é o primeiro da ordem de preferência em
   `apps/painel/src/lib/voice/selectProvider.ts`), sem precisar mudar nenhum código.

## Enquanto isso: o que está funcionando de verdade

- `browser-speech-fallback` (`apps/painel/src/lib/voice/providers/browserSpeechEngine.ts`): usa
  `SpeechRecognition`/`webkitSpeechRecognition` nativo do navegador em modo contínuo, observando o
  transcript em busca de "vetor". Funciona hoje em Chrome/Edge/Safari, sem custo, sem instalação.
  **Não é detecção local** — o Chrome processa o áudio nos servidores do Google. É por isso que a
  spec original trata isso como fallback, não como solução definitiva — mas é o único caminho
  genuinamente funcional sem modelo treinado.
- Todo o resto da arquitetura (captura de solicitação, pipeline de missão, TTS, controles de
  pausar/silenciar/parar/desligar, máquina de estados) é o mesmo independente de qual provider está
  ativo — trocar pra `openwakeword-wasm` no dia em que o modelo existir não muda nada além dos 3
  arquivos `.onnx`.
