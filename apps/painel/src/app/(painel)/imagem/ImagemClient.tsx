"use client";

import { useEffect, useState } from "react";
import { AreaIconBadge } from "@/components/ui/areaIcons";
import ModelPicker from "@/components/ai-suite/ModelPicker";
import AssetPicker from "@/components/ai-suite/AssetPicker";
import TemplateGallery from "@/components/ai-suite/TemplateGallery";
import GenerationJobCard from "@/components/ai-suite/GenerationJobCard";
import type { GenerationJob, Template } from "@/lib/aiSuite/types";

const FORMATOS = [
  { valor: "1:1", label: "Quadrado (Instagram feed)" },
  { valor: "9:16", label: "Vertical (Stories/Reels)" },
  { valor: "16:9", label: "Paisagem (banner de site)" },
] as const;

export default function ImagemClient({ clienteId, nicho }: { clienteId: string; nicho: string }) {
  const [modelId, setModelId] = useState("auto");
  const [referencias, setReferencias] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [melhorando, setMelhorando] = useState(false);
  const [formato, setFormato] = useState<(typeof FORMATOS)[number]["valor"]>("1:1");
  const [quantidade, setQuantidade] = useState(1);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [aba, setAba] = useState<"criacoes" | "templates">("criacoes");

  useEffect(() => {
    fetch(`/api/ai-suite/jobs?kind=image`)
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs ?? []));
  }, []);

  async function melhorarPrompt() {
    if (!prompt.trim()) return;
    setMelhorando(true);
    try {
      const res = await fetch("/api/ai-suite/melhorar-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, kind: "image" }),
      });
      const data = await res.json();
      if (data.promptMelhorado) setPrompt(data.promptMelhorado);
    } finally {
      setMelhorando(false);
    }
  }

  async function gerar() {
    if (!prompt.trim()) {
      setErro("Descreva o que você quer gerar.");
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/ai-suite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          modelId,
          prompt,
          negativePrompt: negativePrompt || undefined,
          referenceAssetIds: referencias.length ? referencias : undefined,
          aspectRatio: formato,
          quantity: quantidade,
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
    const cfg = t.prompt_or_config as { prompt?: string; negativePrompt?: string; aspectRatio?: string };
    if (cfg.prompt) setPrompt(cfg.prompt);
    if (cfg.negativePrompt) setNegativePrompt(cfg.negativePrompt);
    if (cfg.aspectRatio) setFormato(cfg.aspectRatio as typeof formato);
    setAba("criacoes");
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <AreaIconBadge href="/imagem" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor / Suíte de IA</p>
            <h1 className="text-2xl font-bold text-areia">Gerador de Imagem</h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">
          Gere fotos e artes na hora — descreva o que precisa, escolha o formato e pronto. Modo Automático escolhe o
          melhor modelo pra você.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          {/* Painel de configuração — coluna esquerda, layout de 2 colunas do prompt-mestre */}
          <div className="space-y-5 rounded-2xl panel p-4">
            <ModelPicker kind="image" value={modelId} onChange={setModelId} />

            <div>
              <p className="mono-label mb-1.5 text-areia/50">Referências ({referencias.length}/8)</p>
              <AssetPicker clienteId={clienteId} selecionados={referencias} onChange={setReferencias} />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="mono-label text-areia/50">Prompt</p>
                <button type="button" onClick={melhorarPrompt} disabled={melhorando || !prompt.trim()} className="text-xs text-menta hover:underline disabled:opacity-40">
                  {melhorando ? "Melhorando..." : "✨ Melhorar com IA"}
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Descreva a foto que você precisa — ex: prato de risoto de camarão em mesa de madeira, luz natural"
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta/50 focus:outline-none"
              />
            </div>

            <div>
              <p className="mono-label mb-1.5 text-areia/50">O que evitar (opcional)</p>
              <input
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Ex: sem texto, sem pessoas, sem fundo bagunçado"
                className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Formato</p>
                <select
                  value={formato}
                  onChange={(e) => setFormato(e.target.value as typeof formato)}
                  className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-xs text-areia"
                >
                  {FORMATOS.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mono-label mb-1.5 text-areia/50">Quantidade</p>
                <select
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  className="w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-xs text-areia"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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

          {/* Resultado / galeria — coluna direita */}
          <div>
            <div className="flex gap-2 border-b border-areia/10">
              <button
                type="button"
                onClick={() => setAba("criacoes")}
                className={`px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${
                  aba === "criacoes" ? "border-b-2 border-menta text-menta" : "text-areia/40 hover:text-areia/70"
                }`}
              >
                Minhas criações
              </button>
              <button
                type="button"
                onClick={() => setAba("templates")}
                className={`px-3 py-2 font-mono text-xs uppercase tracking-widest transition ${
                  aba === "templates" ? "border-b-2 border-menta text-menta" : "text-areia/40 hover:text-areia/70"
                }`}
              >
                Modelos prontos
              </button>
            </div>

            <div className="mt-4">
              {aba === "criacoes" ? (
                jobs.length === 0 ? (
                  <div>
                    <p className="mb-4 text-sm text-areia/50">Nenhuma criação ainda — que tal começar por um modelo pronto do seu nicho?</p>
                    <TemplateGallery mediaKind="image" niche={nicho} onUsar={usarTemplate} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {jobs.map((j) => (
                      <GenerationJobCard key={j.id} jobInicial={j} />
                    ))}
                  </div>
                )
              ) : (
                <TemplateGallery mediaKind="image" niche={nicho} onUsar={usarTemplate} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
