import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import EntregasPainel from "./EntregasPainel";

export default async function EntregasPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: entregas }, artefatos] = await Promise.all([
    supabase.from("entregas").select("id, tipo, status, arquivo_url, created_at").order("created_at", { ascending: false }),
    buscarArtefatos(supabase),
  ]);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Entregas</h1>
        <p className="mt-2 text-sm text-areia/60">
          Espelho de tudo que já foi entregue — Design, Vídeo, Planejamento, Campanhas e Resultados num só lugar.
        </p>

        <EntregasPainel artefatos={artefatos} />

        {entregas && entregas.length > 0 && (
          <section className="mt-10">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
              Entregas do canal WhatsApp (legado)
            </h2>
            <div className="mt-3 space-y-3">
              {entregas.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur"
                >
                  <div>
                    <p className="font-medium text-areia">{e.tipo}</p>
                    <p className="mt-1 font-mono text-[11px] text-areia/30">{new Date(e.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {e.arquivo_url && (
                      <a
                        href={e.arquivo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs uppercase tracking-wide text-menta hover:underline"
                      >
                        abrir
                      </a>
                    )}
                    <StatusBadge status={e.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
