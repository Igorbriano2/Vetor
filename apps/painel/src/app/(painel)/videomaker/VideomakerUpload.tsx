"use client";

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { readApiResponse } from "@/lib/api/readApiResponse";

// Upload de origem + pedido pro Vetor — reaproveita 100% o pipeline de
// missão já existente (chat -> propor_missao -> confirmar -> fila -> agente
// de vídeo -> gerar_video_higgsfield -> artifact real). Não é um sistema de
// job paralelo: é o mesmo comando de texto que o chat principal usa, só que
// com a URL do arquivo já anexada no pedido.
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
      const path = `${clienteId}/${crypto.randomUUID()}-${arquivo.name}`;
      const { error: erroUpload } = await supabase.storage.from("uploads").upload(path, arquivo, { upsert: false });
      if (erroUpload) throw new Error(erroUpload.message);

      const { data: signed, error: erroSigned } = await supabase.storage.from("uploads").createSignedUrl(path, 60 * 60);
      if (erroSigned || !signed) throw new Error(erroSigned?.message ?? "Falha ao gerar link do arquivo");

      const texto = `${instrucao.trim()}\n\nArquivo de origem enviado: ${signed.signedUrl}`;
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
