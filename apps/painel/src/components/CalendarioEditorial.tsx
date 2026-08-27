"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { salvarPrefillComando } from "@/lib/conversation";
import MiniMarkdown from "@/components/MiniMarkdown";

// Fase 5 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md) — calendário
// mensal operacional real, substituindo o grid de day-cards extraído de
// artifacts.metadata.calendario (JSON solto, sem tabela dedicada). Itens
// agora vêm de calendario_itens (migration 0038), consultável/filtrável de
// verdade via SQL. "Montar planejamento do mês" nunca chama uma API nova —
// reaproveita a MESMA jornada de chat->missão que qualquer outro pedido ao
// Vetor já usa (salvarPrefillComando + navegação pra /vetor).

interface ItemCalendario {
  id: string;
  titulo: string;
  data_publicacao: string;
  canal: string | null;
  formato: string | null;
  objetivo: string | null;
  editoria: string | null;
  persona: string | null;
  briefing: string | null;
  copy: string | null;
  asset_id: string | null;
  referencia_id: string | null;
  status: string;
  data_entrega: string | null;
  data_aprovacao: string | null;
  mission_id: string | null;
  agendado_para: string | null;
}

const STATUS_ORDEM = ["ideia", "briefing", "em_producao", "aguardando_aprovacao", "aprovado", "programado", "publicado", "arquivado"] as const;

const LABEL_STATUS: Record<string, string> = {
  ideia: "Ideia",
  briefing: "Briefing",
  em_producao: "Em produção",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  programado: "Programado",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

const COR_STATUS: Record<string, string> = {
  ideia: "text-areia/50 border-areia/15",
  briefing: "text-electric border-electric/30",
  em_producao: "text-electric border-electric/30",
  aguardando_aprovacao: "text-ambar border-ambar/30",
  aprovado: "text-menta border-menta/30",
  programado: "text-menta border-menta/30",
  publicado: "text-menta border-menta/40",
  arquivado: "text-areia/30 border-areia/10",
};

function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarioEditorial({ clienteId }: { clienteId: string }) {
  const [mesRef, setMesRef] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [view, setView] = useState<"mes" | "semana" | "lista">("mes");
  // Índice da semana (0-5) dentro da grade de 6 semanas do mês — só
  // relevante na view "semana"; reseta sempre que o mês muda.
  const [semanaIndice, setSemanaIndice] = useState(0);
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [itens, setItens] = useState<ItemCalendario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [itemAberto, setItemAberto] = useState<ItemCalendario | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  // Ajusta estado derivado durante a renderização (padrão oficial do React
  // pra "resetar estado quando uma prop/state muda", nunca um useEffect
  // pra isso — ver https://react.dev/learn/you-might-not-need-an-effect).
  const [mesRefAnterior, setMesRefAnterior] = useState(mesRef);
  if (mesRef !== mesRefAnterior) {
    setMesRefAnterior(mesRef);
    setSemanaIndice(0);
  }

  useEffect(() => {
    let cancelado = false;
    // Início de uma busca assíncrona disparada pela troca de mês — mesmo
    // padrão de "carregando" já usado no resto do app, só que este é o
    // primeiro componente a buscar dados a cada mudança de dependência via
    // useEffect (não só no mount); a regra set-state-in-effect do lint é
    // estrita até pra esse caso comum, suprimida aqui de propósito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    const inicio = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
    const fim = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0);
    supabase
      .from("calendario_itens")
      .select("*")
      .eq("cliente_id", clienteId)
      .gte("data_publicacao", chaveDia(inicio))
      .lte("data_publicacao", chaveDia(fim))
      .order("data_publicacao", { ascending: true })
      .then(({ data }) => {
        if (!cancelado) {
          setItens((data ?? []) as ItemCalendario[]);
          setCarregando(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [mesRef, clienteId, supabase]);

  const itensFiltrados = itens.filter(
    (i) => (filtroCanal === "todos" || i.canal === filtroCanal) && (filtroStatus === "todos" || i.status === filtroStatus),
  );

  const canaisDisponiveis = Array.from(new Set(itens.map((i) => i.canal).filter((c): c is string => !!c)));

  const itensPorDia = new Map<string, ItemCalendario[]>();
  for (const item of itensFiltrados) {
    const lista = itensPorDia.get(item.data_publicacao) ?? [];
    lista.push(item);
    itensPorDia.set(item.data_publicacao, lista);
  }

  // Grid de 6 semanas (42 células) começando no domingo da semana do dia 1
  // — inclui dias do mês anterior/seguinte pra completar a grade, sempre
  // mostrados apagados (nunca confundidos com dias do mês corrente).
  const primeiroDiaGrid = new Date(mesRef);
  primeiroDiaGrid.setDate(primeiroDiaGrid.getDate() - primeiroDiaGrid.getDay());
  const diasGrid = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(primeiroDiaGrid);
    d.setDate(d.getDate() + i);
    return d;
  });
  const diasParaSemana = diasGrid.slice(semanaIndice * 7, semanaIndice * 7 + 7);

  function montarPlanejamentoDoMes() {
    const nomeMes = mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    salvarPrefillComando(`Monte meu planejamento editorial de ${nomeMes}.`);
    router.push("/vetor");
  }

  async function atualizarItem(id: string, patch: Partial<ItemCalendario>) {
    const { error } = await supabase.from("calendario_itens").update(patch).eq("id", id).eq("cliente_id", clienteId);
    if (!error) {
      setItens((atual) => atual.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      setItemAberto((atual) => (atual && atual.id === id ? { ...atual, ...patch } : atual));
    }
  }

  function pedirAoVetor(item: ItemCalendario, acao: string) {
    const partes = [
      `${acao} para o item de calendário "${item.titulo}"`,
      item.canal ? `canal: ${item.canal}` : null,
      item.formato ? `formato: ${item.formato}` : null,
      item.objetivo ? `objetivo: ${item.objetivo}` : null,
      item.briefing ? `briefing: ${item.briefing}` : null,
    ].filter(Boolean);
    salvarPrefillComando(`${partes.join(". ")}.`);
    router.push("/vetor");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMesRef((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="rounded-lg border border-areia/15 px-2 py-1 text-areia/60 hover:text-areia"
            aria-label="Mês anterior"
          >
            ←
          </button>
          <p className="min-w-[140px] text-center text-sm font-semibold capitalize text-areia">
            {mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
          <button
            onClick={() => setMesRef((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="rounded-lg border border-areia/15 px-2 py-1 text-areia/60 hover:text-areia"
            aria-label="Próximo mês"
          >
            →
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-areia/15 p-0.5">
            {(["mes", "semana", "lista"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 text-[11px] capitalize transition ${view === v ? "bg-menta/15 text-menta" : "text-areia/50 hover:text-areia"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <select value={filtroCanal} onChange={(e) => setFiltroCanal(e.target.value)} className="rounded-lg border border-areia/15 bg-petroleo-2/60 px-2 py-1.5 text-xs text-areia">
            <option value="todos">Todos os canais</option>
            {canaisDisponiveis.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="rounded-lg border border-areia/15 bg-petroleo-2/60 px-2 py-1.5 text-xs text-areia">
            <option value="todos">Todos os status</option>
            {STATUS_ORDEM.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUS[s]}
              </option>
            ))}
          </select>
          <button onClick={montarPlanejamentoDoMes} className="btn-tactile rounded-full bg-ambar px-3.5 py-1.5 text-xs font-semibold text-petroleo hover:bg-ambar-forte">
            Montar planejamento do mês
          </button>
        </div>
      </div>

      {view === "semana" && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setSemanaIndice((s) => Math.max(0, s - 1))}
            disabled={semanaIndice === 0}
            className="rounded-lg border border-areia/15 px-2 py-1 text-[11px] text-areia/60 hover:text-areia disabled:opacity-30"
          >
            ← semana anterior
          </button>
          <button
            onClick={() => setSemanaIndice((s) => Math.min(5, s + 1))}
            disabled={semanaIndice === 5}
            className="rounded-lg border border-areia/15 px-2 py-1 text-[11px] text-areia/60 hover:text-areia disabled:opacity-30"
          >
            próxima semana →
          </button>
        </div>
      )}

      {carregando && <p className="mt-6 text-xs text-areia/40">Carregando...</p>}

      {!carregando && view !== "lista" && (
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
            <p key={d} className="text-center font-mono text-[10px] uppercase tracking-wide text-areia/30">
              {d}
            </p>
          ))}
          {(view === "mes" ? diasGrid : diasParaSemana).map((dia) => {
            const chave = chaveDia(dia);
            const doMes = dia.getMonth() === mesRef.getMonth();
            const itensDoDia = itensPorDia.get(chave) ?? [];
            return (
              <div
                key={chave}
                className={`min-h-[86px] rounded-lg border p-1.5 ${doMes ? "border-areia/10 bg-petroleo-2/40" : "border-areia/5 bg-transparent opacity-40"}`}
              >
                <p className="text-[11px] text-areia/40">{dia.getDate()}</p>
                <div className="mt-1 space-y-1">
                  {itensDoDia.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setItemAberto(item)}
                      className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] ${COR_STATUS[item.status] ?? ""}`}
                      title={item.titulo}
                    >
                      {item.titulo}
                    </button>
                  ))}
                  {itensDoDia.length > 3 && <p className="text-[9px] text-areia/30">+{itensDoDia.length - 3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!carregando && view === "lista" && (
        <div className="mt-4 space-y-2">
          {itensFiltrados.length === 0 && (
            <p className="rounded-2xl panel p-4 text-sm text-areia/40">Nenhum item neste mês ainda.</p>
          )}
          {itensFiltrados.map((item) => (
            <button
              key={item.id}
              onClick={() => setItemAberto(item)}
              className="flex w-full items-center justify-between gap-3 rounded-xl panel p-3 text-left transition hover:border-menta/30"
            >
              <div>
                <p className="text-sm text-areia">{item.titulo}</p>
                <p className="mt-0.5 text-[11px] text-areia/40">
                  {new Date(`${item.data_publicacao}T00:00:00`).toLocaleDateString("pt-BR")} {item.canal ? `· ${item.canal}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${COR_STATUS[item.status] ?? ""}`}>{LABEL_STATUS[item.status]}</span>
            </button>
          ))}
        </div>
      )}

      {itemAberto && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-petroleo/80 backdrop-blur-sm" onClick={() => setItemAberto(null)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-areia/10 bg-petroleo-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-areia">{itemAberto.titulo}</h3>
              <button onClick={() => setItemAberto(null)} className="text-areia/40 hover:text-areia" aria-label="Fechar">
                ✕
              </button>
            </div>
            <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${COR_STATUS[itemAberto.status] ?? ""}`}>{LABEL_STATUS[itemAberto.status]}</span>

            <div className="mt-4 space-y-2 text-xs text-areia/70">
              <p>
                <span className="text-areia/40">Data:</span> {new Date(`${itemAberto.data_publicacao}T00:00:00`).toLocaleDateString("pt-BR")}
              </p>
              {itemAberto.canal && (
                <p>
                  <span className="text-areia/40">Canal:</span> {itemAberto.canal}
                </p>
              )}
              {itemAberto.formato && (
                <p>
                  <span className="text-areia/40">Formato:</span> {itemAberto.formato}
                </p>
              )}
              {itemAberto.objetivo && (
                <p>
                  <span className="text-areia/40">Objetivo:</span> {itemAberto.objetivo}
                </p>
              )}
              {itemAberto.editoria && (
                <p>
                  <span className="text-areia/40">Editoria:</span> {itemAberto.editoria}
                </p>
              )}
              {itemAberto.persona && (
                <p>
                  <span className="text-areia/40">Persona:</span> {itemAberto.persona}
                </p>
              )}
              {itemAberto.briefing && (
                <p>
                  <span className="text-areia/40">Briefing:</span> {itemAberto.briefing}
                </p>
              )}
              {itemAberto.copy && (
                <div>
                  <span className="text-areia/40">Copy:</span>
                  <MiniMarkdown texto={itemAberto.copy} className="mt-1" />
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => pedirAoVetor(itemAberto, "Gerar a copy")} className="rounded-lg border border-menta/30 px-2.5 py-2 text-[11px] text-menta hover:bg-menta/10">
                Gerar copy
              </button>
              <button onClick={() => pedirAoVetor(itemAberto, "Criar a arte")} className="rounded-lg border border-menta/30 px-2.5 py-2 text-[11px] text-menta hover:bg-menta/10">
                Criar arte
              </button>
              <button onClick={() => pedirAoVetor(itemAberto, "Criar o vídeo")} className="rounded-lg border border-menta/30 px-2.5 py-2 text-[11px] text-menta hover:bg-menta/10">
                Criar vídeo
              </button>
              <Link
                href={`/referencias?item=${itemAberto.id}`}
                className="rounded-lg border border-areia/15 px-2.5 py-2 text-center text-[11px] text-areia/70 hover:text-areia"
              >
                Anexar referência
              </Link>
              <button
                onClick={() => atualizarItem(itemAberto.id, { status: "aguardando_aprovacao" })}
                className="rounded-lg border border-ambar/30 px-2.5 py-2 text-[11px] text-ambar hover:bg-ambar/10"
              >
                Enviar p/ aprovação
              </button>
              <button
                onClick={() => atualizarItem(itemAberto.id, { status: "programado", agendado_para: new Date().toISOString() })}
                className="rounded-lg border border-ambar/30 px-2.5 py-2 text-[11px] text-ambar hover:bg-ambar/10"
              >
                Programar
              </button>
              {itemAberto.mission_id && (
                <Link href={`/missoes/${itemAberto.mission_id}`} className="col-span-2 rounded-lg border border-areia/15 px-2.5 py-2 text-center text-[11px] text-areia/70 hover:text-areia">
                  Abrir missão →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
