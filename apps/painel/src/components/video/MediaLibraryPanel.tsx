"use client";

// Biblioteca de mídia do editor de vídeo — lista os ativos aprovados do
// Drive (mesma tabela que o Design já usa) filtrados pra imagem/vídeo, e
// deixa o cliente acrescentar um como clip na faixa selecionada. Duração
// inicial é um padrão editável depois (ver nota em VideoProjectEditor) —
// analisar a duração real do arquivo é trabalho do pipeline do agente
// (Parte 4, ainda não conectado nesta rodada).

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface AtivoDeMidia {
  id: string;
  nome: string;
  mimeType: string | null;
  url: string;
}

const DURACAO_PADRAO_IMAGEM_MS = 4000;
const DURACAO_PADRAO_VIDEO_MS = 6000;

export function duracaoPadraoPorMime(mimeType: string | null): number {
  return mimeType?.startsWith("video/") ? DURACAO_PADRAO_VIDEO_MS : DURACAO_PADRAO_IMAGEM_MS;
}

export default function MediaLibraryPanel({
  clienteId,
  faixaSelecionadaId,
  onAdicionar,
}: {
  clienteId: string;
  faixaSelecionadaId: string | null;
  onAdicionar: (ativo: AtivoDeMidia) => void;
}) {
  const [ativos, setAtivos] = useState<AtivoDeMidia[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("business_assets")
        .select("id, nome, storage_path, mime_type")
        .eq("cliente_id", clienteId)
        .eq("status", "aprovado")
        .or("mime_type.like.video/%,mime_type.like.image/%")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!data || cancelado) return;

      const comUrl = await Promise.all(
        data.map(async (a) => {
          const { data: assinada } = await supabase.storage
            .from("brand-assets")
            .createSignedUrl(a.storage_path as string, 60 * 60);
          return { id: a.id as string, nome: a.nome as string, mimeType: a.mime_type as string | null, url: assinada?.signedUrl ?? "" };
        }),
      );
      if (!cancelado) {
        setAtivos(comUrl.filter((a) => a.url));
        setCarregando(false);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  return (
    <div className="rounded-xl border border-areia/10 bg-petroleo-2/40 p-3">
      <p className="mono-label text-areia/50">Biblioteca de mídia</p>
      {!faixaSelecionadaId && <p className="mt-2 text-xs text-ambar">Selecione uma faixa pra adicionar um ativo nela.</p>}
      {carregando && <p className="mt-2 text-xs text-areia/40">Carregando...</p>}
      {!carregando && ativos.length === 0 && (
        <p className="mt-2 text-xs text-areia/40">Nenhum ativo aprovado ainda — cadastre no Drive (Negócio).</p>
      )}
      <div className="mt-2 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
        {ativos.map((ativo) => (
          <button
            key={ativo.id}
            type="button"
            disabled={!faixaSelecionadaId}
            onClick={() => onAdicionar(ativo)}
            title={ativo.nome}
            className="group relative aspect-square overflow-hidden rounded-lg border border-areia/10 disabled:opacity-40"
          >
            {ativo.mimeType?.startsWith("video/") ? (
              <video src={ativo.url} className="h-full w-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ativo.url} alt={ativo.nome} className="h-full w-full object-cover" />
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-petroleo/80 px-1 py-0.5 text-[10px] text-areia/80">
              {ativo.nome}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
