# Smoke test real de voz — prova (Fase E)

**Executado em:** 2026-08-26 19:55 UTC, em produção (`painel.vetormkt.online`), cliente de teste
`15dfc324-c0ad-4fec-977f-33c6ea3c3624`. Chamadas feitas via `fetch()` real dentro do navegador já
autenticado (sessão de cookie real, não simulada).

## Passo 1 — TTS real (`POST /api/voz/falar`)

**Texto enviado:** "Oi, aqui é o Vetor. Isso é um teste real de voz."

**Resultado: ✅ sucesso real.** HTTP 200, `content-type: application/json`, corpo
`{"audioBase64": "T2dnUwACAAAA..."}`. Os primeiros bytes decodificados de base64 são `OggS` seguido
de `OpusHead` — confirma um arquivo Ogg/Opus real e válido, não um placeholder. Isto é a primeira
evidência real de produção de que o provider de TTS (Fish, conforme `STATUS-REAL-ATUAL.md`) está
ativo e funcionando — `STATUS-REAL-ATUAL.md` (19/08) já dizia ter credenciais reais mas **zero
evidência de uso real**; esta é essa evidência.

## Passo 2 — round-trip completo (`POST /api/comando/audio`)

O áudio real gerado no Passo 1 foi reenviado como `audio_base64` com `mime_type: "audio/ogg"` (mapeia
pra extensão `.ogg`, um dos formatos aceitos pela OpenAI Whisper segundo
`apps/agentes/src/integrations/transcricao.ts::extensaoParaTranscricao` — não é problema de formato).

**Resultado: ❌ falhou, de forma honesta (não um fake pass).** HTTP 200 (a rota em si não quebrou),
mas o corpo veio:
```json
{
  "conversationId": "2ae38cd7-ac76-4001-9545-e05bb2199c9c",
  "requestId": "962f9583-405f-4c48-943c-6eed47dbccdc",
  "solicitacaoId": "aef5ea56-fe97-4119-b85c-41263910c0a0",
  "respostaTexto": "Recebi seu áudio, mas ainda não consigo ouvir por aqui — pode escrever a mesma coisa em texto? 🙏"
}
```
Essa é a mensagem de fallback deliberada de `apps/agentes/src/agents/vetorPlataforma.ts:568-570` —
disparada quando `transcreverAudio()` lança qualquer erro. Confirmado via SQL: a `solicitacoes` row
correspondente (`id = aef5ea56-fe97-4119-b85c-41263910c0a0`) tem `status = "failed"`,
`transcricao = null`.

## Diagnóstico (honesto, sem acesso a log de servidor)

Não tenho acesso ao stdout de produção do serviço `apps/agentes` (o `console.error` real da falha
fica só lá), então não posso confirmar a causa exata com certeza. Duas hipóteses reais, nenhuma
descartável sem o log:
1. **Mais provável**: falha na chamada real à API da OpenAI (`whisper-1`) — quota/crédito ou chave
   inválida em produção, o mesmo tipo de incidente que já aconteceu hoje com a API da Anthropic
   (créditos esgotados no meio de um teste anterior nesta sessão).
2. Menos provável dado o código: `STT_PROVIDER` não estar de fato setado como `"openai"` em produção
   apesar do que `STATUS-REAL-ATUAL.md` registrou em 19/08 — nesse caso `isSandbox()` seria `true` e
   o erro seria `TranscricaoIndisponivelError("STT_PROVIDER não configurado...")`, mesmo efeito
   observável (cai no mesmo catch/fallback).

**Não fiz nenhum ajuste de código pra "consertar" isso** — não é um bug de formato/parsing que eu
possa corrigir sem acesso às variáveis de ambiente reais de produção. Fica registrado como bloqueio
real de credencial/configuração, a ser confirmado por quem tem acesso ao painel do DigitalOcean
(`vetor-agentes`, variáveis de ambiente) ou aos logs do serviço.

## Conclusão

- **TTS**: provado real, funcionando, em produção. ✅
- **STT (e portanto o loop completo voz→texto→resposta→fala)**: ainda não provado — falha real,
  documentada, causa provável (não confirmada) é credencial/quota da OpenAI. ❌
