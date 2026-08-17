import { createSupabaseServerClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";

const LABEL_FORMATO: Record<string, string> = {
  feed: "Feed",
  story: "Story",
  reel: "Reel",
  carrossel: "Carrossel",
};

export default async function ConteudoPage() {
  const supabase = await createSupabaseServerClient();

  const { data: itens } = await supabase
    .from("conteudo_social")
    .select("id, titulo, legenda, formato, status, agendado_para, publicado_em, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Conteúdo</h1>
        <p className="mt-2 text-sm text-areia/60">
          Produção e calendário de conteúdo social — o que está em rascunho, aprovado, agendado ou já
          publicado.
        </p>

        <div className="mt-8 space-y-3">
          {itens?.length ? (
            itens.map((item) => (
              <div key={item.id} className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium text-areia">{item.titulo ?? "Sem título"}</p>
                  <StatusBadge status={item.status} />
                </div>
                {item.legenda && <p className="mt-1 text-sm text-areia/60">{item.legenda}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-areia/30">
                  {item.formato && <span>{LABEL_FORMATO[item.formato] ?? item.formato}</span>}
                  {item.agendado_para && (
                    <span>Agendado para {new Date(item.agendado_para).toLocaleString("pt-BR")}</span>
                  )}
                  {item.publicado_em && (
                    <span>Publicado em {new Date(item.publicado_em).toLocaleString("pt-BR")}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
              Nenhum conteúdo em produção ainda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
