// Gateway de geração de imagem pro agente de Design — nenhum agente/skill
// chama um provedor externo direto (princípio do Skill Registry: sempre por
// adapter). Hoje só um provider real (OpenAI); trocar de provedor é trocar
// só este arquivo, sem tocar em specialistRunner.ts nem nos prompts.

export class ImagemIndisponivelError extends Error {}

export interface ImagemGerada {
  bytes: Buffer;
  mimeType: string;
}

function tamanhoOpenAI(aspectRatio?: string): string {
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

async function gerarImagemOpenAI(prompt: string, aspectRatio?: string): Promise<ImagemGerada> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: tamanhoOpenAI(aspectRatio),
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

// IMAGE_PROVIDER escolhe o provedor configurado pelo sistema — hoje só
// "openai" está implementado de verdade; qualquer outro valor falha fechado
// em vez de silenciosamente cair pra um provider errado.
export async function gerarImagem(prompt: string, opcoes: { aspectRatio?: string } = {}): Promise<ImagemGerada> {
  const provider = process.env.IMAGE_PROVIDER ?? "openai";
  try {
    if (provider === "openai") return await gerarImagemOpenAI(prompt, opcoes.aspectRatio);
    throw new Error(`IMAGE_PROVIDER "${provider}" não suportado.`);
  } catch (err) {
    throw err instanceof ImagemIndisponivelError ? err : new ImagemIndisponivelError(err instanceof Error ? err.message : "erro desconhecido");
  }
}
