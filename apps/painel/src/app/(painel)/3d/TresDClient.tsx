"use client";

import { useEffect, useState } from "react";
import { AreaIconBadge } from "@/components/ui/areaIcons";
import ModelPicker from "@/components/ai-suite/ModelPicker";
import AssetPicker from "@/components/ai-suite/AssetPicker";
import GenerationJobCard from "@/components/ai-suite/GenerationJobCard";
import type { GenerationJob } from "@/lib/aiSuite/types";

const NIVEIS_QUALIDADE = [
  { valor: "rapido", label: "Rápido" },
  { valor: "alta_fidelidade", label: "Alta fidelidade" },
] as const;

export default function TresDClient({ clienteId }: { clienteId: string }) {
  const [modo, setModo] = useState<"espaco_real" | "do_zero">("espaco_real");
  const [modelId, setModelId] = useState("auto");
  const [fotos, setFotos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [qualidade, setQualidade] = useState<(typeof NIVEIS_QUALIDADE)[number]["valor"]>("rapido");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);

  useEffect(() => {
    fetch(`/api/ai-suite/jobs?kind=3d`)
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs ?? []));
  }, []);

  async function gerar() {
    if (modo === "espaco_real" && fotos.length === 0) {
      setErro("Envie pelo menos algumas fotos do ambiente.");
      return;
    }
    if (modo === "do_zero" && !prompt.trim()) {
      setErro("Descreva o ambiente que você quer criar.");
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/ai-suite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "3d",
          modelId,
          prompt: prompt || (modo === "espaco_real" ? "reconstrução 3D do ambiente real a partir das fotos enviadas" : undefined),
          referenceAssetIds: fotos.length ? fotos : undefined,
          quantity: 1,
          extra: { modo, qualidade },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não consegui gerar agora.");
        return;
      }
      setJobs((atual) => [data.job, ...atual]);
    } catch {
      setErro("Não consegui gerar agora.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <AreaIconBadge href="/3d" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor / Suíte de IA</p>
            <h1 className="text-2xl font-bold text-areia">Cenas 3D</h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">
          Transforme fotos do seu espaço num tour 3D navegável pro site — ou crie um ambiente do zero a partir de uma descrição.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setModo("espaco_real")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${modo === "espaco_real" ? "bg-ambar text-petroleo" : "border border-areia/15 text-areia/70 hover:border-menta/40"}`}
          >
            Meu espaço real
          </button>
          <button
            type="button"
            onClick={() => setModo("do_zero")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${modo === "do_zero" ? "bg-ambar text-petroleo" : "border border-areia/15 text-areia/70 hover:border-menta/40"}`}
          >
            Criar do zero
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5 rounded-2xl panel p-4">
            <ModelPicker kind="3d" value={modelId} onChange={setModelId} />

            {modo === "espaco_real" ? (
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Fotos do ambiente</p>
                <p className="mb-2 text-xs text-areia/50">Tire de 10 a 20 fotos girando 360° pelo cômodo, com boa luz.</p>
                <AssetPicker clienteId={clienteId} selecionados={fotos} onChange={setFotos} />
              </div>
            ) : (
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Descreva o ambiente</p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ex: sala de espera moderna e acolhedora, luz natural, plantas"
                  rows={4}
                  className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta/50 focus:outline-none"
                />
              </div>
            )}

            {modo === "espaco_real" && (
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Descrição extra (opcional)</p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Alguma parte não fotografada que a IA deve completar?"
                  rows={2}
                  className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta/50 focus:outline-none"
                />
              </div>
            )}

            <div>
              <p className="mono-label mb-1.5 text-areia/50">Qualidade</p>
              <select value={qualidade} onChange={(e) => setQualidade(e.target.value as typeof qualidade)} className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-xs text-areia">
                {NIVEIS_QUALIDADE.map((n) => (
                  <option key={n.valor} value={n.valor}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>

            {erro && <p className="text-xs text-coral">{erro}</p>}

            <button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="btn-tactile w-full rounded-full bg-ambar px-4 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
            >
              {gerando ? "Gerando..." : "Gerar tour 3D"}
            </button>
          </div>

          <div>
            <p className="mono-label mb-3 text-areia/50">Minhas cenas</p>
            {jobs.length === 0 ? (
              <p className="text-sm text-areia/50">Nenhuma cena gerada ainda.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {jobs.map((j) => (
                  <GenerationJobCard key={j.id} jobInicial={j} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
