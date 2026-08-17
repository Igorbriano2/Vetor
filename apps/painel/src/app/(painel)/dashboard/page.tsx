import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import VetorCore, { type EstadoCore } from "@/components/VetorCore";
import VetorCommandBar from "@/components/VetorCommandBar";

const STATUS_MISSAO_TERMINAL = ["completed", "failed", "cancelled", "archived"];

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

  const { data: missoes } = await supabase
    .from("missions")
    .select("id, titulo, objetivo, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: aprovacoesPendentes } = await supabase
    .from("approvals")
    .select("id, mission_id, acao, risco, status")
    .eq("status", "pending");

  const nomeEmpresa = (usuario?.clientes as unknown as { nome_empresa?: string } | null)
    ?.nome_empresa;

  const statusPendentes = ["aguardando_aprovacao", "pendente_aprovacao"];
  const statusAtivos = ["novo", "em_andamento"];
  const statusConcluidos = ["concluida", "aprovada", "publicada"];

  const todos = [...(demandas ?? []), ...(entregas ?? [])];
  const pendentes = todos.filter((item) => statusPendentes.includes(item.status)).length;
  const ativos = todos.filter((item) => statusAtivos.includes(item.status)).length;
  const concluidos = todos.filter((item) => statusConcluidos.includes(item.status)).length;

  const missoesAtivas = (missoes ?? []).filter((m) => !STATUS_MISSAO_TERMINAL.includes(m.status));
  const missaoAtual =
    missoesAtivas.find((m) => m.status === "running") ??
    missoesAtivas.find((m) => m.status === "awaiting_approval") ??
    missoesAtivas[0];

  const temAprovacaoPendente = (aprovacoesPendentes?.length ?? 0) > 0 || pendentes > 0;

  const estadoCore: EstadoCore = temAprovacaoPendente
    ? "approval"
    : missoesAtivas.some((m) => m.status === "running") || ativos > 0
      ? "executing"
      : missoesAtivas.length > 0
        ? "planning"
        : "idle";

  const mensagemContexto = temAprovacaoPendente
    ? "Existe algo esperando sua decisão."
    : missaoAtual
      ? `Trabalhando em: ${missaoAtual.titulo}`
      : "Nenhuma missão em andamento — me conte o que você quer alcançar.";

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">{nomeEmpresa ?? "Vetor"}</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Olá, {usuario?.nome ?? "tudo bem"}</h1>

        {!usuario && (
          <p className="mt-6 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/60">
            Seu usuário ainda não está vinculado a um cliente Vetor. Fale com o time de suporte
            para concluir o cadastro.
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          {/* Centro: núcleo, comando, missão atual */}
          <div>
            <div className="panel rounded-3xl p-8 text-center">
              <VetorCore estado={estadoCore} className="mx-auto w-48" />
              <p className="mt-4 text-sm text-areia/70">{mensagemContexto}</p>
            </div>

            {missaoAtual && (
              <Link
                href={`/missoes/${missaoAtual.id}`}
                className="panel mt-4 block rounded-2xl p-4 transition hover:border-menta/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="mono-label">Missão atual</p>
                  <StatusBadge status={missaoAtual.status} />
                </div>
                <p className="mt-1 font-medium text-areia">{missaoAtual.titulo}</p>
                <p className="mt-1 text-sm text-areia/60">{missaoAtual.objetivo}</p>
              </Link>
            )}

            <div className="mt-6">
              <VetorCommandBar />
            </div>
          </div>

          {/* Lateral direita: aprovações, sinais, integrações */}
          <div className="space-y-4">
            <div className="panel rounded-2xl p-4">
              <p className="mono-label">Aprovações pendentes</p>
              {aprovacoesPendentes?.length ? (
                <ul className="mt-3 space-y-2">
                  {aprovacoesPendentes.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/missoes/${a.mission_id}`}
                        className="block rounded-xl border border-ambar/30 bg-ambar/5 p-3 text-sm text-areia transition hover:border-ambar/60"
                      >
                        {a.acao}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-areia/40">Nada esperando sua decisão agora.</p>
              )}
            </div>

            <div className="panel grid grid-cols-3 gap-2 rounded-2xl p-4">
              <SinalCard label="Aguardando você" valor={pendentes} destaque="ambar" />
              <SinalCard label="Em andamento" valor={ativos} destaque="menta" />
              <SinalCard label="Concluídas" valor={concluidos} destaque="menta" />
            </div>

            <div className="panel rounded-2xl p-4">
              <p className="mono-label">Integrações</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-areia/70">WhatsApp</span>
                  <span className="text-menta">conectado</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-areia/70">Meta Ads</span>
                  <span className="text-areia/40">não conectado</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-areia/70">Google Ads</span>
                  <span className="text-areia/40">não conectado</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Faixa inferior: missões ativas, demandas, entregas */}
        {missoesAtivas.length > 0 && (
          <section className="mt-10">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
              Missões em andamento
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {missoesAtivas.map((m) => (
                <Link
                  key={m.id}
                  href={`/missoes/${m.id}`}
                  className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur transition hover:border-menta/40"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-areia">{m.titulo}</p>
                    <StatusBadge status={m.status} />
                  </div>
                  <p className="mt-1 text-sm text-areia/60">{m.objetivo}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

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
    </div>
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
    <div className="rounded-xl border border-areia/10 bg-petroleo/50 p-3 text-center">
      <p className="mono-label">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}
