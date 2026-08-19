"use client";

// Editor não destrutivo do VideoProject (Parte 2) — mesmo raciocínio do
// DesignProjectEditor: autosalva via PATCH direto no Supabase (RLS
// isolado por cliente), "criar versão" insere uma linha nova, undo/redo
// via histórico de snapshots do TimelineDocument.
//
// Escopo desta rodada, dito explicitamente em vez de fingido: preview é
// do CLIP selecionado (não a composição multi-faixa em tempo real —
// exigiria um compositor tipo WebCodecs, fica pra quando o pipeline do
// agente conectar, Parte 5); reposicionar um clip é por campo numérico
// (não arrastar-e-soltar); "Exportar" fica desabilitado até o pipeline
// de render (task #79) existir de verdade — nunca finge um export que
// não roda nada.

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AudioMix, CaptionTrack, TimelineDocument, TrackKind, VideoProjectStatus } from "@/lib/video/timelineTypes";
import type { ClipMidiaResolvida } from "@/lib/video/resolveClipUrls";
import * as ops from "@/lib/video/timelineOps";
import VideoTimeline from "./VideoTimeline";
import ClipPropertiesPanel from "./ClipPropertiesPanel";
import VideoPreviewPlayer from "./VideoPreviewPlayer";
import MediaLibraryPanel, { duracaoPadraoPorMime, type AtivoDeMidia } from "./MediaLibraryPanel";
import CaptionsAndAudioPanel from "./CaptionsAndAudioPanel";

export interface VideoProjectInicial {
  id: string;
  clienteId: string;
  title: string;
  timelineJson: TimelineDocument;
  timelineVersion: number;
  status: VideoProjectStatus;
  clipUrls: Record<string, ClipMidiaResolvida>;
  // URL assinada do MP4 final real (só presente depois que o estágio
  // "final_render" do agente já rodou de verdade — nunca um placeholder).
  outputUrl: string | null;
}

const FAIXAS_DISPONIVEIS: { kind: TrackKind; label: string }[] = [
  { kind: "video", label: "Vídeo" },
  { kind: "image", label: "Imagem" },
  { kind: "audio", label: "Áudio" },
  { kind: "voiceover", label: "Locução" },
];

export default function VideoProjectEditor({ projeto }: { projeto: VideoProjectInicial }) {
  const router = useRouter();
  const [timeline, setTimeline] = useState<TimelineDocument>(projeto.timelineJson);
  const [historico, setHistorico] = useState<TimelineDocument[]>([]);
  const [futuro, setFuturo] = useState<TimelineDocument[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  // Começa com o que o servidor resolveu na abertura do projeto — clipes
  // adicionados NESTA sessão (via biblioteca de mídia) entram aqui na hora
  // (a MediaLibraryPanel já assinou a URL pra mostrar a miniatura, reusa
  // em vez de re-buscar). Sem isso, um clip recém-adicionado mostrava
  // "selecione um clip pra pré-visualizar" mesmo já selecionado — achado
  // ao vivo.
  const [clipMidia, setClipMidia] = useState<Record<string, ClipMidiaResolvida>>(projeto.clipUrls);
  const [status] = useState(projeto.status);
  const [salvando, setSalvando] = useState(false);
  const [criandoVersao, setCriandoVersao] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<string | null>(null);
  const salvarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const salvar = useCallback(
    async (doc: TimelineDocument) => {
      setSalvando(true);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("video_projects")
        .update({ timeline_json: doc, duration_ms: ops.duracaoTotalMs(doc), updated_at: new Date().toISOString() })
        .eq("id", projeto.id);
      setSalvando(false);
      if (!error) setUltimoSalvamento(new Date().toLocaleTimeString("pt-BR"));
    },
    [projeto.id],
  );

  const agendarAutosave = useCallback(
    (doc: TimelineDocument) => {
      if (salvarTimeoutRef.current) clearTimeout(salvarTimeoutRef.current);
      salvarTimeoutRef.current = setTimeout(() => salvar(doc), 800);
    },
    [salvar],
  );

  const aplicar = useCallback(
    (novo: TimelineDocument) => {
      setHistorico((h) => [...h, timeline].slice(-50));
      setFuturo([]);
      setTimeline(novo);
      agendarAutosave(novo);
    },
    [timeline, agendarAutosave],
  );

  function desfazer() {
    if (historico.length === 0) return;
    const anterior = historico[historico.length - 1]!;
    setFuturo((f) => [timeline, ...f]);
    setHistorico((h) => h.slice(0, -1));
    setTimeline(anterior);
    agendarAutosave(anterior);
  }

  function refazer() {
    if (futuro.length === 0) return;
    const proximo = futuro[0]!;
    setHistorico((h) => [...h, timeline]);
    setFuturo((f) => f.slice(1));
    setTimeline(proximo);
    agendarAutosave(proximo);
  }

  const clipSelecionado = useMemo(() => {
    for (const track of timeline.tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  }, [timeline, selectedClipId]);

  function selecionarClip(clipId: string, trackId: string) {
    setSelectedClipId(clipId);
    setSelectedTrackId(trackId);
  }

  function adicionarFaixaNova(kind: TrackKind) {
    aplicar(ops.adicionarFaixa(timeline, kind, FAIXAS_DISPONIVEIS.find((f) => f.kind === kind)?.label ?? kind));
  }

  function adicionarAtivoNaFaixa(ativo: AtivoDeMidia) {
    if (!selectedTrackId) return;
    setClipMidia((atual) => ({ ...atual, [ativo.id]: { url: ativo.url, mimeType: ativo.mimeType } }));
    aplicar(ops.adicionarClipe(timeline, selectedTrackId, { sourceAssetId: ativo.id, durationMs: duracaoPadraoPorMime(ativo.mimeType) }));
  }

  async function criarNovaVersao() {
    setCriandoVersao(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("video_projects")
      .insert({
        cliente_id: projeto.clienteId,
        parent_video_project_id: projeto.id,
        title: projeto.title,
        width: timeline.settings.width,
        height: timeline.settings.height,
        fps: timeline.settings.fps,
        duration_ms: ops.duracaoTotalMs(timeline),
        timeline_json: timeline,
        timeline_version: projeto.timelineVersion + 1,
        status: "draft",
      })
      .select("id")
      .single();
    setCriandoVersao(false);
    if (!error && data) router.push(`/videomaker/editor/${data.id as string}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-areia">
            {projeto.title} <span className="text-areia/40">— versão {projeto.timelineVersion}</span>
          </p>
          <p className="text-xs text-areia/40">
            Status: {status} · {(ops.duracaoTotalMs(timeline) / 1000).toFixed(1)}s
          </p>
          {ultimoSalvamento && <p className="text-xs text-areia/40">Salvo automaticamente às {ultimoSalvamento}</p>}
          {salvando && <p className="text-xs text-menta">Salvando...</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={desfazer} disabled={historico.length === 0} className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5 disabled:opacity-30">
            Desfazer
          </button>
          <button type="button" onClick={refazer} disabled={futuro.length === 0} className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5 disabled:opacity-30">
            Refazer
          </button>
          <button type="button" onClick={criarNovaVersao} disabled={criandoVersao} className="rounded-lg border border-ambar/30 px-3 py-1.5 text-xs text-ambar hover:bg-ambar/10 disabled:opacity-50">
            {criandoVersao ? "Criando..." : "Criar versão"}
          </button>
          {projeto.outputUrl ? (
            <a
              href={projeto.outputUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-menta/30 px-3 py-1.5 text-xs text-menta hover:bg-menta/10"
            >
              Baixar vídeo final
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Vídeo final ainda não foi renderizado pelo agente (estágio final_render) — nunca finge um render que não rodou."
              className="rounded-lg border border-areia/10 px-3 py-1.5 text-xs text-areia/30"
            >
              Vídeo final (ainda não renderizado)
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-3">
          <VideoPreviewPlayer
            clip={clipSelecionado}
            url={clipSelecionado ? (clipMidia[clipSelecionado.sourceAssetId]?.url ?? null) : null}
            mimeType={clipSelecionado ? (clipMidia[clipSelecionado.sourceAssetId]?.mimeType ?? null) : null}
          />
          <VideoTimeline
            timeline={timeline}
            selectedClipId={selectedClipId}
            selectedTrackId={selectedTrackId}
            onSelectClip={selecionarClip}
            onSelectTrack={setSelectedTrackId}
            playheadMs={playheadMs}
            onSeek={setPlayheadMs}
            duracaoTotalMs={ops.duracaoTotalMs(timeline)}
          />
          <div className="flex items-center gap-2">
            <span className="mono-label text-areia/50">Adicionar faixa:</span>
            {FAIXAS_DISPONIVEIS.map((f) => (
              <button
                key={f.kind}
                type="button"
                onClick={() => adicionarFaixaNova(f.kind)}
                className="rounded-lg border border-areia/15 px-2 py-1 text-xs hover:bg-areia/5"
              >
                + {f.label}
              </button>
            ))}
          </div>
          <CaptionsAndAudioPanel
            captions={timeline.captions}
            audioMix={timeline.audioMix}
            playheadMs={playheadMs}
            onChangeCaptions={(novo: CaptionTrack) => aplicar({ ...timeline, captions: novo })}
            onChangeAudioMix={(novo: AudioMix) => aplicar({ ...timeline, audioMix: novo })}
          />
        </div>

        <div className="space-y-3">
          <ClipPropertiesPanel
            clip={clipSelecionado}
            onChange={(patch) => clipSelecionado && aplicar(ops.atualizarPropriedadesClipe(timeline, clipSelecionado.id, patch))}
            onMover={(novoStartMs) => clipSelecionado && aplicar(ops.moverClipe(timeline, clipSelecionado.id, novoStartMs))}
            onRemover={() => {
              if (!clipSelecionado) return;
              aplicar(ops.removerClipe(timeline, clipSelecionado.id));
              setSelectedClipId(null);
            }}
            onDividir={() => clipSelecionado && aplicar(ops.dividirClipeNoPlayhead(timeline, clipSelecionado.id, playheadMs))}
          />
          <MediaLibraryPanel clienteId={projeto.clienteId} faixaSelecionadaId={selectedTrackId} onAdicionar={adicionarAtivoNaFaixa} />
        </div>
      </div>
    </div>
  );
}
