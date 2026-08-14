import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt } from "./prompts/index.js";
import { processarComAgente, type ContextoCliente } from "./core.js";
import { transcreverAudio, TranscricaoIndisponivelError } from "../integrations/transcricao.js";
import { sintetizarFala, SinteseVozIndisponivelError } from "../integrations/tts.js";

async function buscarCliente(clienteId: string): Promise<(ContextoCliente & { plano_id: string | null }) | null> {
  const { data } = await supabase
    .from("clientes")
    .select("id, nome_empresa, nicho, plano_id")
    .eq("id", clienteId)
    .maybeSingle();
  return data ?? null;
}

async function historicoConversa(clienteId: string): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabase
    .from("mensagens_plataforma")
    .select("direcao, texto")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: true })
    .limit(20);

  return (data ?? []).map((m) => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.texto,
  }));
}

async function salvarMensagem(clienteId: string, direcao: "entrada" | "saida", texto: string) {
  await supabase.from("mensagens_plataforma").insert({ cliente_id: clienteId, direcao, texto });
}

export interface RespostaPlataforma {
  respostaTexto: string;
  audioBase64?: string;
}

// Canal do Vetor dentro do painel: o cliente já está autenticado, então não há
// qualificação de lead como no WhatsApp — ele fala direto com o agente geral.
export async function processarMensagemPlataforma(
  clienteId: string,
  texto: string,
  opcoes: { responderEmVoz?: boolean } = {},
): Promise<RespostaPlataforma> {
  const cliente = await buscarCliente(clienteId);
  await salvarMensagem(clienteId, "entrada", texto);

  const historico = await historicoConversa(clienteId);

  const systemPrompt = cliente
    ? `${getSystemPrompt("vetor")}\n\nCliente autenticado no painel: ${cliente.nome_empresa} (nicho: ${cliente.nicho}, plano: ${cliente.plano_id ?? "não definido"}). Ele já é cliente pagante — não qualifique como lead, vá direto ao ponto.`
    : `${getSystemPrompt("vetor")}\n\nNão foi possível identificar o cliente autenticado — avise que algo está errado no cadastro e sugira falar com o suporte.`;

  const resultado = await processarComAgente({
    agente: "vetor",
    systemPrompt,
    historico,
    cliente,
    origemLabel: "painel Vetor",
  });

  await salvarMensagem(clienteId, "saida", resultado.respostaTexto);

  const resposta: RespostaPlataforma = { respostaTexto: resultado.respostaTexto };

  if (opcoes.responderEmVoz) {
    try {
      const audio = await sintetizarFala(resultado.respostaTexto);
      resposta.audioBase64 = Buffer.from(audio.bytes).toString("base64");
    } catch (err) {
      if (!(err instanceof SinteseVozIndisponivelError)) throw err;
      // sandbox/sem provedor configurado: devolve só o texto, sem travar o chat.
    }
  }

  return resposta;
}

export async function processarAudioPlataforma(
  clienteId: string,
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<RespostaPlataforma> {
  try {
    const transcricao = await transcreverAudio(bytes, mimeType);
    return await processarMensagemPlataforma(clienteId, transcricao, { responderEmVoz: true });
  } catch (err) {
    if (err instanceof TranscricaoIndisponivelError) {
      return {
        respostaTexto:
          "Recebi seu áudio, mas ainda não consigo ouvir por aqui — pode escrever a mesma coisa em texto? 🙏",
      };
    }
    throw err;
  }
}
