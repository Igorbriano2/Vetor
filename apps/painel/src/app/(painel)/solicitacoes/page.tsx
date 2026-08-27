import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";

const DEMANDA_STATUS_ABERTO = ["novo", "em_andamento", "aguardando_aprovacao"];

// Fase 3 — solicitações multimodais (painel texto/áudio) somam ao canal legado
// de demandas (WhatsApp) nesta mesma tela, sem trocar o layout: cada linha só
// aprende a nascer de duas tabelas diferentes.
const SOLICITACAO_STATUS_ABERTO = [
  "received",
  "transcribing",
  "understanding",
  "awaiting_context",
  "planned",
  "confirmed",
];
interface LinhaUnificada {
  id: string;
  titulo: string;
  descricao: string;
  status: string;
  origem: string;
  missionId: string | null;
  createdAt: string;
}

export default async function SolicitacoesPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: demandas }, { data: solicitacoes }] = await Promise.all([
    supabase
      .from("demandas")
      .select("id, tipo_demanda, descricao, status, mission_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("solicitacoes")
      .select("id, origem, texto, transcricao, status, mission_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const linhasDemandas: LinhaUnificada[] = (demandas ?? []).map((d) => ({
    id: d.id,
    titulo: d.tipo_demanda,
    descricao: d.descricao,
    status: d.status,
    origem: "whatsapp",
    missionId: d.mission_id,
    createdAt: d.created_at,
  }));

  const linhasSolicitacoes: LinhaUnificada[] = (solicitacoes ?? []).map((s) => ({
    id: s.id,
    titulo: LABEL_ORIGEM[s.origem] ?? "Conversa com o Vetor",
    descricao: s.texto || s.transcricao || "Ainda sem conteúdo — aguardando o cliente enviar a mensagem.",
    status: s.status,
    origem: s.origem,
    missionId: s.mission_id,
    createdAt: s.created_at,
  }));

  const todas = [...linhasDemandas, ...linhasSolicitacoes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const abertas = todas.filter(
    (l) => !l.missionId && (DEMANDA_STATUS_ABERTO.includes(l.status) || SOLICITACAO_STATUS_ABERTO.includes(l.status)),
  );
  const convertidas = todas.filter((l) => !!l.missionId);
  const arquivadas = todas.filter(
    (l) =>
      !l.missionId &&
      !DEMANDA_STATUS_ABERTO.includes(l.status) &&
      !SOLICITACAO_STATUS_ABERTO.includes(l.status),
  );

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

const LABEL_ORIGEM: Record<string, string> = {
  painel_texto: "Conversa com o Vetor (texto)",
  painel_audio: "Conversa com o Vetor (áudio)",
  whatsapp: "WhatsApp",
  evento: "Evento automático",
};

function Secao({
  titulo,
  itens,
  mostrarLinkMissao = false,
}: {
  titulo: string;
  itens: LinhaUnificada[];
  mostrarLinkMissao?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
        {titulo} <span className="text-areia/25">({itens.length})</span>
      </h2>
      <div className="mt-3 space-y-3">
        {itens.length ? (
          itens.map((l) => (
            <div key={l.id} className="rounded-2xl panel p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-areia">{l.titulo}</p>
                <StatusBadge status={l.status} />
              </div>
              <p className="mt-1 text-sm text-areia/60">{l.descricao}</p>
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-areia/30">
                <span>{new Date(l.createdAt).toLocaleString("pt-BR")}</span>
                {mostrarLinkMissao && l.missionId && (
                  <Link href={`/missoes/${l.missionId}`} className="text-menta hover:underline">
                    ver missão
                  </Link>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl panel p-4 text-sm text-areia/40">
            Nada por aqui.
          </p>
        )}
      </div>
    </section>
  );
}
