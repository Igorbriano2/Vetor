"use client";

// Conecta o DesignCanvasEditor (spike) a um design_projects real: carrega
// canvas_json, autosalva via PATCH direto no Supabase (RLS isolado por
// cliente — mesmo padrão de business_assets, não o padrão read-only de
// artifacts), "criar versão" insere uma linha nova (parent_design_project_id
// + version+1), exporta PNG e sobe o thumbnail no bucket brand-assets já
// existente (reaproveitado, não criamos bucket novo).

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DesignCanvasEditor from "./DesignCanvasEditor";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DesignProjectStatus } from "@/lib/design/types";

export interface DesignProjectInicial {
  id: string;
  clienteId: string;
  title: string;
  width: number;
  height: number;
  canvasJson: unknown;
  version: number;
  status: DesignProjectStatus;
}

export default function DesignProjectEditor({ projeto }: { projeto: DesignProjectInicial }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<string | null>(null);
  const [criandoVersao, setCriandoVersao] = useState(false);
  const canvasJsonAtualRef = useRef<unknown>(projeto.canvasJson);

  const salvar = useCallback(
    async (canvasJson: unknown) => {
      canvasJsonAtualRef.current = canvasJson;
      setSalvando(true);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("design_projects")
        .update({ canvas_json: canvasJson, updated_at: new Date().toISOString() })
        .eq("id", projeto.id);
      setSalvando(false);
      if (!error) setUltimoSalvamento(new Date().toLocaleTimeString("pt-BR"));
    },
    [projeto.id],
  );

  async function criarNovaVersao() {
    setCriandoVersao(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("design_projects")
      .insert({
        cliente_id: projeto.clienteId,
        parent_design_project_id: projeto.id,
        title: projeto.title,
        width: projeto.width,
        height: projeto.height,
        canvas_json: canvasJsonAtualRef.current,
        version: projeto.version + 1,
        status: "draft",
      })
      .select("id")
      .single();
    setCriandoVersao(false);
    if (!error && data) router.push(`/design/editor/${data.id as string}`);
  }

  async function exportarEsalvarThumbnail() {
    // Reaproveita o mesmo <canvas> já montado — pega o PNG via toDataURL,
    // nunca gera uma segunda renderização em paralelo.
    const canvasEl = document.querySelector<HTMLCanvasElement>("canvas.lower-canvas");
    if (!canvasEl) return;
    const dataUrl = canvasEl.toDataURL("image/png");
    const bytes = await (await fetch(dataUrl)).blob();
    const path = `${projeto.clienteId}/design-projects/${projeto.id}/thumb.png`;
    const supabase = createSupabaseBrowserClient();
    const { error: erroUpload } = await supabase.storage.from("brand-assets").upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (erroUpload) return;
    const { data: assinada } = await supabase.storage.from("brand-assets").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (assinada?.signedUrl) {
      await supabase.from("design_projects").update({ thumbnail_url: assinada.signedUrl }).eq("id", projeto.id);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-areia">
            {projeto.title} <span className="text-areia/40">— versão {projeto.version}</span>
          </p>
          {ultimoSalvamento && <p className="text-xs text-areia/40">Salvo automaticamente às {ultimoSalvamento}</p>}
          {salvando && <p className="text-xs text-menta">Salvando...</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportarEsalvarThumbnail}
            className="rounded-lg border border-areia/15 px-3 py-1.5 text-xs hover:bg-areia/5"
          >
            Atualizar thumbnail
          </button>
          <button
            type="button"
            onClick={criarNovaVersao}
            disabled={criandoVersao}
            className="rounded-lg border border-ambar/30 px-3 py-1.5 text-xs text-ambar hover:bg-ambar/10 disabled:opacity-50"
          >
            {criandoVersao ? "Criando..." : "Criar versão"}
          </button>
        </div>
      </div>

      <DesignCanvasEditor
        width={projeto.width}
        height={projeto.height}
        canvasJsonInicial={projeto.canvasJson}
        onAutosave={salvar}
        maxDisplayWidth={720}
      />
    </div>
  );
}
