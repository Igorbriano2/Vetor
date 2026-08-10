import { createSupabaseServerClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import StatusBadge from "@/components/StatusBadge";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome, cliente_id, clientes(nome_empresa)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { data: demandas } = await supabase
    .from("demandas")
    .select("id, tipo_demanda, descricao, status, urgencia, created_at")
    .order("created_at", { ascending: false });

  const { data: entregas } = await supabase
    .from("entregas")
    .select("id, tipo, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const nomeEmpresa = (usuario?.clientes as unknown as { nome_empresa?: string } | null)
    ?.nome_empresa;

  return (
    <main className="min-h-screen bg-areia px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-petroleo">
              Olá, {usuario?.nome ?? "tudo bem"}
            </h1>
            {nomeEmpresa && <p className="text-sm text-petroleo/60">{nomeEmpresa}</p>}
          </div>
          <LogoutButton />
        </div>

        {!usuario && (
          <p className="mt-6 rounded-xl bg-white p-4 text-sm text-petroleo/70">
            Seu usuário ainda não está vinculado a um cliente Vetor. Fale com o time de suporte
            para concluir o cadastro.
          </p>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-petroleo/50">
            Demandas
          </h2>
          <div className="mt-3 space-y-3">
            {demandas?.length ? (
              demandas.map((d) => (
                <div key={d.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-petroleo">{d.tipo_demanda}</p>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-1 text-sm text-petroleo/70">{d.descricao}</p>
                  <p className="mt-2 text-xs text-petroleo/40">
                    {new Date(d.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-white p-4 text-sm text-petroleo/50">
                Nenhuma demanda registrada ainda.
              </p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-petroleo/50">
            Histórico de entregas
          </h2>
          <div className="mt-3 space-y-3">
            {entregas?.length ? (
              entregas.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
                >
                  <p className="font-medium text-petroleo">{e.tipo}</p>
                  <StatusBadge status={e.status} />
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-white p-4 text-sm text-petroleo/50">
                Nenhuma entrega ainda.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
