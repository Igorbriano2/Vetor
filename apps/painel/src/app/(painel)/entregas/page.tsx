import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buscarArtefatos, buscarVideosFinalizados } from "@/lib/artifacts/fetchArtifacts";
import { agruparPorCampanha } from "@/lib/artifacts/agruparPorCampanha";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import StatusBadge from "@/components/StatusBadge";
import EntregasPainel from "./EntregasPainel";

// Fase 6 do reset de produto (docs/PRODUCT-RESET-AUDIT.md) — Entregas
// reorganizado por campanha (missão), não mais um grid único de artefatos
// soltos. `entregas` (canal WhatsApp legado) continua existindo como seção
// à parte — não tem mission_id, não é uma "campanha" no sentido novo.
export default async function EntregasPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  const [{ data: entregas }, artefatos, videosFinalizados] = await Promise.all([
    supabase.from("entregas").select("id, tipo, status, arquivo_url, created_at").order("created_at", { ascending: false }),
    buscarArtefatos(supabase, { clienteId: ativo.clienteId ?? undefined }),
    buscarVideosFinalizados(supabase),
  ]);
  const todosArtefatos = [...artefatos, ...videosFinalizados];

  const missionIds = Array.from(new Set(todosArtefatos.map((a) => a.missionId).filter((id): id is string => !!id)));
  const { data: missoesBrutas } = missionIds.length
    ? await supabase.from("missions").select("id, objetivo, status, created_at").in("id", missionIds)
    : { data: [] };

  const campanhas = agruparPorCampanha(
    todosArtefatos,
    (missoesBrutas ?? []).map((m) => ({
      id: m.id as string,
      objetivo: m.objetivo as string | null,
      status: m.status as string | null,
      createdAt: m.created_at as string,
    })),
  );

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Entregas</h1>
        <p className="mt-2 text-sm text-areia/60">
          Tudo que já foi entregue, organizado por campanha — Design, Vídeo, Planejamento e Resultados num só lugar.
        </p>

        <EntregasPainel campanhas={campanhas} />

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
