"use client";

import { useEffect, useState } from "react";
import type { Template } from "@/lib/aiSuite/types";

const LABEL_NICHO: Record<string, string> = {
  restaurante: "Restaurante",
  advocacia: "Advocacia",
  clinica: "Clínica",
  geral: "Geral",
};

// Componente reutilizável (Fase 4) — grade de templates por nicho/categoria,
// usada em Image/Video/Voice/Design. Estado vazio de cada ferramenta puxa o
// nicho do cliente automaticamente (niche prop já vem resolvida pelo
// server component da página, ver /imagem/page.tsx).
export default function TemplateGallery({
  mediaKind,
  niche,
  onUsar,
}: {
  mediaKind: string;
  niche: string;
  onUsar: (template: Template) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    fetch(`/api/ai-suite/templates?mediaKind=${mediaKind}&niche=${niche}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setTemplates(data.templates ?? []);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [mediaKind, niche]);

  if (carregando) return <p className="text-xs text-areia/40">Carregando modelos prontos...</p>;
  if (templates.length === 0) return <p className="text-xs text-areia/40">Nenhum modelo pronto pra este nicho ainda.</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {templates.map((t) => (
        <div key={t.id} className="group relative overflow-hidden rounded-2xl card-lift panel">
          <div className="flex h-28 w-full items-center justify-center bg-petroleo-2 font-mono text-[10px] uppercase tracking-wide text-areia/30">
            {t.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.thumbnail_url} alt={t.title} className="h-full w-full object-cover" />
            ) : (
              LABEL_NICHO[t.niche] ?? t.niche
            )}
          </div>
          <div className="p-3">
            <p className="text-sm font-medium text-areia">{t.title}</p>
            {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-areia/50">{t.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onUsar(t)}
            className="absolute inset-x-3 bottom-3 rounded-lg bg-ambar px-3 py-1.5 text-xs font-semibold text-petroleo opacity-0 transition group-hover:opacity-100"
          >
            Usar
          </button>
        </div>
      ))}
    </div>
  );
}
