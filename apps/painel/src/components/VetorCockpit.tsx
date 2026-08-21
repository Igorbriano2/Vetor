"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import VetorCore, { LABEL_ESTADO, type EstadoCore } from "./VetorCore";
import VetorVoiceOverlay from "./VetorVoiceOverlay";
import VetorIntentCard, { type MissaoProposta } from "./VetorIntentCard";
import StatusBadge from "./StatusBadge";
import VoiceIndicator from "./voice/VoiceIndicator";
import ArtifactLibrary from "./ArtifactLibrary";
import { readApiResponse } from "@/lib/api/readApiResponse";
import type { ArtefatoBiblioteca } from "@/lib/artifacts/fetchArtifacts";

// Cockpit fullscreen (Fase 1 do VETOR Manager V2, docs/IMPLEMENTATION-AUDIT-V2.md)
// — única exceção ao layout congelado: o conteúdo central vira a sala de
// interação do Vetor (núcleo dominante + chat multimodal + telemetria real),
// com missões/pendências como indicação discreta. VetorAppShell recolhe a
// sidebar pra um rail de ícones só nesta rota (ver SidebarNav.tsx); nenhuma
// outra página do app muda. Todo dado de telemetria é real ou diz
// honestamente "aguardando"/"indisponível" — nunca um percentual inventado
// (ver seção 2 do relatório da Fase 0).

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

// Fase 2 do VETOR Manager V2 — anexo local antes/depois do upload real.
// chaveLocal existe só pra reconciliar o item na UI (remover, mostrar
// progresso) antes de existir um assetId real vindo do servidor.
interface AnexoPendente {
  chaveLocal: string;
  nome: string;
  mimeType: string;
  status: "enviando" | "pronto" | "erro";
  assetId?: string;
  url?: string | null;
  erro?: string;
}

const MIME_ACEITOS = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,text/plain";

const CHAVE_CONVERSATION_ID = "vetor:conversationId";
// Templates (Fase 4 do upgrade Gravyx) — /templates grava aqui antes de
// navegar de volta pro dashboard; ver TemplatesPainel.tsx.
const CHAVE_PREFILL_COMANDO = "vetor:prefillComando";

interface ContextoNegocio {
  workspaceNome: string | null;
  temBrandKit: boolean;
  contagemReferencias: number;
}

interface StatusConexoes {
  supabase: boolean;
  metaAds: boolean;
  instagram: boolean;
  whatsapp: boolean;
}

interface Props {
  missaoAtual?: { id: string; titulo: string; status: string } | null;
  contagemPendentes: number;
  contagemAtivas: number;
  saudacaoJaTocada: boolean;
  criacoesRecentes?: ArtefatoBiblioteca[];
  contextoNegocio: ContextoNegocio;
  conexoes: StatusConexoes;
  atividadeDiaria: number[];
}

// Fase 1 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — ações
// rápidas nunca abrem um caminho paralelo de criação: "prompt" só preenche
// o campo de texto do MESMO chat (usuário revisa e envia, igual digitar na
// mão); "href" navega pra um hub que já existe. Nenhuma missão é criada
// direto por um clique aqui.
const ACOES_RAPIDAS: Array<{ label: string; prompt?: string; href?: string }> = [
  { label: "Criar peça", prompt: "Quero criar uma peça de design." },
  { label: "Criar vídeo", prompt: "Quero criar um vídeo." },
  { label: "Planejar mês", prompt: "Monte o planejamento deste mês pra mim." },
  { label: "Analisar campanhas", prompt: "Como estão minhas campanhas de tráfego agora?" },
  { label: "Usar referência", href: "/referencias" },
];

const MODULOS_DISPONIVEIS = ["Copy", "Design", "Vídeo", "Estratégia", "Tráfego", "Social"];

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    // Primeira leitura precisa acontecer só depois de montar (evita
    // mismatch de hidratação servidor/cliente — ver mesmo padrão já
    // documentado no efeito de prefill do comando acima).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  // Primeiro render (SSR/hidratação) não mostra hora nenhuma — evita
  // mismatch de hidratação entre servidor e cliente (nunca um horário
  // fabricado só pra preencher espaço).
  if (!agora) return <span className="mono-label text-areia/30">--:--</span>;
  return <span className="mono-label text-areia/50">{agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>;
}

function PainelTelemetria({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="panel rounded-2xl p-3.5">
      <p className="mono-label mb-2.5 text-areia/40">{titulo}</p>
      {children}
    </div>
  );
}

function BarrasDeAmplitude({ valores, cor }: { valores: number[]; cor: string }) {
  return (
    <div className="flex h-10 items-end gap-1">
      {valores.map((v, i) => (
        <div
          key={i}
          className="w-full rounded-sm transition-[height] duration-100"
          style={{ height: `${Math.max(6, v * 100)}%`, background: cor, opacity: 0.35 + v * 0.65 }}
        />
      ))}
    </div>
  );
}

function Sparkline({ valores }: { valores: number[] }) {
  const max = Math.max(1, ...valores);
  const largura = 100;
  const altura = 32;
  const passo = largura / Math.max(1, valores.length - 1);
  const pontos = valores.map((v, i) => `${i * passo},${altura - (v / max) * (altura - 4) - 2}`).join(" ");
  const totalPeriodo = valores.reduce((a, b) => a + b, 0);
  return (
    <div>
      <svg viewBox={`0 0 ${largura} ${altura}`} className="h-10 w-full" preserveAspectRatio="none">
        <polyline points={pontos} fill="none" stroke="var(--color-menta)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="mt-1 text-[10px] text-areia/40">{totalPeriodo} criações nos últimos 7 dias</p>
    </div>
  );
}

function LinhaConexao({ label, ativo }: { label: string; ativo: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px]">
      <span className="text-areia/60">{label}</span>
      <span className={`flex items-center gap-1.5 ${ativo ? "text-menta" : "text-areia/30"}`}>
        <span className={`size-1.5 rounded-full ${ativo ? "bg-menta" : "bg-areia/20"}`} />
        {ativo ? "conectado" : "não conectado"}
      </span>
    </div>
  );
}

export default function VetorCockpit({
  missaoAtual,
  contagemPendentes,
  contagemAtivas,
  saudacaoJaTocada,
  criacoesRecentes = [],
  contextoNegocio,
  conexoes,
  atividadeDiaria,
}: Props) {
  const [estado, setEstado] = useState<EstadoCore>("idle");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [amplitude, setAmplitude] = useState(0);
  const [bandasFrequencia, setBandasFrequencia] = useState<number[]>(Array.from({ length: 10 }, () => 0));
  const [overlayAtivo, setOverlayAtivo] = useState(false);
  const [saudacaoTexto, setSaudacaoTexto] = useState<string | null>(null);
  const [mostrarBotaoOuvir, setMostrarBotaoOuvir] = useState(false);
  const [telemetriaMobileAberta, setTelemetriaMobileAberta] = useState(false);
  const [anexos, setAnexos] = useState<AnexoPendente[]>([]);
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Fase 2 do VETOR Manager V2 — upload acontece assim que o arquivo é
  // escolhido/arrastado (não só no envio da mensagem), pra mostrar
  // progresso e erro reais por arquivo antes do cliente decidir enviar.
  async function anexarArquivos(arquivos: FileList | File[]) {
    const lista = Array.from(arquivos).slice(0, 5 - anexos.length);
    for (const arquivo of lista) {
      const chaveLocal = crypto.randomUUID();
      setAnexos((atual) => [...atual, { chaveLocal, nome: arquivo.name, mimeType: arquivo.type, status: "enviando" }]);

      const formData = new FormData();
      formData.append("arquivo", arquivo);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Falha ao enviar o arquivo");
        setAnexos((atual) =>
          atual.map((a) => (a.chaveLocal === chaveLocal ? { ...a, status: "pronto", assetId: data.assetId, url: data.url } : a)),
        );
      } catch (err) {
        setAnexos((atual) =>
          atual.map((a) => (a.chaveLocal === chaveLocal ? { ...a, status: "erro", erro: err instanceof Error ? err.message : "Falha ao enviar" } : a)),
        );
      }
    }
  }

  function removerAnexo(chaveLocal: string) {
    setAnexos((atual) => atual.filter((a) => a.chaveLocal !== chaveLocal));
  }

  function handleDropArquivo(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastandoArquivo(false);
    if (e.dataTransfer.files.length > 0) void anexarArquivos(e.dataTransfer.files);
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
    setBandasFrequencia(Array.from({ length: 10 }, () => 0));
  }

  // Duas leituras reais do MESMO AnalyserNode (nunca dois sinais fictícios
  // fingindo ser independentes): getByteTimeDomainData -> amplitude RMS
  // (painel "Análise de voz" e escala do núcleo); getByteFrequencyData,
  // reduzido a 10 baldes -> "Resposta de frequência". Achado de produto: um
  // único VU-meter não é suficiente pros dois painéis pedidos na spec —
  // sem essa segunda leitura real, o segundo painel teria que repetir o
  // primeiro ou inventar dado.
  function iniciarAnaliseAmplitude(source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode, ctx: AudioContext) {
    const analiser = ctx.createAnalyser();
    analiser.fftSize = 256;
    source.connect(analiser);
    analiserRef.current = analiser;
    const dadosTempo = new Uint8Array(analiser.frequencyBinCount);
    const dadosFreq = new Uint8Array(analiser.frequencyBinCount);

    function loop() {
      analiser.getByteTimeDomainData(dadosTempo);
      let soma = 0;
      for (let i = 0; i < dadosTempo.length; i++) {
        const v = (dadosTempo[i]! - 128) / 128;
        soma += v * v;
      }
      const rms = Math.sqrt(soma / dadosTempo.length);
      setAmplitude(Math.min(1, rms * 4));

      analiser.getByteFrequencyData(dadosFreq);
      const baldes = 10;
      const tamanhoBalde = Math.floor(dadosFreq.length / baldes);
      const bandas = Array.from({ length: baldes }, (_, i) => {
        let s = 0;
        for (let j = i * tamanhoBalde; j < (i + 1) * tamanhoBalde; j++) s += dadosFreq[j] ?? 0;
        return Math.min(1, s / tamanhoBalde / 255);
      });
      setBandasFrequencia(bandas);

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
      source.connect(ctx.destination);
      iniciarAnaliseAmplitude(source, ctx);
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
    const anexosProntos = anexos.filter((a) => a.status === "pronto");
    // Nunca envia com anexo ainda subindo — o assetId real ainda não
    // existe, mandar a mensagem agora perderia o arquivo silenciosamente.
    if ((!conteudo && anexosProntos.length === 0) || enviando || anexos.some((a) => a.status === "enviando")) return;

    const assetIds = anexosProntos.map((a) => a.assetId!);
    const rotuloAnexos = anexosProntos.length > 0 ? ` 📎 ${anexosProntos.map((a) => a.nome).join(", ")}` : "";

    setTexto("");
    setAnexos([]);
    setErro(null);
    setEnviando(true);
    setEstado("understanding");
    setMensagens((atual) => [...atual, { autor: "cliente", texto: `${conteudo}${rotuloAnexos}` }]);

    try {
      const res = await fetch("/api/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: conteudo || "Veja o(s) arquivo(s) que anexei.",
          responder_em_voz: false,
          conversationId: conversationIdRef.current,
          assetIds,
        }),
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

  const ativo = estado !== "idle";

  const painelAnaliseVoz = (
    <PainelTelemetria titulo="Análise de voz">
      {gravando || estado === "speaking" ? (
        <BarrasDeAmplitude valores={Array.from({ length: 10 }, (_, i) => Math.max(0.05, amplitude * (0.6 + 0.4 * Math.sin(i))))} cor="var(--color-menta)" />
      ) : (
        <p className="text-[11px] text-areia/40">Sem áudio no momento</p>
      )}
    </PainelTelemetria>
  );

  const painelFrequencia = (
    <PainelTelemetria titulo="Resposta de frequência">
      {gravando || estado === "speaking" ? (
        <BarrasDeAmplitude valores={bandasFrequencia} cor="var(--color-electric)" />
      ) : (
        <p className="text-[11px] text-areia/40">Sem áudio no momento</p>
      )}
    </PainelTelemetria>
  );

  const painelConfianca = (
    <PainelTelemetria titulo="Confiança">
      {/* Nenhum valor de confiança de intenção é persistido hoje (ver
          docs/IMPLEMENTATION-AUDIT-V2.md seção 2) — mostrar "aguardando"
          honestamente é melhor que inventar um número. */}
      <p className="text-[11px] text-areia/40">Aguardando sinal real de confiança</p>
    </PainelTelemetria>
  );

  const painelStatusSistema = (
    <PainelTelemetria titulo="Status do sistema">
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-areia/60">Núcleo</span>
          <span className="text-menta">{LABEL_ESTADO[estado]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-areia/60">Reconhecimento de voz</span>
          {/* Modelo ONNX de wake word ("Diga Vetor") ainda não instalado em
              produção (ver apps/painel/src/lib/voice/providers/*) — nunca
              fingir que está ativo; a captura manual pelo botão de
              microfone continua funcionando normalmente. */}
          <span className="text-areia/30">manual (wake word indisponível)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-areia/60">Motor de planejamento</span>
          <span className={estado === "error" ? "text-coral" : "text-menta"}>{estado === "error" ? "falha" : enviando ? "processando" : "ativo"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-areia/60">Memória e sincronização</span>
          <span className="text-menta">ativo</span>
        </div>
      </div>
    </PainelTelemetria>
  );

  const painelInsights = (
    <PainelTelemetria titulo="Insights do negócio">
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-areia/60">Workspace</span>
          <span className="truncate text-areia/80">{contextoNegocio.workspaceNome ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-areia/60">BrandKit</span>
          <span className={contextoNegocio.temBrandKit ? "text-menta" : "text-ambar"}>{contextoNegocio.temBrandKit ? "configurado" : "pendente"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-areia/60">Referências</span>
          <span className="text-areia/80">{contextoNegocio.contagemReferencias}</span>
        </div>
      </div>
    </PainelTelemetria>
  );

  const painelAnalytics = (
    <PainelTelemetria titulo="Analytics">
      <Sparkline valores={atividadeDiaria} />
    </PainelTelemetria>
  );

  const painelModulos = (
    <PainelTelemetria titulo="Módulos ativos">
      <div className="flex flex-wrap gap-1.5">
        {MODULOS_DISPONIVEIS.map((m) => (
          <span key={m} className="rounded-md border border-menta/20 bg-menta/5 px-2 py-1 text-[10px] text-menta">
            {m}
          </span>
        ))}
      </div>
    </PainelTelemetria>
  );

  const painelConexao = (
    <PainelTelemetria titulo="Conexão">
      <div className="space-y-0.5">
        <LinhaConexao label="Supabase" ativo={conexoes.supabase} />
        <LinhaConexao label="Meta Ads" ativo={conexoes.metaAds} />
        <LinhaConexao label="Instagram" ativo={conexoes.instagram} />
        <LinhaConexao label="WhatsApp" ativo={conexoes.whatsapp} />
      </div>
    </PainelTelemetria>
  );

  return (
    <div className="vetor-starfield relative flex min-h-screen flex-col overflow-x-hidden">
      <div className="vetor-aurora" aria-hidden="true" />
      <VetorVoiceOverlay ativo={overlayAtivo} estado={estado} amplitude={amplitude} onParar={cancelarModoVoz} />

      {/* Barra fina de topo */}
      <div className="relative z-10 flex h-10 shrink-0 items-center justify-between border-b border-areia/10 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="mono-label tracking-[0.3em] text-areia">VETOR</span>
          <span className="hidden text-[10px] text-areia/30 sm:inline">GERENTE DE MARKETING</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="mono-label hidden items-center gap-1.5 text-menta sm:flex">
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-menta animate-core-pulse" />
              <span className="relative size-1.5 rounded-full bg-menta" />
            </span>
            SISTEMA ONLINE
          </span>
          <span
            className="mono-label hidden items-center gap-1.5 text-areia/25 sm:flex"
            title="Wake word ('Diga Vetor') depende de um modelo que ainda não foi instalado em produção — toque no microfone pra falar."
          >
            VOICE LINK
          </span>
          <Relogio />
        </div>
      </div>

      {/* Conteúdo principal: telemetria | núcleo | telemetria */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start lg:gap-4 lg:px-6 xl:gap-6">
        <aside className="hidden shrink-0 flex-col gap-3 lg:flex lg:w-48 xl:w-60">
          {painelAnaliseVoz}
          {painelFrequencia}
          {painelConfianca}
          {painelStatusSistema}
        </aside>

        <div className="flex flex-1 flex-col items-center">
          <p className="mono-label text-center tracking-[0.35em] text-areia/60">{LABEL_ESTADO[estado]}</p>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={`size-1 rounded-full bg-menta ${ativo ? "animate-blink" : ""}`}
                style={{ animationDelay: `${i * 0.15}s`, opacity: ativo ? undefined : 0.15 }}
              />
            ))}
          </div>

          <VetorCore
            estado={estado}
            className="mt-4 w-64 sm:w-72 lg:w-80 xl:w-[22rem]"
            amplitude={gravando || estado === "speaking" ? amplitude : undefined}
          />
          <p className="mt-4 max-w-md text-center text-base text-areia/70">{mensagemNucleo}</p>
          {saudacaoTexto && mostrarBotaoOuvir && (
            <button
              onClick={ouvirSaudacaoManualmente}
              className="mt-2 rounded-full border border-ambar/30 px-4 py-1.5 text-xs text-ambar transition hover:bg-ambar/10"
            >
              Ouvir saudação: “{saudacaoTexto}”
            </button>
          )}

          {/* Botão de voz — grande, centrado, logo abaixo do núcleo (pedido
              explícito da spec: nunca escondido dentro de outro controle). */}
          <button
            onClick={handleCliqueMicrofone}
            disabled={enviando}
            aria-label={gravando ? "Parar gravação" : "Falar com o Vetor"}
            className={`mt-6 flex size-16 shrink-0 items-center justify-center rounded-full border-2 transition ${
              gravando ? "animate-pulse border-coral bg-coral/15 text-coral" : "border-menta/40 bg-menta/5 text-menta hover:bg-menta/15"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

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

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastandoArquivo(true);
            }}
            onDragLeave={() => setArrastandoArquivo(false)}
            onDrop={handleDropArquivo}
            className={`mt-8 w-full max-w-[720px] rounded-3xl border p-5 backdrop-blur transition ${
              arrastandoArquivo ? "border-menta/50 bg-menta/5" : "border-areia/10 bg-petroleo-2/60"
            }`}
          >
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

            {anexos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {anexos.map((a) => (
                  <div
                    key={a.chaveLocal}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                      a.status === "erro" ? "border-coral/40 bg-coral/10 text-coral" : "border-areia/15 bg-petroleo/60 text-areia/70"
                    }`}
                  >
                    <span className="max-w-[140px] truncate">{a.status === "erro" ? (a.erro ?? "Falha") : a.nome}</span>
                    {a.status === "enviando" && <span className="animate-pulse text-areia/40">enviando...</span>}
                    <button onClick={() => removerAnexo(a.chaveLocal)} aria-label="Remover anexo" className="text-areia/40 hover:text-coral">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={MIME_ACEITOS}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) void anexarArquivos(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={anexos.length >= 5}
                aria-label="Anexar arquivo"
                title="Anexar imagem, vídeo, PDF ou documento"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-areia/15 text-areia/60 transition hover:border-menta hover:text-menta disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path
                    d="M17.5 8.5l-7.4 7.4a2.5 2.5 0 1 1-3.5-3.5l7.4-7.4a4 4 0 1 1 5.7 5.7l-7.4 7.4a5.5 5.5 0 1 1-7.8-7.8L12 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
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
                onClick={() => enviarTexto()}
                disabled={enviando || gravando || (!texto.trim() && anexos.filter((a) => a.status === "pronto").length === 0) || anexos.some((a) => a.status === "enviando")}
                className="rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
              >
                Enviar
              </button>
            </div>

            {/* Ativação por wake word "vetor" — mantida aqui junto do chat.
                Reusa o mesmo contexto global (VetorVoiceProvider, montado no
                shell), então a escuta continua funcionando em qualquer
                página — só o controle visual mora aqui. */}
            <div className="mt-4 border-t border-areia/10 pt-4">
              <VoiceIndicator />
            </div>
          </div>

          {criacoesRecentes.length > 0 && (
            <div className="mt-8 w-full max-w-[720px]">
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

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 font-mono text-[11px] text-areia/40">
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

        <aside className="hidden shrink-0 flex-col gap-3 lg:flex lg:w-48 xl:w-60">
          {painelInsights}
          {painelAnalytics}
          {painelModulos}
          {painelConexao}
        </aside>
      </div>

      {/* Telemetria em mobile/tablet pequeno — botão flutuante + drawer,
          nunca os 8 painéis espremidos na tela (spec explícita: "ocultar os
          painéis laterais em um botão Telemetria"). */}
      <button
        onClick={() => setTelemetriaMobileAberta(true)}
        className="mono-label fixed bottom-16 right-4 z-20 rounded-full border border-menta/30 bg-petroleo-2/90 px-4 py-2 text-menta shadow-lg backdrop-blur lg:hidden"
      >
        Telemetria
      </button>
      {telemetriaMobileAberta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-petroleo/80 backdrop-blur-sm" onClick={() => setTelemetriaMobileAberta(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-areia/10 bg-petroleo-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="mono-label text-areia/50">Telemetria</p>
              <button onClick={() => setTelemetriaMobileAberta(false)} className="text-areia/40 hover:text-areia" aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {painelAnaliseVoz}
              {painelFrequencia}
              {painelConfianca}
              {painelStatusSistema}
              {painelInsights}
              {painelAnalytics}
              {painelModulos}
              {painelConexao}
            </div>
          </div>
        </div>
      )}

      {/* Barra fina de rodapé */}
      <div className="relative z-10 flex h-10 shrink-0 items-center justify-between border-t border-areia/10 px-4 sm:px-6">
        <Relogio />
        <nav className="hidden items-center gap-4 sm:flex">
          <Link href="/vetor" className="mono-label text-menta">
            Vetor
          </Link>
          <Link href="/criacoes" className="mono-label text-areia/40 hover:text-areia">
            Criações
          </Link>
          <Link href="/planejamento" className="mono-label text-areia/40 hover:text-areia">
            Planejamento
          </Link>
          <Link href="/configuracoes/negocio" className="mono-label text-areia/40 hover:text-areia">
            Negócio
          </Link>
        </nav>
        <span className="mono-label flex items-center gap-1.5 text-areia/30" title="Row Level Security ativo em todas as tabelas do workspace">
          <svg viewBox="0 0 24 24" className="size-3" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          RLS ativo
        </span>
      </div>
    </div>
  );
}
