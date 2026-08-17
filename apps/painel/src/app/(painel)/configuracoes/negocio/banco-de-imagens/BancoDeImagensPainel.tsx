"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Asset {
  id: string;
  nome: string;
  pasta: string;
  tags: string[];
  createdAt: string;
  url: string | null;
}

export default function BancoDeImagensPainel({ clienteId, assetsIniciais }: { clienteId: string; assetsIniciais: Asset[] }) {
  const [assets, setAssets] = useState(assetsIniciais);
  const [busca, setBusca] = useState("");
  const [pastaFiltro, setPastaFiltro] = useState("todas");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const pastas = useMemo(() => ["todas", ...Array.from(new Set(assets.map((a) => a.pasta)))], [assets]);

  const filtrados = useMemo(() => {
    return assets.filter((a) => {
      if (pastaFiltro !== "todas" && a.pasta !== pastaFiltro) return false;
      if (!busca.trim()) return true;
      const termo = busca.toLowerCase();
      return a.nome.toLowerCase().includes(termo) || a.tags.some((t) => t.toLowerCase().includes(termo));
    });
  }, [assets, busca, pastaFiltro]);

  async function enviarArquivo(file: File, pasta: string, tagsTexto: string) {
    setEnviando(true);
    setErro(null);
    try {
      const path = `${clienteId}/banco/${crypto.randomUUID()}-${file.name}`;
      const { error: erroUpload } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false });
      if (erroUpload) throw new Error(erroUpload.message);

      const tags = tagsTexto
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { data, error: erroInsert } = await supabase
        .from("business_assets")
        .insert({ cliente_id: clienteId, storage_path: path, nome: file.name, pasta: pasta || "geral", tags, mime_type: file.type })
        .select("id, storage_path, nome, pasta, tags, created_at")
        .single();
      if (erroInsert || !data) throw new Error(erroInsert?.message ?? "Falha ao salvar");

      const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(path, 60 * 60);
      setAssets((atual) => [
        {
          id: data.id as string,
          nome: data.nome as string,
          pasta: data.pasta as string,
          tags: (data.tags as string[]) ?? [],
          createdAt: data.created_at as string,
          url: signed?.signedUrl ?? null,
        },
        ...atual,
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui enviar o arquivo agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(id: string) {
    const { error } = await supabase.from("business_assets").delete().eq("id", id);
    if (!error) setAssets((atual) => atual.filter((a) => a.id !== id));
  }

  return (
    <div className="mt-8">
      <UploadForm enviando={enviando} onEnviar={enviarArquivo} />
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou tag..."
          className="flex-1 rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-2 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
        />
        <select
          value={pastaFiltro}
          onChange={(e) => setPastaFiltro(e.target.value)}
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-sm text-areia"
        >
          {pastas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtrados.length === 0 && (
          <p className="col-span-full rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
            Nenhuma imagem ainda — envie a primeira acima.
          </p>
        )}
        {filtrados.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-2xl border border-areia/10 bg-petroleo-2/60">
            {a.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.nome} className="h-32 w-full object-cover" />
            )}
            <div className="p-3">
              <p className="truncate text-xs font-medium text-areia">{a.nome}</p>
              <p className="mt-1 truncate text-[10px] text-areia/40">{a.pasta}</p>
              {a.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span key={t} className="rounded-full bg-menta/10 px-1.5 py-0.5 text-[9px] text-menta">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => apagar(a.id)} className="mt-2 text-[10px] text-coral/70 hover:text-coral">
                remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadForm({ enviando, onEnviar }: { enviando: boolean; onEnviar: (file: File, pasta: string, tags: string) => void }) {
  const [pasta, setPasta] = useState("");
  const [tags, setTags] = useState("");

  return (
    <div className="rounded-2xl border border-dashed border-areia/20 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={pasta}
          onChange={(e) => setPasta(e.target.value)}
          placeholder="Pasta (ex: cardápio, eventos)"
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-xs text-areia placeholder:text-areia/30"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags separadas por vírgula"
          className="rounded-xl border border-areia/15 bg-petroleo-2/60 px-3 py-2 text-xs text-areia placeholder:text-areia/30"
        />
        <label className="cursor-pointer rounded-full bg-ambar px-4 py-2 text-xs font-semibold text-petroleo transition hover:bg-ambar-forte">
          {enviando ? "Enviando..." : "Enviar imagem"}
          <input
            type="file"
            accept="image/*"
            disabled={enviando}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onEnviar(file, pasta, tags);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
