"use client";

import { useEffect, useState } from "react";
import { AreaIconBadge } from "@/components/ui/areaIcons";
import ModelPicker from "@/components/ai-suite/ModelPicker";
import AssetPicker from "@/components/ai-suite/AssetPicker";
import TemplateGallery from "@/components/ai-suite/TemplateGallery";
import GenerationJobCard from "@/components/ai-suite/GenerationJobCard";
import type { GenerationJob, Template } from "@/lib/aiSuite/types";

const FORMATOS = [
  { valor: "9:16", label: "Vertical (Stories/Reels)" },
  { valor: "1:1", label: "Quadrado (feed)" },
  { valor: "16:9", label: "Paisagem (site/YouTube)" },
] as const;

const DURACOES = [4, 6, 8, 10, 15] as const;

export default function VideoIaClient({ clienteId, nicho }: { clienteId: string; nicho: string }) {
  const [modelId, setModelId] = useState("auto");
  const [quadroInicial, setQuadroInicial] = useState<string | null>(null);
  const [quadroFinal, setQuadroFinal] = useState<string | null>(null);
  // Roteiro/Shots (seção "Módulo 2" do prompt-mestre) — botão "+ Adicionar
  // cena" empilha blocos, nunca exige sintaxe de @img1/@vid1 do cliente.
  // Simplificação real desta rodada: as cenas são concatenadas num prompt
  // só (o adapter ainda não decompõe em cortes reais) — documentado em
  // docs/relatorio-manha.md.
  const [cenas, setCenas] = useState<string[]>([""]);
  const [formato, setFormato] = useState<(typeof FORMATOS)[number]["valor"]>("9:16");
  const [duracao, setDuracao] = useState<number>(6);
  const [comAudio, setComAudio] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [aba, setAba] = useState<"criacoes" | "templates">("criacoes");

  useEffect(() => {
    fetch(`/api/ai-suite/jobs?kind=video`)
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs ?? []));
  }, []);

  function atualizarCena(i: number, valor: string) {
    setCenas((atual) => atual.map((c, idx) => (idx === i ? valor : c)));
  }
  function removerCena(i: number) {
    setCenas((atual) => (atual.length > 1 ? atual.filter((_, idx) => idx !== i) : atual));
  }

  async function gerar() {
    const promptFinal = cenas.map((c) => c.trim()).filter(Boolean).join(" Depois, ");
    if (!promptFinal) {
      setErro("Descreva pelo menos uma cena.");
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/ai-suite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "video",
          modelId,
          prompt: promptFinal,
          startFrameAssetId: quadroInicial ?? undefined,
          endFrameAssetId: quadroFinal ?? undefined,
          aspectRatio: formato,
          durationSeconds: duracao,
          quantity: 1,
          extra: { comAudio },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não consegui gerar agora.");
        return;
      }
      setJobs((atual) => [data.job, ...atual]);
      setAba("criacoes");
    } catch {
      setErro("Não consegui gerar agora.");
    } finally {
      setGerando(false);
    }
  }

  function usarTemplate(t: Template) {
    const cfg = t.prompt_or_config as { prompt?: string; aspectRatio?: string; durationSeconds?: number };
    if (cfg.prompt) setCenas([cfg.prompt]);
    if (cfg.aspectRatio) setFormato(cfg.aspectRatio as typeof formato);
    if (cfg.durationSeconds) setDuracao(cfg.durationSeconds);
    setAba("criacoes");
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <AreaIconBadge href="/video-ia" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor / Suíte de IA</p>
            <h1 className="text-2xl font-bold text-areia">Gerador de Vídeo</h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">
          Gere um clipe novo a partir de texto ou fotos — depois, se quiser, edite ele com precisão no Videomaker.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5 rounded-2xl panel p-4">
            <ModelPicker kind="video" value={modelId} onChange={setModelId} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Quadro inicial</p>
                <AssetPicker clienteId={clienteId} selecionados={quadroInicial ? [quadroInicial] : []} onChange={(ids) => setQuadroInicial(ids[ids.length - 1] ?? null)} />
              </div>
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Quadro final (opcional)</p>
                <AssetPicker clienteId={clienteId} selecionados={quadroFinal ? [quadroFinal] : []} onChange={(ids) => setQuadroFinal(ids[ids.length - 1] ?? null)} />
              </div>
            </div>

            <div>
              <p className="mono-label mb-1.5 text-areia/50">Roteiro</p>
              <div className="space-y-2">
                {cenas.map((cena, i) => (
                  <div key={i} className="flex gap-1.5">
                    <textarea
                      value={cena}
                      onChange={(e) => atualizarCena(i, e.target.value)}
                      placeholder={i === 0 ? "Descreva a cena — ex: câmera se aproxima do prato fumegante na mesa" : `Cena ${i + 1}`}
                      rows={2}
                      className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta/50 focus:outline-none"
                    />
                    {cenas.length > 1 && (
                      <button type="button" onClick={() => removerCena(i)} className="shrink-0 text-areia/30 hover:text-coral" aria-label="Remover cena">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setCenas((a) => [...a, ""])} className="mt-1.5 text-xs text-menta hover:underline">
                + Adicionar cena
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Formato</p>
                <select value={formato} onChange={(e) => setFormato(e.target.value as typeof formato)} className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-xs text-areia">
                  {FORMATOS.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Duração</p>
                <select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-xs text-areia">
                  {DURACOES.map((d) => (
                    <option key={d} value={d}>
                      {d}s
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-areia">
              <input type="checkbox" checked={comAudio} onChange={(e) => setComAudio(e.target.checked)} className="accent-menta" />
              Gerar com áudio
            </label>

            {erro && <p className="text-xs text-coral">{erro}</p>}

            <button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="btn-tactile w-full rounded-full bg-ambar px-4 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
            >
              {gerando ? "Gerando..." : "Gerar"}
            </button>
          </div>

          <div>
            <div className="flex gap-2 border-b border-areia/10">
              <button
                type="button"
                onClick={() => setAba("criacoes")}
                className={`px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${aba === "criacoes" ? "border-b-2 border-menta text-menta" : "text-areia/40 hover:text-areia/70"}`}
              >
                Minhas criações
              </button>
              <button
                type="button"
                onClick={() => setAba("templates")}
                className={`px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${aba === "templates" ? "border-b-2 border-menta text-menta" : "text-areia/40 hover:text-areia/70"}`}
              >
                Modelos prontos
              </button>
            </div>

            <div className="mt-4">
              {aba === "criacoes" ? (
                jobs.length === 0 ? (
                  <div>
                    <p className="mb-4 text-sm text-areia/50">Nenhuma criação ainda — que tal começar por um modelo pronto do seu nicho?</p>
                    <TemplateGallery mediaKind="video" niche={nicho} onUsar={usarTemplate} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {jobs.map((j) => (
                      <GenerationJobCard key={j.id} jobInicial={j} />
                    ))}
                  </div>
                )
              ) : (
                <TemplateGallery mediaKind="video" niche={nicho} onUsar={usarTemplate} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
