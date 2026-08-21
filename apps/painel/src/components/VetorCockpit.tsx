"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import VetorCore, { type EstadoCore } from "./VetorCore";
import VetorVoiceOverlay from "./VetorVoiceOverlay";
import VetorIntentCard, { type MissaoProposta } from "./VetorIntentCard";
import StatusBadge from "./StatusBadge";
import VoiceIndicator from "./voice/VoiceIndicator";
import ArtifactLibrary from "./ArtifactLibrary";
import { readApiResponse } from "@/lib/api/readApiResponse";
import type { ArtefatoBiblioteca } from "@/lib/artifacts/fetchArtifacts";

// Painel principal (Fase "chat + núcleo") — única exceção ao layout
// congelado: o conteúdo central vira a sala de interação do Vetor (núcleo
// grande + chat multimodal), com missões/pendências só como indicação
// discreta. VetorAppShell, sidebar, navegação e identidade visual seguem
// intocados — isto substitui só o miolo de dashboard/page.tsx.

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
  intent?: MissaoProposta;
  solicitacaoId?: string;
}

const CHAVE_CONVERSATION_ID = "vetor:conversationId";
// Templates (Fase 4 do upgrade Gravyx) — /templates grava aqui antes de
// navegar de volta pro dashboard; ver TemplatesPainel.tsx.
const CHAVE_PREFILL_COMANDO = "vetor:prefillComando";

interface Props {
  missaoAtual?: { id: string; titulo: string; status: string } | null;
  contagemPendentes: number;
  contagemAtivas: number;
  saudacaoJaTocada: boolean;
  criacoesRecentes?: ArtefatoBiblioteca[];
}

// Fase 1 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — ações
// rápidas nunca abrem um caminho paralelo de criação: "prompt" só preenche
// o campo de texto do MESMO chat (usuário revisa e envia, igual digitar na
// mão); "href" navega pra um hub que já existe. Nenhuma missão é criada
// direto por um clique aqui.
const ACOES_RAPIDAS: Array<{ label: string; prompt?: string; href?: string }> = [
  { label: "Criar uma peça", prompt: "Quero criar uma peça de design." },
  { label: "Criar um vídeo", prompt: "Quero criar um vídeo." },
  { label: "Planejar meu mês", prompt: "Monte o planejamento deste mês pra mim." },
  { label: "Analisar campanhas", prompt: "Como estão minhas campanhas de tráfego agora?" },
  { label: "Usar uma referência", href: "/referencias" },
  { label: "Consultar meu negócio", href: "/configuracoes/negocio" },
];

export default function VetorCockpit({ missaoAtual, contagemPendentes, contagemAtivas, saudacaoJaTocada, criacoesRecentes = [] }: Props) {
  const [estado, setEstado] = useState<EstadoCore>("idle");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [amplitude, setAmplitude] = useState(0);
  const [overlayAtivo, setOverlayAtivo] = useState(false);
  const [saudacaoTexto, setSaudacaoTexto] = useState<string | null>(null);
  const [mostrarBotaoOuvir, setMostrarBotaoOuvir] = useState(false);
  // Fase 6 do Vetor Manager, inspirado no aviso da Gravyx antes do primeiro
  // uso de voz ("Voice Link"): STT/TTS têm credencial real configurada mas
  // nunca foram provados em produção (docs/STATUS-REAL-ATUAL.md, item 9b)
  // — mostra um aviso claro na primeira vez, não apresenta como recurso
  // maduro antes da hora. Guardado em localStorage: uma vez visto, não
  // interrompe de novo (o aviso é sobre a primeira impressão, não sobre
  // toda gravação).
  const [avisoVozAberto, setAvisoVozAberto] = useState(false);

  const conversationIdRef = useRef<string | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analiserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const saudacaoDisparadaRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function usarAcaoRapida(prompt: string) {
    setTexto(prompt);
    inputRef.current?.focus();
  }

  // Recupera a conversa em aberto ao recarregar a página.
  useEffect(() => {
    const id = sessionStorage.getItem(CHAVE_CONVERSATION_ID);
    if (id) conversationIdRef.current = id;
  }, []);

  // Templates (Fase 4 do upgrade Gravyx) — preenche o campo com o texto
  // salvo por "Usar no chat" em /templates, se houver. Achado real: um
  // lazy initializer no useState (sem efeito) lia e limpava a chave
  // certinho, mas o <input> renderizado ficava vazio mesmo assim — o React
  // não força a sincronização do value de um <input> controlado durante a
  // hidratação de uma navegação nova (window.location.href), pra não
  // atropelar algo que o usuário tenha digitado nesse intervalo. Um efeito
  // (garantido pós-hidratação) é o jeito certo de sincronizar estado
  // externo (sessionStorage) pra dentro do React aqui — não é o caso que a
  // regra de "nunca setState em efeito" quer evitar.
  useEffect(() => {
    const prefill = sessionStorage.getItem(CHAVE_PREFILL_COMANDO);
    if (!prefill) return;
    sessionStorage.removeItem(CHAVE_PREFILL_COMANDO);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto(prefill);
  }, []);

  // Saudação de áudio — toca toda vez que a página carrega/atualiza (pedido
  // explícito do dono do produto). O ref aqui só evita disparo duplo dentro
  // do mesmo mount em StrictMode, não é mais uma guarda de "só uma vez".
  useEffect(() => {
    if (saudacaoDisparadaRef.current || saudacaoJaTocada) return;
    saudacaoDisparadaRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/saudacao", { method: "POST" });
        if (!res.ok) return;
        const data = await res.json();
        setSaudacaoTexto(data.texto ?? null);
        if (!data.audioBase64) return;

        setEstado("welcoming");
        const audio = new Audio(`data:audio/ogg;base64,${data.audioBase64}`);
        try {
          await audio.play();
          audio.addEventListener("ended", () => setEstado("idle"), { once: true });
        } catch {
          // autoplay bloqueado — texto já está na tela, oferece botão manual.
          setMostrarBotaoOuvir(true);
          setEstado("idle");
        }
      } catch {
        // erro de TTS/rede não pode quebrar o painel — segue em silêncio.
        setEstado("idle");
      }
    })();
  }, [saudacaoJaTocada]);

  function pararAnaliseAmplitude() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setAmplitude(0);
  }

  function iniciarAnaliseAmplitude(source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode, ctx: AudioContext) {
    const analiser = ctx.createAnalyser();
    analiser.fftSize = 256;
    source.connect(analiser);
    analiserRef.current = analiser;
    const dados = new Uint8Array(analiser.frequencyBinCount);

    function loop() {
      analiser.getByteTimeDomainData(dados);
      let soma = 0;
      for (let i = 0; i < dados.length; i++) {
        const v = (dados[i]! - 128) / 128;
        soma += v * v;
      }
      const rms = Math.sqrt(soma / dados.length);
      setAmplitude(Math.min(1, rms * 4));
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();
  }

  function guardarConversationId(id: string) {
    conversationIdRef.current = id;
    sessionStorage.setItem(CHAVE_CONVERSATION_ID, id);
  }

  async function tocarRespostaEmVoz(base64: string) {
    setEstado("speaking");
    setOverlayAtivo(true);
    const audio = new Audio(`data:audio/ogg;base64,${base64}`);
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaElementSource(audio);
      const analiser = ctx.createAnalyser();
      analiser.fftSize = 256;
      source.connect(analiser);
      analiser.connect(ctx.destination);
      analiserRef.current = analiser;
      const dados = new Uint8Array(analiser.frequencyBinCount);
      function loop() {
        analiser.getByteTimeDomainData(dados);
        let soma = 0;
        for (let i = 0; i < dados.length; i++) {
          const v = (dados[i]! - 128) / 128;
          soma += v * v;
        }
        setAmplitude(Math.min(1, Math.sqrt(soma / dados.length) * 4));
        rafRef.current = requestAnimationFrame(loop);
      }
      loop();
      await audio.play();
    } catch {
      // Web Audio indisponível/bloqueado — toca sem análise de amplitude.
      try {
        await audio.play();
      } catch {
        // autoplay bloqueado — segue sem áudio, resposta em texto já está na tela.
      }
    }
    await new Promise<void>((resolve) => {
      audio.addEventListener("ended", () => resolve(), { once: true });
      audio.addEventListener("error", () => resolve(), { once: true });
    });
    pararAnaliseAmplitude();
    setOverlayAtivo(false);
    setEstado("idle");
  }

  async function enviarTexto(conteudoForcado?: string) {
    const conteudo = (conteudoForcado ?? texto).trim();
    if (!conteudo || enviando) return;

    setTexto("");
    setErro(null);
    setEnviando(true);
    setEstado("understanding");
    setMensagens((atual) => [...atual, { autor: "cliente", texto: conteudo }]);

    try {
      const res = await fetch("/api/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: conteudo, responder_em_voz: false, conversationId: conversationIdRef.current }),
      });
      const data = await readApiResponse<RespostaComando>(res);
      guardarConversationId(data.conversationId);
      setMensagens((atual) => [
        ...atual,
        { autor: "vetor", texto: data.respostaTexto, intent: data.intent, solicitacaoId: data.solicitacaoId },
      ]);
      setEstado(data.intent ? "planning" : "idle");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui falar com o Vetor agora.");
      setEstado("error");
    } finally {
      setEnviando(false);
    }
  }

  const CHAVE_AVISO_VOZ_VISTO = "vetor:avisoVozVisto";

  function handleCliqueMicrofone() {
    if (gravando) {
      pararGravacao();
      return;
    }
    const jaViu = typeof window !== "undefined" && window.localStorage.getItem(CHAVE_AVISO_VOZ_VISTO) === "1";
    if (jaViu) {
      iniciarGravacao();
    } else {
      setAvisoVozAberto(true);
    }
  }

  function confirmarAvisoVozEGravar() {
    window.localStorage.setItem(CHAVE_AVISO_VOZ_VISTO, "1");
    setAvisoVozAberto(false);
    iniciarGravacao();
  }

  async function iniciarGravacao() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      iniciarAnaliseAmplitude(source, ctx);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        pararAnaliseAmplitude();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await enviarAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGravando(true);
      setEstado("listening");
      setOverlayAtivo(true);
    } catch {
      setErro("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    setGravando(false);
  }

  function cancelarModoVoz() {
    if (gravando) {
      mediaRecorderRef.current?.stop();
      setGravando(false);
    }
    pararAnaliseAmplitude();
    setOverlayAtivo(false);
    setEstado("idle");
  }

  async function enviarAudio(blob: Blob) {
    setEnviando(true);
    setEstado("transcribing");
    setMensagens((atual) => [...atual, { autor: "cliente", texto: "🎤 mensagem de voz" }]);

    try {
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setEstado("understanding");
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
        { autor: "vetor", texto: data.respostaTexto, intent: data.intent, solicitacaoId: data.solicitacaoId },
      ]);
      if (data.audioBase64) {
        await tocarRespostaEmVoz(data.audioBase64);
      } else {
        setOverlayAtivo(false);
        setEstado(data.intent ? "planning" : "idle");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui processar o áudio agora.");
      setOverlayAtivo(false);
      setEstado("error");
    } finally {
      setEnviando(false);
    }
  }

  async function ouvirSaudacaoManualmente() {
    if (!saudacaoTexto) return;
    setMostrarBotaoOuvir(false);
    // A saudação já foi consumida (idempotente) — só reexibe o texto; não
    // re-solicita TTS pra evitar custo repetido por clique.
  }

  const mensagemNucleo =
    estado === "idle"
      ? missaoAtual
        ? `Trabalhando em: ${missaoAtual.titulo}`
        : "O que você precisa realizar hoje?"
      : undefined;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <VetorVoiceOverlay
        ativo={overlayAtivo}
        estado={estado}
        amplitude={amplitude}
        onParar={cancelarModoVoz}
      />

      <div className="flex flex-col items-center text-center">
        <VetorCore estado={estado} className="w-56 sm:w-64" amplitude={gravando || estado === "speaking" ? amplitude : undefined} />
        <p className="mt-4 text-base text-areia/70">{mensagemNucleo}</p>
        {saudacaoTexto && mostrarBotaoOuvir && (
          <button
            onClick={ouvirSaudacaoManualmente}
            className="mt-2 rounded-full border border-ambar/30 px-4 py-1.5 text-xs text-ambar transition hover:bg-ambar/10"
          >
            Ouvir saudação: “{saudacaoTexto}”
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {ACOES_RAPIDAS.map((acao) =>
          acao.href ? (
            <Link
              key={acao.label}
              href={acao.href}
              className="rounded-full border border-areia/15 bg-petroleo-2/60 px-3.5 py-1.5 text-xs text-areia/70 transition hover:border-menta/40 hover:text-menta"
            >
              {acao.label}
            </Link>
          ) : (
            <button
              key={acao.label}
              onClick={() => usarAcaoRapida(acao.prompt!)}
              className="rounded-full border border-areia/15 bg-petroleo-2/60 px-3.5 py-1.5 text-xs text-areia/70 transition hover:border-menta/40 hover:text-menta"
            >
              {acao.label}
            </button>
          ),
        )}
      </div>

      <div className="mt-8 rounded-3xl border border-areia/10 bg-petroleo-2/60 p-5 backdrop-blur">
        <div className="max-h-[26rem] space-y-2 overflow-y-auto">
          {mensagens.length === 0 && (
            <p className="text-sm text-areia/40">
              Manda uma demanda por texto ou áudio — o Vetor entende e já organiza pra você.
            </p>
          )}
          {mensagens.map((m, i) => (
            <div key={i}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.autor === "cliente" ? "ml-auto bg-menta/15 text-areia" : "border border-areia/10 bg-petroleo/70 text-areia"
                }`}
              >
                {m.texto}
              </div>
              {m.intent && <VetorIntentCard intent={m.intent} solicitacaoId={m.solicitacaoId} />}
            </div>
          ))}
        </div>

        {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}

        {avisoVozAberto && (
          <div className="mt-2 rounded-xl border border-ambar/40 bg-ambar/10 p-3 text-xs text-areia/80">
            <p>
              <span className="font-semibold text-ambar">Recurso em desenvolvimento.</span> A conversa por voz pode
              falhar ou demorar mais que o esperado — se isso acontecer, digite normalmente.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={confirmarAvisoVozEGravar}
                className="rounded-full bg-ambar px-3 py-1.5 text-[11px] font-semibold text-petroleo hover:bg-ambar-forte"
              >
                Entendi, continuar
              </button>
              <button
                onClick={() => setAvisoVozAberto(false)}
                className="rounded-full border border-areia/15 px-3 py-1.5 text-[11px] text-areia/60 hover:text-areia"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviarTexto()}
            disabled={enviando || gravando}
            placeholder="Digite o que você precisa..."
            className="flex-1 rounded-xl border border-areia/15 bg-petroleo px-4 py-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleCliqueMicrofone}
            disabled={enviando}
            aria-label={gravando ? "Parar gravação" : "Gravar áudio"}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition ${
              gravando ? "animate-pulse border-coral bg-coral/20 text-coral" : "border-areia/15 text-areia/60 hover:border-menta hover:text-menta"
            }`}
          >
            🎤
          </button>
          <button
            onClick={() => enviarTexto()}
            disabled={enviando || gravando || !texto.trim()}
            className="rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
          >
            Enviar
          </button>
        </div>

        {/* Ativação por wake word "vetor" — movida da sidebar pra ficar junto
            do chat (pedido explícito do dono do produto). Reusa o mesmo
            contexto global (VetorVoiceProvider, montado no shell), então a
            escuta continua funcionando em qualquer página — só o controle
            visual mora aqui agora. */}
        <div className="mt-4 border-t border-areia/10 pt-4">
          <VoiceIndicator />
        </div>
      </div>

      {criacoesRecentes.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">Criações recentes</p>
            <Link href="/criacoes" className="font-mono text-[11px] text-menta hover:underline">
              ver tudo
            </Link>
          </div>
          <div className="mt-3">
            <ArtifactLibrary artefatos={criacoesRecentes} vazio="" />
          </div>
        </div>
      )}

      {/* Indicação discreta — sem cards grandes de indicadores concorrendo com o núcleo. */}
      <div className="mt-4 flex items-center justify-center gap-4 font-mono text-[11px] text-areia/40">
        {missaoAtual && (
          <Link href={`/missoes/${missaoAtual.id}`} className="flex items-center gap-1.5 hover:text-menta">
            <StatusBadge status={missaoAtual.status} />
            <span>{missaoAtual.titulo}</span>
          </Link>
        )}
        {contagemPendentes > 0 && <span className="text-ambar">{contagemPendentes} aguardando você</span>}
        {contagemAtivas > 0 && <span>{contagemAtivas} em andamento</span>}
        <Link href="/missoes" className="hover:text-menta">
          ver missões
        </Link>
      </div>
    </div>
  );
}
