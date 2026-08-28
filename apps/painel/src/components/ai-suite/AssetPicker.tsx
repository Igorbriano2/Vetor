"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AtivoRef {
  id: string;
  nome: string;
  url: string;
}

// Referências pro modo "estúdio direto" reaproveitam o Drive real
// (business_assets — mesma fonte usada em Design/Vídeo), nunca um segundo
// upload/bucket só pra esta suíte. Até 8 selecionadas, mesmo limite do
// prompt-mestre.
const LIMITE_REFERENCIAS = 8;

export default function AssetPicker({
  clienteId,
  selecionados,
  onChange,
  aceitaMime = "image/%",
}: {
  clienteId: string;
  selecionados: string[];
  onChange: (ids: string[]) => void;
  aceitaMime?: string;
}) {
  const [ativos, setAtivos] = useState<AtivoRef[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("business_assets")
        .select("id, nome, storage_path")
        .eq("cliente_id", clienteId)
        .eq("status", "aprovado")
        .like("mime_type", aceitaMime)
        .order("created_at", { ascending: false })
        .limit(24);
      if (!data || cancelado) return;
      const comUrl = await Promise.all(
        data.map(async (a) => {
          const { data: assinada } = await supabase.storage.from("brand-assets").createSignedUrl(a.storage_path as string, 60 * 60);
          return { id: a.id as string, nome: a.nome as string, url: assinada?.signedUrl ?? "" };
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
  }, [clienteId, aceitaMime]);

  function alternar(id: string) {
    if (selecionados.includes(id)) {
      onChange(selecionados.filter((s) => s !== id));
    } else if (selecionados.length < LIMITE_REFERENCIAS) {
      onChange([...selecionados, id]);
    }
  }

  if (carregando) return <p className="text-xs text-areia/40">Carregando ativos do Drive...</p>;
  if (ativos.length === 0) return <p className="text-xs text-areia/40">Nenhum ativo aprovado no Drive ainda.</p>;

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {ativos.map((a) => {
          const marcado = selecionados.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => alternar(a.id)}
              title={a.nome}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                marcado ? "border-menta" : "border-transparent hover:border-areia/25"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.nome} className="h-full w-full object-cover" />
              {marcado && <span className="absolute inset-0 bg-menta/20" />}
            </button>
          );
        })}
      </div>
      {selecionados.length >= LIMITE_REFERENCIAS && <p className="mt-1.5 text-[10px] text-areia/40">Máximo de {LIMITE_REFERENCIAS} referências.</p>}
    </div>
  );
}
