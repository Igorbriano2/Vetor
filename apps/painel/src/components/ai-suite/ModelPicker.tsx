"use client";

import { useEffect, useState } from "react";
import type { AIModel, MediaKind } from "@/lib/aiSuite/types";

// Componente reutilizável (Fase 4 do prompt-mestre) — usado por Image/Video/
// Voice Generator. "Automático" é o caminho principal (seção 3 do
// prompt-mestre: o cliente leigo não sabe a diferença entre modelos) —
// nunca escondido atrás de um clique extra; o "Modo avançado" é que fica
// atrás de um toggle, nunca o contrário.
export default function ModelPicker({
  kind,
  value,
  onChange,
}: {
  kind: MediaKind;
  value: string; // "auto" ou um AIModel.id
  onChange: (modelId: string) => void;
}) {
  const [modelos, setModelos] = useState<AIModel[]>([]);
  const [modoAvancado, setModoAvancado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    fetch(`/api/ai-suite/models?kind=${kind}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setModelos(data.modelos ?? []);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [kind]);

  const featured = modelos.filter((m) => m.status === "featured");
  const outros = modelos.filter((m) => m.status !== "featured" && m.status !== "deprecated");

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="mono-label text-areia/50">Modelo</p>
        <button type="button" onClick={() => setModoAvancado((v) => !v)} className="text-xs text-menta hover:underline">
          {modoAvancado ? "Ocultar modo avançado" : "Modo avançado"}
        </button>
      </div>

      <div className="mt-2 space-y-2">
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
            value === "auto" ? "border-menta/50 bg-menta/10" : "border-areia/15 hover:border-areia/30"
          }`}
        >
          <input type="radio" name="modelo" checked={value === "auto"} onChange={() => onChange("auto")} className="accent-menta" />
          <div>
            <p className="text-sm font-medium text-areia">Automático (recomendado)</p>
            <p className="text-xs text-areia/50">O Vetor escolhe o melhor modelo pro seu pedido.</p>
          </div>
        </label>

        {modoAvancado && (
          <div className="space-y-3 rounded-xl border border-areia/10 p-3">
            {carregando ? (
              <p className="text-xs text-areia/40">Carregando modelos...</p>
            ) : (
              <>
                {featured.length > 0 && (
                  <div>
                    <p className="mono-label mb-1.5 text-areia/40">Recomendados</p>
                    <div className="space-y-1.5">
                      {featured.map((m) => (
                        <OpcaoModelo key={m.id} modelo={m} selecionado={value === m.id} onSelect={() => onChange(m.id)} />
                      ))}
                    </div>
                  </div>
                )}
                {outros.length > 0 && (
                  <div>
                    <p className="mono-label mb-1.5 text-areia/40">Mais opções</p>
                    <div className="space-y-1.5">
                      {outros.map((m) => (
                        <OpcaoModelo key={m.id} modelo={m} selecionado={value === m.id} onSelect={() => onChange(m.id)} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OpcaoModelo({ modelo, selecionado, onSelect }: { modelo: AIModel; selecionado: boolean; onSelect: () => void }) {
  const badges: string[] = [];
  if (modelo.capabilities.referenceImages) badges.push("Aceita referência");
  if (modelo.capabilities.startEndFrame) badges.push("Quadro inicial/final");
  if (modelo.capabilities.audio) badges.push("Com áudio");
  if (modelo.capabilities.maxResolution) badges.push(`Até ${modelo.capabilities.maxResolution}`);

  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition ${
        selecionado ? "border-menta/50 bg-menta/10" : "border-areia/10 hover:border-areia/25"
      }`}
    >
      <input type="radio" name="modelo" checked={selecionado} onChange={onSelect} className="mt-0.5 accent-menta" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-areia">{modelo.label}</p>
          <span className="rounded-full border border-ambar/30 bg-ambar/10 px-1.5 py-0.5 font-mono text-[10px] text-ambar">{modelo.costCredits} créditos</span>
        </div>
        {modelo.description && <p className="mt-0.5 text-xs text-areia/50">{modelo.description}</p>}
        {badges.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b} className="rounded-full border border-areia/15 px-1.5 py-0.5 text-[10px] text-areia/50">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}
