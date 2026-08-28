import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import NovoProjetoCanvasBotao from "./NovoProjetoCanvasBotao";
import Link from "next/link";

// Fase 3 do VETOR Manager V2 — hub de projetos do Creative Canvas. Movido
// de /criacoes/canvas pra /design/canvas (2ª rodada de reorganização de
// menus, ver comentário em /criacoes/page.tsx): o canvas é uma FORMA de
// criar dentro do departamento de Design, não um item solto dentro do hub
// de Criações. Continua opcional — o wizard de /design continua sendo o
// caminho padrão pra quem não quer saber de nodes.
export default async function CreativeCanvasHubPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }

  const { data: projetos } = await supabase
    .from("creative_canvas_projects")
    .select("id, title, status, updated_at")
    .eq("cliente_id", ativo.clienteId)
    .order("updated_at", { ascending: false });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">
          <Link href="/design" className="hover:text-menta">
            Design
          </Link>{" "}
          / Canvas
        </p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-areia">Canvas</h1>
          <NovoProjetoCanvasBotao clienteId={ativo.clienteId} />
        </div>
        <p className="mt-2 text-sm text-areia/60">
          Monte o fluxo de criação visualmente em nodes (briefing, referência, direção de arte, resultado,
          aprovação...). Modo avançado — o wizard de{" "}
          <Link href="/design" className="text-menta hover:underline">
            Design
          </Link>{" "}
          continua sendo o caminho mais simples pra uma peça rápida.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(projetos ?? []).length === 0 && (
            <p className="col-span-full rounded-2xl panel p-4 text-sm text-areia/40">
              Nenhum projeto de canvas ainda — crie o primeiro acima.
            </p>
          )}
          {(projetos ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/design/canvas/${p.id}`}
              className="rounded-2xl panel p-4 transition hover:border-menta/30"
            >
              <p className="text-sm font-semibold text-areia">{p.title}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-areia/40">{p.status}</p>
              <p className="mt-2 text-[11px] text-areia/30">Atualizado em {new Date(p.updated_at as string).toLocaleString("pt-BR")}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
