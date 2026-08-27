"use client";

import { useEffect, useRef, useState } from "react";
import VetorCore from "./VetorCore";
import VetorIntentCard, { type MissaoProposta } from "./VetorIntentCard";
import { readApiResponse } from "@/lib/api/readApiResponse";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { lerConversationId, salvarConversationId } from "@/lib/conversation";

interface RespostaComando {
  conversationId: string;
  solicitacaoId: string;
  respostaTexto: string;
  audioBase64?: string;
  intent?: MissaoProposta;
}

interface Mensagem {
  autor: "cliente" | "vetor";
  texto: string;
  audioBase64?: string;
  intent?: MissaoProposta;
  solicitacaoId?: string;
}

const COMANDOS_RAPIDOS = [
  "Preciso de posts pra essa semana",
  "Quero um relatório do último mês",
  "Preciso de uma peça de design",
];

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultado = reader.result as string;
      resolve(resultado.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Evoluído de ComandoVetor: além do chat texto/voz, agora tem chips de comando
// rápido e renderiza VetorIntentCard quando o Vetor propõe uma missão.
// Anexos ficam fora desta rodada — precisam de storage S3, não provisionado.
export default function VetorCommandBar() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Guardado em ref (não em state) porque só é lido dentro de callbacks de
  // rede, nunca renderizado diretamente — evita re-render a cada resposta.
  const conversationIdRef = useRef<string | undefined>(undefined);

  // Recupera a conversa em aberto ao recarregar a página: lê o
  // conversationId salvo nesta aba e repõe o histórico de texto já trocado
  // (RLS já isola por cliente). O card de proposta de missão em si não é
  // reconstruído — só a estrutura de texto persiste hoje.
  useEffect(() => {
    const conversationId = lerConversationId();
    if (!conversationId) return;
    conversationIdRef.current = conversationId;

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("mensagens_plataforma")
        .select("direcao, texto")
        .eq("conversa_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      if (data && data.length > 0) {
        setMensagens(
          data.map((m) => ({
            autor: m.direcao === "entrada" ? "cliente" : "vetor",
            texto: m.texto,
          })),
        );
      }
    })();
  }, []);

  function guardarConversationId(id: string) {
    conversationIdRef.current = id;
    salvarConversationId(id);
  }

  async function tocarAudio(base64: string) {
    const audio = new Audio(`data:audio/ogg;base64,${base64}`);
    audioRef.current = audio;
    try {
      await audio.play();
    } catch {
      // autoplay pode ser bloqueado pelo navegador — sem problema, o texto já está na tela.
    }
  }

  async function enviarTexto(conteudoForcado?: string) {
    const conteudo = (conteudoForcado ?? texto).trim();
    if (!conteudo || enviando) return;

    setTexto("");
    setErro(null);
    setEnviando(true);
    setMensagens((atual) => [...atual, { autor: "cliente", texto: conteudo }]);

    try {
      const res = await fetch("/api/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: conteudo,
          responder_em_voz: false,
          conversationId: conversationIdRef.current,
        }),
      });
      const data = await readApiResponse<RespostaComando>(res);
      guardarConversationId(data.conversationId);
      setMensagens((atual) => [
        ...atual,
        { autor: "vetor", texto: data.respostaTexto, intent: data.intent, solicitacaoId: data.solicitacaoId },
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui falar com o Vetor agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function iniciarGravacao() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await enviarAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
    } catch {
      setErro("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  }

  async function enviarAudio(blob: Blob) {
    setEnviando(true);
    setMensagens((atual) => [...atual, { autor: "cliente", texto: "🎤 mensagem de voz" }]);

    try {
      const audioBase64 = await blobParaBase64(blob);
      const res = await fetch("/api/comando/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: audioBase64,
          mime_type: blob.type || "audio/webm",
          conversationId: conversationIdRef.current,
        }),
      });
      const data = await readApiResponse<RespostaComando>(res);
      guardarConversationId(data.conversationId);
      setMensagens((atual) => [
        ...atual,
        {
          autor: "vetor",
          texto: data.respostaTexto,
          audioBase64: data.audioBase64,
          intent: data.intent,
          solicitacaoId: data.solicitacaoId,
        },
      ]);
      if (data.audioBase64) await tocarAudio(data.audioBase64);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui processar o áudio agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-3xl panel p-5">
      <div className="flex items-center justify-between">
        <VetorCore estado={enviando ? "executing" : "idle"} compact />
        <span className="font-mono text-[11px] uppercase tracking-wide text-areia/30">Fale com o Vetor</span>
      </div>

      <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
        {mensagens.length === 0 && (
          <>
            <p className="text-sm text-areia/40">
              Manda uma demanda por texto ou áudio — o Vetor entende e já organiza pra você.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMANDOS_RAPIDOS.map((comando) => (
                <button
                  key={comando}
                  onClick={() => enviarTexto(comando)}
                  disabled={enviando}
                  className="rounded-full border border-areia/15 px-3 py-1.5 text-xs text-areia/70 transition hover:border-menta hover:text-menta disabled:opacity-50"
                >
                  {comando}
                </button>
              ))}
            </div>
          </>
        )}
        {mensagens.map((m, i) => (
          <div key={i}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.autor === "cliente"
                  ? "ml-auto bg-menta/15 text-areia"
                  : "bg-petroleo/70 text-areia border border-areia/10"
              }`}
            >
              {m.texto}
              {m.audioBase64 && (
                <button
                  onClick={() => tocarAudio(m.audioBase64!)}
                  className="ml-2 text-xs text-ambar underline underline-offset-2"
                >
                  ouvir de novo
                </button>
              )}
            </div>
            {m.intent && <VetorIntentCard intent={m.intent} solicitacaoId={m.solicitacaoId} />}
          </div>
        ))}
      </div>

      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}

      <div className="mt-4 flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviarTexto()}
          disabled={enviando || gravando}
          placeholder="Digite o que você precisa..."
          className="flex-1 rounded-xl border border-areia/15 bg-petroleo px-4 py-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={gravando ? pararGravacao : iniciarGravacao}
          disabled={enviando}
          aria-label={gravando ? "Parar gravação" : "Gravar áudio"}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition ${
            gravando
              ? "animate-pulse border-coral bg-coral/20 text-coral"
              : "border-areia/15 text-areia/60 hover:border-menta hover:text-menta"
          }`}
        >
          🎤
        </button>
        <button
          onClick={() => enviarTexto()}
          disabled={enviando || gravando || !texto.trim()}
          className="btn-tactile rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
