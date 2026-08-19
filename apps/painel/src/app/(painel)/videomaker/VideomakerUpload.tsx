"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { readApiResponse } from "@/lib/api/readApiResponse";

// Upload de origem + pedido pro Vetor — reaproveita 100% o pipeline de
// missão já existente (chat -> propor_missao -> confirmar -> fila -> agente
// de vídeo). Não é um sistema de job paralelo: é o mesmo comando de texto
// que o chat principal usa.
//
// Sobe pro bucket "brand-assets" (não mais um bucket "uploads" solto) e
// cria um business_assets de verdade — vira um ativo do Drive, com id
// estável (o agente referencia esse id, nunca uma URL assinada que
// expira em 1h antes do worker processar a missão) e reaproveitável em
// futuras edições, igual qualquer outro ativo do banco.
export default function VideomakerUpload({ clienteId }: { clienteId: string }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [instrucao, setInstrucao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function enviar() {
    if (!arquivo || !instrucao.trim()) return;
    setEnviando(true);
    setErro(null);
    setMensagem(null);

    try {
      const path = `${clienteId}/videomaker/${crypto.randomUUID()}-${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage.from("brand-assets").upload(path, arquivo, { upsert: false });
      if (erroUpload) throw new Error(erroUpload.message);

      const { data: asset, error: erroInsert } = await supabase
        .from("business_assets")
        .insert({
          cliente_id: clienteId,
          storage_path: path,
          nome: arquivo.name,
          pasta: "videomaker",
          categoria: "campanhas_referencias",
          mime_type: arquivo.type,
          size_bytes: arquivo.size,
        })
        .select("id")
        .single();
      if (erroInsert || !asset) throw new Error(erroInsert?.message ?? "Falha ao registrar o arquivo enviado");

      const texto = `${instrucao.trim()}\n\nArquivo de origem enviado, id do ativo: ${asset.id as string}`;
      const res = await fetch("/api/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, responder_em_voz: false }),
      });
      await readApiResponse(res);

      setMensagem("Enviado pro Vetor — acompanhe em Missões ou aqui quando o vídeo estiver pronto.");
      setArquivo(null);
      setInstrucao("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui enviar agora.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-areia/20 p-5">
      <p className="text-sm text-areia/60">
        Envie uma imagem/vídeo de origem e descreva o que quer — o Vetor cria a missão, executa de verdade e o
        resultado aparece na biblioteca abaixo.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="cursor-pointer rounded-full border border-areia/15 px-4 py-2 text-xs text-areia/70 transition hover:border-menta hover:text-menta">
          {arquivo ? arquivo.name : "Escolher arquivo"}
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          value={instrucao}
          onChange={(e) => setInstrucao(e.target.value)}
          placeholder='Ex: "corte em um Reel de 20 segundos, comece pelo momento mais forte, legendas..."'
          className="flex-1 rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-2 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
        />
        <button
          onClick={enviar}
          disabled={enviando || !arquivo || !instrucao.trim()}
          className="rounded-full bg-ambar px-5 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Pedir ao Vetor"}
        </button>
      </div>
      {mensagem && <p className="mt-2 text-xs text-menta">{mensagem}</p>}
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
    </div>
  );
}
