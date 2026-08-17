import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";

const STATUS_ABERTO = ["novo", "em_andamento", "aguardando_aprovacao"];

export default async function SolicitacoesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: demandas } = await supabase
    .from("demandas")
    .select("id, tipo_demanda, descricao, status, urgencia, mission_id, created_at")
    .order("created_at", { ascending: false });

  const abertas = (demandas ?? []).filter((d) => STATUS_ABERTO.includes(d.status) && !d.mission_id);
  const convertidas = (demandas ?? []).filter((d) => !!d.mission_id);
  const arquivadas = (demandas ?? []).filter((d) => !STATUS_ABERTO.includes(d.status) && !d.mission_id);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Solicitações</h1>
        <p className="mt-2 text-sm text-areia/60">
          Tudo que chegou por texto, áudio ou WhatsApp — o que ainda está sendo entendido, o que já virou
          missão e o histórico do que foi arquivado.
        </p>

        <Secao titulo="Aguardando entendimento" itens={abertas} />
        <Secao titulo="Convertidas em missão" itens={convertidas} mostrarLinkMissao />
        <Secao titulo="Arquivadas" itens={arquivadas} />
      </div>
    </div>
  );
}

interface DemandaLinha {
  id: string;
  tipo_demanda: string;
  descricao: string;
  status: string;
  urgencia: string;
  mission_id: string | null;
  created_at: string;
}

function Secao({
  titulo,
  itens,
  mostrarLinkMissao = false,
}: {
  titulo: string;
  itens: DemandaLinha[];
  mostrarLinkMissao?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
        {titulo} <span className="text-areia/25">({itens.length})</span>
      </h2>
      <div className="mt-3 space-y-3">
        {itens.length ? (
          itens.map((d) => (
            <div key={d.id} className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-areia">{d.tipo_demanda}</p>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-1 text-sm text-areia/60">{d.descricao}</p>
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-areia/30">
                <span>{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                {mostrarLinkMissao && d.mission_id && (
                  <Link href={`/missoes/${d.mission_id}`} className="text-menta hover:underline">
                    ver missão
                  </Link>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
            Nada por aqui.
          </p>
        )}
      </div>
    </section>
  );
}
