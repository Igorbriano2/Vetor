"use client";

// Preview do clip selecionado — nunca a composição completa da timeline
// (isso exigiria um compositor em tempo real de múltiplas faixas, fora do
// escopo desta rodada: ver Parte 5 da spec, "preview pode usar WebCodecs"
// fica pra quando o pipeline do agente estiver conectado). Ainda assim é
// um preview real: reproduz o arquivo de origem de verdade, recortado no
// trecho que o trim do clip define.

import { useEffect, useRef } from "react";
import type { Clip } from "@/lib/video/timelineTypes";

export default function VideoPreviewPlayer({
  clip,
  url,
  mimeType,
}: {
  clip: Clip | null;
  url: string | null;
  mimeType: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !clip) return;
    el.currentTime = clip.trimInMs / 1000;
    el.playbackRate = clip.speed;
    el.volume = Math.min(1, clip.volume);
  }, [clip]);

  if (!clip || !url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-areia/10 bg-petroleo-2/40 text-xs text-areia/40">
        Selecione um clip pra pré-visualizar
      </div>
    );
  }

  const ehVideo = mimeType?.startsWith("video/") ?? true;

  return (
    <div className="overflow-hidden rounded-xl border border-areia/10 bg-black">
      {ehVideo ? (
        <video ref={videoRef} src={url} controls className="aspect-video w-full" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Preview do clip" className="aspect-video w-full object-contain" />
      )}
    </div>
  );
}
