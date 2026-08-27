// Transcrição do Videomaker (Fase C do prompt de reconstrução,
// docs/AUDITORIA-E-PROMPT-RECONSTRUCAO-2026-08.md Parte 1 item 5) — função
// NOVA e SEPARADA de transcricao.ts (que continua servindo o Agente
// Secretário do WhatsApp via OpenAI Whisper, sem nenhuma mudança). O
// Videomaker usa AssemblyAI porque devolve timestamp por PALAVRA
// (words[]), não só por segmento — decisão explícita pra legenda dinâmica
// sincronizada de verdade, não uma escolha técnica arbitrária.
//
// Fail-closed por design: sem ASSEMBLYAI_API_KEY, lança erro claro em vez
// de devolver legenda vazia disfarçada de sucesso — o estágio "captions"
// já trata esse erro como "pulado com motivo real" (ver specialistRunner.ts).
//
// Auth: header "authorization" com a chave crua, SEM prefixo "Bearer"
// (regra própria da API de transcrição da AssemblyAI — diferente da Voice
// Agent API, que não usamos aqui).

import type { SegmentoTranscrito } from "./transcricao.js";

export class AssemblyAiIndisponivelError extends Error {}

export function assemblyAiConfigurado(): boolean {
  return Boolean(process.env.ASSEMBLYAI_API_KEY);
}

interface PalavraTranscrita {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

interface AssemblyAiTranscriptResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  words?: PalavraTranscrita[];
}

const BASE_URL = "https://api.assemblyai.com";
const INTERVALO_POLL_MS = 3000;
const TIMEOUT_TOTAL_MS = 5 * 60 * 1000;

function apiKeyOuFalha(): string {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new AssemblyAiIndisponivelError("Transcrição do Videomaker não configurada — falta ASSEMBLYAI_API_KEY nas variáveis de ambiente.");
  }
  return apiKey;
}

async function subirAudio(bytes: ArrayBuffer, apiKey: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v2/upload`, {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/octet-stream" },
    body: bytes,
  });
  if (!res.ok) {
    throw new AssemblyAiIndisponivelError(`Falha ao subir áudio pra AssemblyAI (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { upload_url?: string };
  if (!data.upload_url) throw new AssemblyAiIndisponivelError("AssemblyAI não devolveu upload_url.");
  return data.upload_url;
}

async function submeterTranscricao(uploadUrl: string, apiKey: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v2/transcript`, {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: uploadUrl,
      speech_models: ["universal-3-5-pro", "universal-2"],
      language_code: "pt",
    }),
  });
  if (!res.ok) {
    throw new AssemblyAiIndisponivelError(`Falha ao submeter transcrição pra AssemblyAI (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new AssemblyAiIndisponivelError("AssemblyAI não devolveu id de transcrição.");
  return data.id;
}

async function aguardarConclusao(transcriptId: string, apiKey: string): Promise<AssemblyAiTranscriptResponse> {
  const inicio = Date.now();
  while (Date.now() - inicio < TIMEOUT_TOTAL_MS) {
    const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
    });
    if (!res.ok) {
      throw new AssemblyAiIndisponivelError(`Falha ao consultar transcrição na AssemblyAI (${res.status}): ${await res.text().catch(() => "")}`);
    }
    const data = (await res.json()) as AssemblyAiTranscriptResponse;
    if (data.status === "completed") return data;
    if (data.status === "error") throw new AssemblyAiIndisponivelError(`AssemblyAI reportou erro na transcrição: ${data.error ?? "motivo desconhecido"}`);
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_POLL_MS));
  }
  throw new AssemblyAiIndisponivelError(`Transcrição na AssemblyAI não terminou em ${TIMEOUT_TOTAL_MS / 1000}s.`);
}

// Agrupa palavras em segmentos legíveis: quebra por pausa natural (gap >
// 500ms entre o fim de uma palavra e o início da próxima) ou depois de 8
// palavras, o que vier primeiro — nunca uma legenda por palavra isolada
// (ilegível) nem o texto inteiro numa cue só (também ruim de ler). Pura,
// sem I/O, testável com fixtures de words[].
export function agruparPalavrasEmSegmentos(words: PalavraTranscrita[]): SegmentoTranscrito[] {
  const GAP_MAX_MS = 500;
  const PALAVRAS_MAX_POR_SEGMENTO = 8;

  const segmentos: SegmentoTranscrito[] = [];
  let atual: PalavraTranscrita[] = [];

  for (const palavra of words) {
    const anterior = atual[atual.length - 1];
    const houvePausaLonga = anterior !== undefined && palavra.start - anterior.end > GAP_MAX_MS;
    const segmentoCheio = atual.length >= PALAVRAS_MAX_POR_SEGMENTO;

    if (atual.length > 0 && (houvePausaLonga || segmentoCheio)) {
      segmentos.push(fecharSegmento(atual));
      atual = [];
    }
    atual.push(palavra);
  }
  if (atual.length > 0) segmentos.push(fecharSegmento(atual));

  return segmentos;
}

function fecharSegmento(palavras: PalavraTranscrita[]): SegmentoTranscrito {
  return {
    startMs: palavras[0].start,
    endMs: palavras[palavras.length - 1].end,
    text: palavras.map((p) => p.text).join(" "),
  };
}

export async function transcreverComAssemblyAI(bytes: ArrayBuffer): Promise<SegmentoTranscrito[]> {
  const apiKey = apiKeyOuFalha();
  const uploadUrl = await subirAudio(bytes, apiKey);
  const transcriptId = await submeterTranscricao(uploadUrl, apiKey);
  const resultado = await aguardarConclusao(transcriptId, apiKey);
  if (!resultado.words || resultado.words.length === 0) return [];
  return agruparPalavrasEmSegmentos(resultado.words);
}
