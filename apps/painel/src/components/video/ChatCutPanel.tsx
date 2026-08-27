"use client";

import { useState } from "react";
import type { TimelineDocument } from "@/lib/video/timelineTypes";
import * as ops from "@/lib/video/timelineOps";

// "ChatCut" — chat de IA lateral pra editar a timeline por comando em
// português (achado na auditoria do curso Vendus Content Studio: era o
// maior gap do editor do Vetor comparado ao editor-com-IA-do-lado que o
// curso ensina a construir). Nunca aplica nada por conta própria — o
// backend (apps/agentes, planejarEdicoesTimeline) só devolve um PLANO de
// operações; quem aplica de fato é sempre `aplicar` (a mesma função que já
// dá undo/redo/autosave pro editor manual — reaproveitada, nunca duplicada).

interface OperacaoTimeline {
  tipo: "remover_clipe" | "mover_clipe" | "dividir_clipe" | "atualizar_propriedades_clipe" | "adicionar_faixa" | "remover_faixa";
  clip_id?: string;
  track_id?: string;
  novo_start_ms?: number;
  playhead_ms?: number;
  patch?: { trim_in_ms?: number; trim_out_ms?: number; speed?: number; volume?: number };
  kind?: "video" | "image" | "audio" | "voiceover";
  nome_faixa?: string;
}

interface Mensagem {
  role: "user" | "assistant";
  texto: string;
}

const LABEL_FAIXA: Record<string, string> = { video: "Vídeo", image: "Imagem", audio: "Áudio", captions: "Legendas", voiceover: "Locução", effects: "Efeitos" };

// Reduz o TimelineDocument completo (que carrega keyframes/transform/
// transições) pro subconjunto que o modelo precisa pra decidir operações —
// nunca manda bytes de mídia, nunca manda mais contexto do que o
// necessário pra interpretar o pedido.
function montarResumoTimeline(timeline: TimelineDocument) {
  const clipes = timeline.tracks.flatMap((t) =>
    t.clips.map((c) => ({
      id: c.id,
      trackId: t.id,
      trackNome: t.name,
      sourceAssetId: c.sourceAssetId,
      startMs: c.startMs,
      durationMs: c.durationMs,
      speed: c.speed,
      volume: c.volume,
    })),
  );
  return {
    duracaoTotalMs: ops.duracaoTotalMs(timeline),
    faixas: timeline.tracks.map((t) => ({ id: t.id, kind: t.kind, nome: t.name })),
    clipes,
  };
}

// Aplica cada operação do plano, em sequência, sobre a timeline recebida —
// pura (não muta), o chamador decide quando/como persistir o resultado
// final. Operação com id desconhecido (clip_id/track_id que não existe
// mais na timeline atual) é ignorada silenciosamente aqui e reportada pelo
// chamador — nunca lança e perde as operações anteriores que já valiam.
function aplicarOperacoes(timelineInicial: TimelineDocument, operacoes: OperacaoTimeline[]): { timeline: TimelineDocument; ignoradas: number } {
  let timeline = timelineInicial;
  let ignoradas = 0;

  const existeClip = (id: string) => timeline.tracks.some((t) => t.clips.some((c) => c.id === id));
  const existeTrack = (id: string) => timeline.tracks.some((t) => t.id === id);

  for (const op of operacoes) {
    switch (op.tipo) {
      case "remover_clipe":
        if (op.clip_id && existeClip(op.clip_id)) timeline = ops.removerClipe(timeline, op.clip_id);
        else ignoradas++;
        break;
      case "mover_clipe":
        if (op.clip_id && existeClip(op.clip_id) && typeof op.novo_start_ms === "number") timeline = ops.moverClipe(timeline, op.clip_id, op.novo_start_ms);
        else ignoradas++;
        break;
      case "dividir_clipe":
        if (op.clip_id && existeClip(op.clip_id) && typeof op.playhead_ms === "number") timeline = ops.dividirClipeNoPlayhead(timeline, op.clip_id, op.playhead_ms);
        else ignoradas++;
        break;
      case "atualizar_propriedades_clipe":
        if (op.clip_id && existeClip(op.clip_id) && op.patch) {
          timeline = ops.atualizarPropriedadesClipe(timeline, op.clip_id, {
            ...(op.patch.trim_in_ms != null ? { trimInMs: op.patch.trim_in_ms } : {}),
            ...(op.patch.trim_out_ms != null ? { trimOutMs: op.patch.trim_out_ms } : {}),
            ...(op.patch.speed != null ? { speed: op.patch.speed } : {}),
            ...(op.patch.volume != null ? { volume: op.patch.volume } : {}),
          });
        } else ignoradas++;
        break;
      case "adicionar_faixa":
        if (op.kind && op.nome_faixa) timeline = ops.adicionarFaixa(timeline, op.kind, op.nome_faixa);
        else ignoradas++;
        break;
      case "remover_faixa":
        if (op.track_id && existeTrack(op.track_id)) timeline = ops.removerFaixa(timeline, op.track_id);
        else ignoradas++;
        break;
      default:
        ignoradas++;
    }
  }

  return { timeline, ignoradas };
}

export default function ChatCutPanel({ timeline, onAplicar }: { timeline: TimelineDocument; onAplicar: (novo: TimelineDocument) => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const texto = input.trim();
    if (!texto || enviando) return;
    setInput("");
    setEnviando(true);
    const historico = mensagens.slice(-6);
    setMensagens((m) => [...m, { role: "user", texto }]);

    try {
      const res = await fetch("/api/videomaker/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumo: montarResumoTimeline(timeline), mensagem: texto, historico }),
      });
      if (!res.ok) {
        setMensagens((m) => [...m, { role: "assistant", texto: "Não consegui processar esse pedido agora — tenta de novo em instantes." }]);
        return;
      }
      const plano = (await res.json()) as { resposta: string; operacoes: OperacaoTimeline[] };

      if (plano.operacoes.length > 0) {
        const { timeline: novaTimeline, ignoradas } = aplicarOperacoes(timeline, plano.operacoes);
        onAplicar(novaTimeline);
        const sufixo = ignoradas > 0 ? ` (${ignoradas} operação(ões) não puderam ser aplicadas — o clip/faixa pode já ter mudado.)` : "";
        setMensagens((m) => [...m, { role: "assistant", texto: plano.resposta + sufixo }]);
      } else {
        setMensagens((m) => [...m, { role: "assistant", texto: plano.resposta }]);
      }
    } catch {
      setMensagens((m) => [...m, { role: "assistant", texto: "Não consegui me conectar agora — tenta de novo em instantes." }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-areia/10 bg-petroleo-2/60">
      <div className="border-b border-areia/10 px-3 py-2.5">
        <p className="text-sm font-medium text-areia">ChatCut</p>
        <p className="text-[11px] text-areia/40">Peça ajustes na timeline em português — cortar, mover, acelerar, remover faixa.</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" style={{ minHeight: 200, maxHeight: 360 }}>
        {mensagens.length === 0 && (
          <p className="text-xs text-areia/30">
            Ex: &ldquo;corta os 3 primeiros segundos do primeiro clipe&rdquo;, &ldquo;deixa o segundo clipe da faixa de vídeo mais lento&rdquo;, &ldquo;remove a
            faixa de áudio&rdquo;.
          </p>
        )}
        {mensagens.map((m, i) => (
          <div key={i} className={`max-w-[90%] rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "ml-auto bg-menta/10 text-areia" : "bg-petroleo-3/60 text-areia/80"}`}>
            {m.texto}
          </div>
        ))}
        {enviando && <div className="max-w-[90%] rounded-xl bg-petroleo-3/60 px-3 py-2 text-xs text-areia/40">Pensando...</div>}
      </div>

      <div className="flex items-center gap-2 border-t border-areia/10 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Descreva o ajuste..."
          disabled={enviando}
          className="flex-1 rounded-lg border border-areia/15 bg-petroleo-3/60 px-3 py-1.5 text-xs text-areia placeholder:text-areia/30 focus:border-menta/40 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={enviar}
          disabled={enviando || !input.trim()}
          className="rounded-lg bg-ambar px-3 py-1.5 text-xs font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
