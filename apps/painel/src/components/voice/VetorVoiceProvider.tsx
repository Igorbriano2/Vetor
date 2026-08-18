"use client";

// Controlador global do assistente de voz do VETOR — uma única instância por
// sessão, montada no layout autenticado (VetorAppShell) pra funcionar em
// qualquer aba/página. Nunca monta fora da árvore autenticada: ao deslogar,
// o componente desmonta e o cleanup do useEffect para o engine e solta o
// microfone — "não escutar após logout" sai de graça da árvore de React, não
// precisa de lógica extra pra detectar logout aqui.
//
// Fluxo: wake word (local ou fallback do navegador) -> beep de confirmação
// -> captura da solicitação (MediaRecorder até silêncio) -> mesmo pipeline
// autenticado do Command Bar (/api/comando/audio, origem "voice_wake_word")
// -> resposta em texto/voz -> volta a standby.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { MissaoProposta } from "../VetorIntentCard";
import { readApiResponse } from "@/lib/api/readApiResponse";
import { lerConversationId, salvarConversationId } from "@/lib/conversation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { capturarSolicitacaoDeVoz, tocarBipDeConfirmacao } from "@/lib/voice/audioCapture";
import { selecionarWakeWordEngine, NenhumProviderDisponivelError } from "@/lib/voice/selectProvider";
import { podeTransicionar, transicionarVoz } from "@/lib/voice/stateMachine";
import type { VoiceState, WakeWordEngine, WakeWordProvider } from "@/lib/voice/types";

const CHAVE_VOZ_ATIVADA = "vetor:voiceEnabled";

interface RespostaComando {
  conversationId: string;
  solicitacaoId: string;
  respostaTexto: string;
  audioBase64?: string;
  intent?: MissaoProposta;
}

interface VetorVoiceContextValue {
  state: VoiceState;
  provider: WakeWordProvider | null;
  amplitude: number;
  error: string | null;
  muted: boolean;
  lastResponseText: string | null;
  lastIntent: MissaoProposta | null;
  lastSolicitacaoId: string | null;
  suportado: boolean;
  ligar: () => Promise<void>;
  desligar: () => void;
  pausar: () => void;
  retomar: () => void;
  alternarMudo: () => void;
  pararTurnoAtual: () => void;
  limparResposta: () => void;
}

const VetorVoiceContext = createContext<VetorVoiceContextValue | null>(null);

export function useVetorVoice(): VetorVoiceContextValue {
  const ctx = useContext(VetorVoiceContext);
  if (!ctx) throw new Error("useVetorVoice() precisa estar dentro de <VetorVoiceProvider>.");
  return ctx;
}

export default function VetorVoiceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VoiceState>("disabled");
  const [provider, setProvider] = useState<WakeWordProvider | null>(null);
  const [amplitude, setAmplitude] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [lastResponseText, setLastResponseText] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<MissaoProposta | null>(null);
  const [lastSolicitacaoId, setLastSolicitacaoId] = useState<string | null>(null);

  const engineRef = useRef<WakeWordEngine | null>(null);
  const cancelarCapturaRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const desmontadoRef = useRef(false);
  const stateRef = useRef<VoiceState>("disabled");
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const mutedRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const irPara = useCallback((proximo: VoiceState) => {
    if (desmontadoRef.current) return;
    setState((atual) => {
      if (atual === proximo) return atual;
      if (!podeTransicionar(atual, proximo)) {
        console.error(`[voice] transição ignorada (inválida): "${atual}" -> "${proximo}"`);
        return atual;
      }
      return transicionarVoz(atual, proximo);
    });
  }, []);

  // --- ciclo de vida do engine -------------------------------------------

  const pararEngine = useCallback(async () => {
    cancelarCapturaRef.current?.();
    cancelarCapturaRef.current = null;
    await engineRef.current?.stop();
    engineRef.current = null;
  }, []);

  useEffect(() => {
    desmontadoRef.current = false;
    return () => {
      desmontadoRef.current = true;
      void pararEngine();
      // Intencional: queremos o valor de audioRef.current NO MOMENTO do
      // desmonte (ex: TTS ainda tocando quando o usuário desloga), não um
      // snapshot de quando este efeito rodou — audioRef nunca aponta pra um
      // nó gerenciado pelo React, é só um handle de Audio() manual.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      audioRef.current?.pause();
    };
  }, [pararEngine]);

  const enviarSolicitacao = useCallback(async (blob: Blob) => {
    // Uma única chamada HTTP faz transcrição + entendimento no servidor —
    // não existe um sinal real de "transcrição terminou, entendimento
    // começou" pro cliente observar. transcribing é só o blip inicial
    // (a etapa é obrigatória no grafo de transição), thinking cobre a
    // espera de verdade até a resposta voltar.
    irPara("transcribing");
    irPara("thinking");
    try {
      const audioBase64 = await blobParaBase64(blob);
      const res = await fetch("/api/comando/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: audioBase64,
          mime_type: blob.type || "audio/webm",
          conversationId: lerConversationId(),
          origem: "voice_wake_word",
        }),
      });
      const data = await readApiResponse<RespostaComando>(res);
      salvarConversationId(data.conversationId);
      setLastResponseText(data.respostaTexto);
      setLastIntent(data.intent ?? null);
      setLastSolicitacaoId(data.solicitacaoId);

      if (data.audioBase64 && !muted) {
        await reproduzirResposta(data.audioBase64, audioRef, engineRef, irPara);
      } else {
        irPara("standby");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui falar com o Vetor agora.");
      irPara("error");
      setTimeout(() => irPara("standby"), 2500);
    }
  }, [irPara, muted]);

  const aoDetectarWakeWord = useCallback(async () => {
    if (stateRef.current !== "standby") return; // já em outro turno — ignora detecção duplicada
    irPara("wake_word_detected");
    tocarBipDeConfirmacao();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      irPara("listening_request");
      const { resultado, cancelar } = capturarSolicitacaoDeVoz(stream, {
        onAmplitude: (a) => setAmplitude(a),
      });
      cancelarCapturaRef.current = () => {
        cancelar();
        stream.getTracks().forEach((t) => t.stop());
      };
      const { blob } = await resultado;
      stream.getTracks().forEach((t) => t.stop());
      cancelarCapturaRef.current = null;
      setAmplitude(0);
      await enviarSolicitacao(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui captar sua solicitação.");
      irPara("error");
      setTimeout(() => irPara("standby"), 2000);
    }
  }, [irPara, enviarSolicitacao]);

  const ligar = useCallback(async () => {
    setError(null);
    irPara("permission_required");
    irPara("requesting_permission");

    try {
      const permissaoStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissaoStream.getTracks().forEach((t) => t.stop()); // só pra confirmar a permissão — a captura de verdade abre sua própria stream

      const { engine, provider: providerEscolhido } = await selecionarWakeWordEngine({
        keyword: "vetor",
        cooldownMs: 2500,
      });
      engine.onWakeWord(() => void aoDetectarWakeWord());
      await engine.start();

      engineRef.current = engine;
      setProvider(providerEscolhido);
      localStorage.setItem(CHAVE_VOZ_ATIVADA, "true");
      irPara("standby");
    } catch (err) {
      if (err instanceof NenhumProviderDisponivelError) {
        setError("Nenhum modo de ativação por voz está disponível neste navegador/ambiente agora.");
        irPara("unsupported");
        return;
      }
      const nomeErro = err instanceof DOMException ? err.name : "";
      if (nomeErro === "NotAllowedError" || nomeErro === "PermissionDeniedError") {
        irPara("permission_denied");
        return;
      }
      setError(err instanceof Error ? err.message : "Não consegui ativar a voz agora.");
      irPara("error");
      setTimeout(() => irPara("disabled"), 1500);
    }
  }, [irPara, aoDetectarWakeWord]);

  const desligar = useCallback(() => {
    localStorage.removeItem(CHAVE_VOZ_ATIVADA);
    void pararEngine();
    setProvider(null);
    setAmplitude(0);
    irPara("disabled");
  }, [irPara, pararEngine]);

  const pausar = useCallback(() => {
    if (stateRef.current === "standby") {
      void engineRef.current?.pause();
      irPara("paused_by_browser");
    }
  }, [irPara]);

  const retomar = useCallback(() => {
    if (stateRef.current === "paused_by_browser") {
      void engineRef.current?.start();
      irPara("standby");
    }
  }, [irPara]);

  const alternarMudo = useCallback(() => setMuted((m) => !m), []);

  const pararTurnoAtual = useCallback(() => {
    cancelarCapturaRef.current?.();
    cancelarCapturaRef.current = null;
    audioRef.current?.pause();
    setAmplitude(0);
    if (stateRef.current !== "disabled" && stateRef.current !== "standby") {
      void engineRef.current?.start();
      irPara("standby");
    }
  }, [irPara]);

  const limparResposta = useCallback(() => {
    setLastResponseText(null);
    setLastIntent(null);
    setLastSolicitacaoId(null);
  }, []);

  // --- pausa automática quando a aba perde foco ---------------------------
  useEffect(() => {
    function aoTrocarVisibilidade() {
      if (document.hidden) {
        if (stateRef.current === "standby") {
          void engineRef.current?.pause();
          irPara("paused_by_browser");
        }
      } else if (stateRef.current === "paused_by_browser") {
        void engineRef.current?.start();
        irPara("standby");
      }
    }
    document.addEventListener("visibilitychange", aoTrocarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
  }, [irPara]);

  // --- fala uma aprovação de missão que nasceu de um pedido em áudio ------
  // Pedido explícito do dono do produto: se a solicitação original foi feita
  // em voz, a resposta (incluindo pedidos de aprovação que chegam DEPOIS,
  // já com o assistente de volta a standby) também deve vir em voz, pra o
  // diálogo fluir. Nunca interrompe um turno em andamento (só age em
  // standby) nem fala aprovação de missão que não nasceu de áudio.
  const falarAprovacaoDeMissaoPorVoz = useCallback(
    async (aprovacao: { mission_id: string; acao: string }) => {
      if (stateRef.current !== "standby") return;

      const supabase = createSupabaseBrowserClient();
      const { data: solicitacaoDeVoz } = await supabase
        .from("solicitacoes")
        .select("id")
        .eq("mission_id", aprovacao.mission_id)
        .in("origem", ["voice_wake_word", "painel_audio"])
        .limit(1)
        .maybeSingle();
      if (!solicitacaoDeVoz) return; // missão não nasceu de um pedido em áudio

      if (stateRef.current !== "standby") return; // reconfere — a busca acima é assíncrona

      try {
        const res = await fetch("/api/voz/falar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: `O Vetor precisa da sua aprovação: ${aprovacao.acao}` }),
        });
        const data = await readApiResponse<{ audioBase64: string | null }>(res);
        if (data.audioBase64 && !mutedRef.current) {
          await reproduzirResposta(data.audioBase64, audioRef, engineRef, irPara);
        }
      } catch {
        // Best-effort — a aprovação já está visível/clicável no painel de
        // qualquer forma; falha em falar não pode travar nada.
      }
    },
    [irPara],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("vetor-voice-approvals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "approvals" },
        (payload) => {
          const nova = payload.new as { mission_id?: string; acao?: string } | undefined;
          if (nova?.mission_id && nova.acao) {
            void falarAprovacaoDeMissaoPorVoz({ mission_id: nova.mission_id, acao: nova.acao });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [falarAprovacaoDeMissaoPorVoz]);

  // --- retomada automática entre navegações (mesma sessão autenticada) ----
  // Só tenta religar sozinho se o usuário já tinha ligado antes E o navegador
  // já concedeu a permissão sem precisar perguntar de novo — nunca pede
  // permissão sozinho sem um clique explícito do usuário.
  useEffect(() => {
    if (localStorage.getItem(CHAVE_VOZ_ATIVADA) !== "true") return;
    if (!navigator.permissions?.query) return;

    let cancelado = false;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (!cancelado && status.state === "granted") void ligar();
      })
      .catch(() => {
        /* navegador sem suporte a permissions.query pra microfone — fica em disabled até o usuário clicar */
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suportado = typeof window !== "undefined" && !!(navigator.mediaDevices?.getUserMedia);

  return (
    <VetorVoiceContext.Provider
      value={{
        state,
        provider,
        amplitude,
        error,
        muted,
        lastResponseText,
        lastIntent,
        lastSolicitacaoId,
        suportado,
        ligar,
        desligar,
        pausar,
        retomar,
        alternarMudo,
        pararTurnoAtual,
        limparResposta,
      }}
    >
      {children}
    </VetorVoiceContext.Provider>
  );
}

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Toca o TTS da resposta com o engine pausado (nunca ouve a própria voz) e
// retoma a escuta assim que o áudio termina — ou imediatamente se o
// autoplay for bloqueado pelo navegador.
async function reproduzirResposta(
  audioBase64: string,
  audioRef: React.RefObject<HTMLAudioElement | null>,
  engineRef: React.RefObject<WakeWordEngine | null>,
  irPara: (estado: VoiceState) => void,
): Promise<void> {
  irPara("speaking");
  await engineRef.current?.pause();

  const audio = new Audio(`data:audio/ogg;base64,${audioBase64}`);
  audioRef.current = audio;

  const retomarEscuta = async () => {
    await engineRef.current?.start();
    irPara("standby");
  };

  audio.onended = () => void retomarEscuta();
  audio.onerror = () => void retomarEscuta();

  try {
    await audio.play();
  } catch {
    await retomarEscuta(); // autoplay bloqueado — o texto já está disponível via lastResponseText
  }
}
