import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../db/supabase.js";
import { getSystemPrompt } from "./prompts/index.js";
import { processarComAgente } from "./core.js";
import {
  sendWhatsappMessage,
  sendWhatsappAudioMessage,
  baixarMidiaWhatsapp,
} from "../integrations/whatsapp.js";
import { transcreverAudio, TranscricaoIndisponivelError } from "../integrations/transcricao.js";
import { sintetizarFala, SinteseVozIndisponivelError } from "../integrations/tts.js";

interface ClienteExistente {
  id: string;
  nome_empresa: string;
  nicho: string;
}

async function buscarClientePorNumero(numero: string): Promise<ClienteExistente | null> {
  const { data } = await supabase
    .from("clientes")
    .select("id, nome_empresa, nicho")
    .eq("whatsapp_numero", numero)
    .maybeSingle();
  return data ?? null;
}

async function historicoConversa(numero: string): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabase
    .from("mensagens_whatsapp")
    .select("direcao, texto")
    .eq("numero", numero)
    .order("created_at", { ascending: true })
    .limit(20);

  return (data ?? []).map((m) => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.texto,
  }));
}

async function salvarMensagem(numero: string, direcao: "entrada" | "saida", texto: string, clienteId: string | null) {
  await supabase.from("mensagens_whatsapp").insert({ numero, direcao, texto, cliente_id: clienteId });
}

export interface OpcoesProcessamento {
  // O cliente perguntou por áudio — responder também em áudio, imitando o canal
  // usado (docs/07, seção 4). Cai pra texto sozinho se a síntese de voz falhar.
  responderEmVoz?: boolean;
}

export async function processarMensagemRecebida(
  numero: string,
  texto: string,
  opcoes: OpcoesProcessamento = {},
): Promise<void> {
  const cliente = await buscarClientePorNumero(numero);
  await salvarMensagem(numero, "entrada", texto, cliente?.id ?? null);

  const historico = await historicoConversa(numero);

  const systemPrompt = cliente
    ? `${getSystemPrompt("secretario")}\n\nCliente já cadastrado: ${cliente.nome_empresa} (nicho: ${cliente.nicho}).`
    : `${getSystemPrompt("secretario")}\n\nEste número ainda não é cliente cadastrado — trate como novo lead.`;

  const resultado = await processarComAgente({
    agente: "secretario",
    systemPrompt,
    historico,
    cliente,
    origemLabel: `WhatsApp (${numero})`,
  });

  await enviarResposta(numero, resultado.respostaTexto, opcoes.responderEmVoz ?? false);
  await salvarMensagem(numero, "saida", resultado.respostaTexto, cliente?.id ?? null);
}

async function enviarResposta(numero: string, texto: string, emVoz: boolean): Promise<void> {
  if (!emVoz) {
    await sendWhatsappMessage(numero, texto);
    return;
  }

  try {
    const audio = await sintetizarFala(texto);
    await sendWhatsappAudioMessage(numero, audio.bytes, audio.mimeType);
  } catch (err) {
    if (err instanceof SinteseVozIndisponivelError) {
      await sendWhatsappMessage(numero, texto);
      return;
    }
    throw err;
  }
}

// Áudio recebido: baixa da Meta Cloud API, transcreve e reaproveita a mesma
// pipeline de processarMensagemRecebida — o restante do fluxo (histórico, tools,
// registro de ticket) não muda, só a origem do texto (docs/07, seção 4). A
// resposta sai em áudio também, espelhando o canal que o cliente usou.
export async function processarAudioRecebido(numero: string, mediaId: string): Promise<void> {
  try {
    const midia = await baixarMidiaWhatsapp(mediaId);
    const transcricao = await transcreverAudio(midia.bytes, midia.mimeType);
    await processarMensagemRecebida(numero, transcricao, { responderEmVoz: true });
  } catch (err) {
    if (err instanceof TranscricaoIndisponivelError) {
      await sendWhatsappMessage(
        numero,
        "Recebi seu áudio, mas ainda não consigo ouvir por aqui — pode escrever a mesma coisa em texto? 🙏",
      );
      return;
    }
    throw err;
  }
}
