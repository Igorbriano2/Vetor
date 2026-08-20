// Gateway de geração de imagem pro agente de Design — nenhum agente/skill
// chama um provedor externo direto (princípio do Skill Registry: sempre por
// adapter). Dois provedores reais hoje (OpenAI, Google Gemini "Nano Banana");
// trocar/adicionar provedor é trocar só este arquivo, sem tocar em
// specialistRunner.ts nem nos prompts.
//
// Roteado via ProviderRouter (mesmo padrão de tts.ts): o provedor preferido
// (vindo do briefing, ver ContextoChamadaFerramenta em specialistRunner.ts)
// entra primeiro, o outro provedor real e configurado entra como FALLBACK
// automático — se um provider estiver fora do ar/sem crédito, a geração
// degrada pro outro em vez de falhar a etapa inteira. Achado real desta
// sessão: a conta OpenAI ficou sem crédito em produção e travou toda
// geração de imagem de Design até este fallback existir.
//
// Nota sobre Anthropic: Claude não tem uma API de geração de imagem (só
// entende/analisa imagem — já usado em DesignCritic e na análise de
// referências). Não foi incluído aqui por não existir de verdade, não por
// omissão.

import { executarComFallback, TodosOsProvedoresFalharamError, type ProvedorRegistrado } from "../providers/router.js";

export class ImagemIndisponivelError extends Error {}

export interface ImagemGerada {
  bytes: Buffer;
  mimeType: string;
}

// Exportada pra design_projects (Parte 1) usar a mesma dimensão real ao
// montar o canvasJson — nunca duplica esse mapeamento em outro lugar, senão
// o tamanho do canvas diverge do tamanho real do PNG gerado. Só se aplica
// quando o provedor que respondeu foi a OpenAI (Gemini não devolve
// width/height fixos por "size", ver dimensãoRealDoPng em designProjects.ts
// pra quem decodifica a imagem de verdade).
export function tamanhoOpenAI(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "9:16":
    case "4:5":
      return "1024x1536";
    case "16:9":
      return "1536x1024";
    default:
      return "1024x1024";
  }
}

interface InputGeracao {
  prompt: string;
  aspectRatio?: string;
}

interface InputGeracaoComReferencia {
  prompt: string;
  referencias: ReferenciaImagem[];
  aspectRatio?: string;
}

async function gerarImagemOpenAI(input: InputGeracao): Promise<ImagemGerada> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: input.prompt,
      size: tamanhoOpenAI(input.aspectRatio),
      n: 1,
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Falha ao gerar imagem (OpenAI, ${res.status}): ${texto}`);
  }

  const dados = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = dados.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI não retornou imagem (b64_json ausente).");

  return { bytes: Buffer.from(b64, "base64"), mimeType: "image/png" };
}

// Google Gemini — modelo "gemini-2.5-flash-image" (nome público "Nano
// Banana"), API direta (generativelanguage.googleapis.com, autenticação só
// por API key, sem OAuth/service account) — mesmo estilo de integração das
// outras (chamada HTTP crua, sem SDK). GEMINI_IMAGE_MODEL configurável via
// env pra nunca exigir um deploy de código se o nome do modelo mudar.
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

interface GeminiParteResposta {
  inlineData?: { mimeType?: string; data?: string };
}

function extrairImagemDaRespostaGemini(dados: unknown, contexto: string): ImagemGerada {
  const partes = (dados as { candidates?: Array<{ content?: { parts?: GeminiParteResposta[] } }> })?.candidates?.[0]
    ?.content?.parts;
  const parteImagem = partes?.find((p) => p.inlineData?.data);
  const b64 = parteImagem?.inlineData?.data;
  if (!b64) throw new Error(`Gemini não retornou imagem (inlineData ausente) ${contexto}.`);
  return { bytes: Buffer.from(b64, "base64"), mimeType: parteImagem?.inlineData?.mimeType ?? "image/png" };
}

async function gerarImagemGemini(input: InputGeracao): Promise<ImagemGerada> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: input.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        ...(input.aspectRatio ? { imageConfig: { aspectRatio: input.aspectRatio } } : {}),
      },
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Falha ao gerar imagem (Gemini/Nano Banana, ${res.status}): ${texto}`);
  }

  return extrairImagemDaRespostaGemini(await res.json(), "na geração");
}

const PROVEDOR_OPENAI: ProvedorRegistrado<InputGeracao, ImagemGerada> = {
  nome: "openai",
  disponivel: () => !!process.env.OPENAI_API_KEY,
  executar: gerarImagemOpenAI,
};

const PROVEDOR_GEMINI: ProvedorRegistrado<InputGeracao, ImagemGerada> = {
  nome: "gemini",
  disponivel: () => !!process.env.GEMINI_API_KEY,
  executar: gerarImagemGemini,
};

// Ordem: o preferido (vindo do briefing) primeiro, o outro como fallback
// automático. Sem preferência, OpenAI continua o padrão de produção — Gemini
// entra como rede de segurança, não substitui silenciosamente o default.
function montarCadeia(providerPreferido: string | undefined): ProvedorRegistrado<InputGeracao, ImagemGerada>[] {
  if (providerPreferido === "gemini") return [PROVEDOR_GEMINI, PROVEDOR_OPENAI];
  return [PROVEDOR_OPENAI, PROVEDOR_GEMINI];
}

// IMAGE_PROVIDER (env) continua funcionando como preferência global; o
// parâmetro `provider` (por chamada, vindo do briefing na hora da criação —
// Fase 5 do reset de produto) tem prioridade quando presente.
export async function gerarImagem(prompt: string, opcoes: { aspectRatio?: string; provider?: string } = {}): Promise<ImagemGerada> {
  const preferido = opcoes.provider ?? process.env.IMAGE_PROVIDER;
  try {
    const { resultado, provedorUsado, tentativas } = await executarComFallback(montarCadeia(preferido), {
      prompt,
      aspectRatio: opcoes.aspectRatio,
    });
    if (preferido && provedorUsado !== preferido) {
      console.warn(`[imageProvider] fallback: provedor preferido "${preferido}" indisponível/falhou, usado "${provedorUsado}" em vez dele. Tentativas: ${JSON.stringify(tentativas)}`);
    }
    return resultado;
  } catch (err) {
    if (err instanceof TodosOsProvedoresFalharamError) throw new ImagemIndisponivelError(err.message);
    throw err instanceof ImagemIndisponivelError ? err : new ImagemIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
  }
}

export interface ReferenciaImagem {
  bytes: Buffer;
  mimeType: string;
  nome: string;
}

// image-to-image de verdade — compõe a peça a partir de arquivo(s) reais do
// Drive (ex: a logo oficial do cliente), não só uma descrição em texto
// esperando o modelo "desenhar" a marca de memória. Único jeito honesto de
// garantir que a logo REAL apareça na peça (ver POST /v1/images/edits,
// campo image[], até 16 imagens de referência no gpt-image-1; no Gemini as
// referências entram como partes de imagem na mesma mensagem multimodal).
async function gerarImagemComReferenciaOpenAI(input: InputGeracaoComReferencia): Promise<ImagemGerada> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");
  if (input.referencias.length === 0) throw new Error("gerarImagemComReferencia chamado sem nenhuma referência.");

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", input.prompt);
  form.append("size", tamanhoOpenAI(input.aspectRatio));
  for (const ref of input.referencias) {
    form.append("image[]", new Blob([ref.bytes], { type: ref.mimeType }), ref.nome);
  }

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Falha ao editar imagem com referência (OpenAI, ${res.status}): ${texto}`);
  }

  const dados = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = dados.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI não retornou imagem (b64_json ausente) na edição com referência.");

  return { bytes: Buffer.from(b64, "base64"), mimeType: "image/png" };
}

async function gerarImagemComReferenciaGemini(input: InputGeracaoComReferencia): Promise<ImagemGerada> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");
  if (input.referencias.length === 0) throw new Error("gerarImagemComReferencia chamado sem nenhuma referência.");

  const partesImagem = input.referencias.map((ref) => ({
    inlineData: { mimeType: ref.mimeType, data: ref.bytes.toString("base64") },
  }));

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [...partesImagem, { text: input.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        ...(input.aspectRatio ? { imageConfig: { aspectRatio: input.aspectRatio } } : {}),
      },
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Falha ao editar imagem com referência (Gemini/Nano Banana, ${res.status}): ${texto}`);
  }

  return extrairImagemDaRespostaGemini(await res.json(), "na edição com referência");
}

const PROVEDOR_OPENAI_REF: ProvedorRegistrado<InputGeracaoComReferencia, ImagemGerada> = {
  nome: "openai",
  disponivel: () => !!process.env.OPENAI_API_KEY,
  executar: gerarImagemComReferenciaOpenAI,
};

const PROVEDOR_GEMINI_REF: ProvedorRegistrado<InputGeracaoComReferencia, ImagemGerada> = {
  nome: "gemini",
  disponivel: () => !!process.env.GEMINI_API_KEY,
  executar: gerarImagemComReferenciaGemini,
};

function montarCadeiaComReferencia(providerPreferido: string | undefined): ProvedorRegistrado<InputGeracaoComReferencia, ImagemGerada>[] {
  if (providerPreferido === "gemini") return [PROVEDOR_GEMINI_REF, PROVEDOR_OPENAI_REF];
  return [PROVEDOR_OPENAI_REF, PROVEDOR_GEMINI_REF];
}

export async function gerarImagemComReferencia(
  prompt: string,
  referencias: ReferenciaImagem[],
  opcoes: { aspectRatio?: string; provider?: string } = {},
): Promise<ImagemGerada> {
  const preferido = opcoes.provider ?? process.env.IMAGE_PROVIDER;
  try {
    const { resultado, provedorUsado, tentativas } = await executarComFallback(montarCadeiaComReferencia(preferido), {
      prompt,
      referencias,
      aspectRatio: opcoes.aspectRatio,
    });
    if (preferido && provedorUsado !== preferido) {
      console.warn(`[imageProvider] fallback (com referência): provedor preferido "${preferido}" indisponível/falhou, usado "${provedorUsado}" em vez dele. Tentativas: ${JSON.stringify(tentativas)}`);
    }
    return resultado;
  } catch (err) {
    if (err instanceof TodosOsProvedoresFalharamError) throw new ImagemIndisponivelError(err.message);
    throw err instanceof ImagemIndisponivelError ? err : new ImagemIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
  }
}
