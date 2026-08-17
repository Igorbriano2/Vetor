import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";

export default async function EntregasPage() {
  const supabase = await createSupabaseServerClient();

  const { data: entregas } = await supabase
    .from("entregas")
    .select("id, tipo, status, arquivo_url, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Entregas</h1>
        <p className="mt-2 text-sm text-areia/60">Biblioteca de tudo que já foi entregue pra você.</p>

        <div className="mt-8 space-y-3">
          {entregas?.length ? (
            entregas.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur"
              >
                <div>
                  <p className="font-medium text-areia">{e.tipo}</p>
                  <p className="mt-1 font-mono text-[11px] text-areia/30">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </p>
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
            ))
          ) : (
            <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
              Nenhuma entrega ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
