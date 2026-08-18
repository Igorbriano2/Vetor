"use client";

// Spike isolada do editor de canvas (Fabric.js) — prova o round-trip
// selecionar/editar/desfazer/exportar antes de conectar em design_projects
// de verdade (isso vem na Parte 1 completa). Rota nova, não referenciada em
// nenhum menu ainda — não altera nada do painel existente.

import { useState } from "react";
import DesignCanvasEditor from "@/components/design/DesignCanvasEditor";

export default function DesignEditorSpikePage() {
  const [ultimoSalvamento, setUltimoSalvamento] = useState<string | null>(null);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Editor de Design (spike)</h1>
        <p className="mt-2 text-sm text-areia/60">
          Prova de conceito do editor de canvas — ainda não está conectado a um DesignProject real nem ao Design
          agent. Serve pra validar Fabric.js antes da implementação completa.
        </p>

        <div className="mt-8">
          <DesignCanvasEditor
            width={1080}
            height={1080}
            onAutosave={() => setUltimoSalvamento(new Date().toLocaleTimeString("pt-BR"))}
          />
        </div>

        {ultimoSalvamento && <p className="mt-4 text-xs text-areia/40">Autosave (em memória, spike): {ultimoSalvamento}</p>}
      </div>
    </div>
  );
}
