import { createSupabaseServerClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import StatusBadge from "@/components/StatusBadge";
import VetorCore, { type EstadoCore } from "@/components/VetorCore";

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

  const statusPendentes = ["aguardando_aprovacao", "pendente_aprovacao"];
  const statusAtivos = ["novo", "em_andamento"];
  const statusConcluidos = ["concluida", "aprovada", "publicada"];

  const todos = [...(demandas ?? []), ...(entregas ?? [])];
  const pendentes = todos.filter((item) => statusPendentes.includes(item.status)).length;
  const ativos = todos.filter((item) => statusAtivos.includes(item.status)).length;
  const concluidos = todos.filter((item) => statusConcluidos.includes(item.status)).length;

  const estadoCore: EstadoCore =
    pendentes > 0 ? "aguardando_aprovacao" : ativos > 0 ? "executando" : "idle";

  return (
    <main className="min-h-screen bg-petroleo px-6 py-10 text-areia">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">
              {nomeEmpresa ?? "Vetor"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-areia">Olá, {usuario?.nome ?? "tudo bem"}</h1>
            <div className="mt-3">
              <VetorCore estado={estadoCore} />
            </div>
          </div>
          <LogoutButton />
        </div>

        {!usuario && (
          <p className="mt-6 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/60">
            Seu usuário ainda não está vinculado a um cliente Vetor. Fale com o time de suporte
            para concluir o cadastro.
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SinalCard label="Aguardando você" valor={pendentes} destaque="ambar" />
          <SinalCard label="Em andamento" valor={ativos} destaque="menta" />
          <SinalCard label="Concluídas" valor={concluidos} destaque="menta" />
        </div>

        <section className="mt-10">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Demandas
          </h2>
          <div className="mt-3 space-y-3 border-l border-areia/10 pl-5">
            {demandas?.length ? (
              demandas.map((d) => (
                <div
                  key={d.id}
                  className="relative rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur"
                >
                  <span className="absolute top-5 -left-[25px] size-2 rounded-full bg-menta shadow-[0_0_8px_theme(colors.menta)]" />
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-areia">{d.tipo_demanda}</p>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-1 text-sm text-areia/60">{d.descricao}</p>
                  <p className="mt-2 font-mono text-[11px] text-areia/30">
                    {new Date(d.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhuma demanda registrada ainda.
              </p>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Histórico de entregas
          </h2>
          <div className="mt-3 space-y-3">
            {entregas?.length ? (
              entregas.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur"
                >
                  <p className="font-medium text-areia">{e.tipo}</p>
                  <StatusBadge status={e.status} />
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhuma entrega ainda.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SinalCard({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: number;
  destaque: "ambar" | "menta";
}) {
  const cor = destaque === "ambar" ? "text-ambar" : "text-menta";
  return (
    <div className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
      <p className="font-mono text-xs uppercase tracking-wide text-areia/40">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}
