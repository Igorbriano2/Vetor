"use client";

import { useEffect, useRef, useState } from "react";
import { AreaIconBadge } from "@/components/ui/areaIcons";
import ModelPicker from "@/components/ai-suite/ModelPicker";
import VoicePicker from "@/components/ai-suite/VoicePicker";
import TemplateGallery from "@/components/ai-suite/TemplateGallery";
import GenerationJobCard from "@/components/ai-suite/GenerationJobCard";
import type { GenerationJob, Template } from "@/lib/aiSuite/types";

// Tags de emoção/pausa expostas como BOTÕES (nunca sintaxe crua tipo
// "[laughs]" — o dono de pequeno negócio não deveria precisar aprender
// isso, ver Módulo 3 do prompt-mestre) — inserem o marcador na posição do
// cursor do roteiro.
const MARCADORES = [
  { label: "Pausa", tag: "[pausa]" },
  { label: "Ênfase", tag: "[ênfase]" },
  { label: "Risada", tag: "[risada]" },
] as const;

export default function VozClient({ nicho }: { nicho: string }) {
  const [modelId, setModelId] = useState("auto");
  const [vozes, setVozes] = useState<string[]>([]);
  const [roteiro, setRoteiro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [aba, setAba] = useState<"criacoes" | "templates">("criacoes");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/ai-suite/jobs?kind=voice`)
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs ?? []));
  }, []);

  function inserirMarcador(tag: string) {
    const el = textareaRef.current;
    if (!el) {
      setRoteiro((r) => `${r} ${tag}`);
      return;
    }
    const inicio = el.selectionStart ?? roteiro.length;
    const fim = el.selectionEnd ?? roteiro.length;
    const novo = `${roteiro.slice(0, inicio)}${tag} ${roteiro.slice(fim)}`;
    setRoteiro(novo);
    requestAnimationFrame(() => {
      el.focus();
      const posicao = inicio + tag.length + 1;
      el.setSelectionRange(posicao, posicao);
    });
  }

  async function gerar() {
    if (!roteiro.trim()) {
      setErro("Escreva o roteiro.");
      return;
    }
    if (vozes.length === 0) {
      setErro("Escolha pelo menos 1 voz.");
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/ai-suite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "voice", modelId, prompt: roteiro, quantity: 1, extra: { voiceIds: vozes } }),
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
    const cfg = t.prompt_or_config as { prompt?: string };
    if (cfg.prompt) setRoteiro(cfg.prompt);
    setAba("criacoes");
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <AreaIconBadge href="/voz" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor / Suíte de IA</p>
            <h1 className="text-2xl font-bold text-areia">Gerador de Voz</h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">Transforme um roteiro em áudio com voz natural — pra locução, depoimento ou vídeo institucional.</p>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5 rounded-2xl panel p-4">
            <ModelPicker kind="voice" value={modelId} onChange={setModelId} />
            <VoicePicker selecionadas={vozes} onChange={setVozes} />

            <div>
              <div className="flex items-center justify-between">
                <p className="mono-label text-areia/50">Roteiro</p>
                <div className="flex gap-1">
                  {MARCADORES.map((m) => (
                    <button key={m.tag} type="button" onClick={() => inserirMarcador(m.tag)} className="rounded-full border border-areia/15 px-2 py-0.5 text-[10px] text-areia/60 hover:border-menta/40 hover:text-menta">
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={roteiro}
                onChange={(e) => setRoteiro(e.target.value)}
                placeholder="Escreva o que a voz vai falar..."
                rows={8}
                className="mt-1.5 w-full rounded-xl border border-areia/15 bg-petroleo-2 p-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta/50 focus:outline-none"
              />
            </div>

            {erro && <p className="text-xs text-coral">{erro}</p>}

            <button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="btn-tactile w-full rounded-full bg-ambar px-4 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
            >
              {gerando ? "Gerando..." : "Gerar áudio"}
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
                Roteiros prontos
              </button>
            </div>

            <div className="mt-4">
              {aba === "criacoes" ? (
                jobs.length === 0 ? (
                  <div>
                    <p className="mb-4 text-sm text-areia/50">Nenhuma criação ainda — que tal começar por um roteiro pronto do seu nicho?</p>
                    <TemplateGallery mediaKind="voice" niche={nicho} onUsar={usarTemplate} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {jobs.map((j) => (
                      <GenerationJobCard key={j.id} jobInicial={j} />
                    ))}
                  </div>
                )
              ) : (
                <TemplateGallery mediaKind="voice" niche={nicho} onUsar={usarTemplate} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
