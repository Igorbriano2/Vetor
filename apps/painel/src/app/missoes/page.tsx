import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";

export default async function MissoesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: missoes } = await supabase
    .from("missions")
    .select("id, titulo, objetivo, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-petroleo px-6 py-10 text-areia">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
            <h1 className="mt-1 text-2xl font-bold text-areia">Missões</h1>
          </div>
          <Link href="/dashboard" className="font-mono text-xs uppercase tracking-wide text-areia/50 hover:text-menta">
            Voltar
          </Link>
        </div>

        <div className="mt-8 space-y-3">
          {missoes?.length ? (
            missoes.map((m) => (
              <Link
                key={m.id}
                href={`/missoes/${m.id}`}
                className="block rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur transition hover:border-menta/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-areia">{m.titulo}</p>
                  <StatusBadge status={m.status} />
                </div>
                <p className="mt-1 text-sm text-areia/60">{m.objetivo}</p>
                <p className="mt-2 font-mono text-[11px] text-areia/30">
                  {new Date(m.created_at).toLocaleString("pt-BR")}
                </p>
              </Link>
            ))
          ) : (
            <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
              Nenhuma missão ainda. Peça algo pro Vetor no chat do dashboard pra começar.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
