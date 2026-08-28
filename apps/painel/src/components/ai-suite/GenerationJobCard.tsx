"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerationJob } from "@/lib/aiSuite/types";

const INTERVALO_POLL_MS = 1500;

const LABEL_STATUS: Record<string, string> = {
  queued: "Na fila",
  processing: "Gerando...",
  done: "Concluído",
  failed: "Falhou",
};

// Card de 1 job — faz o próprio polling de status enquanto queued/
// processing (nunca deixa o cliente com uma tela "gerando" pra sempre sem
// atualizar). Mostra claramente quando o asset é um MOCK (nenhuma chave de
// provider real configurada ainda, ver docs/relatorio-manha.md) — nunca
// finge que é uma imagem/vídeo de verdade.
export default function GenerationJobCard({ jobInicial }: { jobInicial: GenerationJob }) {
  const [job, setJob] = useState(jobInicial);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJob(jobInicial);
  }, [jobInicial]);

  useEffect(() => {
    if (job.status === "done" || job.status === "failed") return;

    intervaloRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai-suite/jobs/${job.id}/status`);
        const data = await res.json();
        if (data.job) setJob(data.job);
      } catch {
        // Silencioso — próximo tick tenta de novo, nunca quebra a tela por
        // uma falha transitória de rede do polling.
      }
    }, INTERVALO_POLL_MS);

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, [job.id, job.status]);

  const ehMock = job.provider_id === "mock";

  return (
    <div className="overflow-hidden rounded-2xl panel">
      <div className="flex h-40 w-full items-center justify-center bg-petroleo-2">
        {job.status === "done" && job.result_asset_urls.length > 0 ? (
          ehMock ? (
            <div className="grid h-full w-full grid-cols-2 gap-px bg-areia/5">
              {job.result_asset_urls.slice(0, 4).map((url) => (
                <div key={url} className="flex items-center justify-center bg-petroleo-2 font-mono text-[9px] text-areia/30">
                  pré-visualização (mock)
                </div>
              ))}
            </div>
          ) : job.kind === "voice" ? (
            <div className="flex w-full flex-col gap-2 px-4">
              {job.result_asset_urls.map((url) => (
                <audio key={url} controls src={url} className="w-full" />
              ))}
            </div>
          ) : job.kind === "image" ? (
            <div className="grid h-full w-full grid-cols-2 gap-px bg-areia/5">
              {job.result_asset_urls.slice(0, 4).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
          ) : job.kind === "video" ? (
            <video controls src={job.result_asset_urls[0]} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-areia/40">Concluído</div>
          )
        ) : job.status === "failed" ? (
          <p className="px-4 text-center text-xs text-coral">{job.error ?? "Falha na geração"}</p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="size-5 animate-spin rounded-full border-2 border-menta/30 border-t-menta" />
            <p className="font-mono text-[10px] uppercase tracking-wide text-areia/40">{LABEL_STATUS[job.status]}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between p-3">
        <p className="text-xs text-areia/50">{(job.request?.prompt as string) || "Sem prompt"}</p>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${
            job.status === "done"
              ? "border-menta/30 bg-menta/10 text-menta"
              : job.status === "failed"
                ? "border-coral/40 bg-coral/10 text-coral"
                : "border-ambar/40 bg-ambar/10 text-ambar animate-pulse"
          }`}
        >
          {LABEL_STATUS[job.status]}
        </span>
      </div>
    </div>
  );
}
