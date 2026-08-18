import { createSupabaseServerClient } from "@/lib/supabase/server";
import VetorCockpit from "@/components/VetorCockpit";

const STATUS_MISSAO_TERMINAL = ["completed", "completed_with_caveats", "failed", "cancelled", "archived"];

// Painel principal — sala de interação do Vetor (núcleo grande + chat
// multimodal), não um dashboard de indicadores. Campanhas, Design, Conteúdo,
// Tráfego, Solicitações, Planejamento, Entregas e Insights continuam
// acessíveis pela navegação existente (VetorAppShell, intocado) — só o
// conteúdo central desta página muda, por instrução explícita do comando.
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();

  const { data: missoes } = await supabase
    .from("missions")
    .select("id, titulo, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: aprovacoesPendentes } = await supabase.from("approvals").select("id").eq("status", "pending");

  const { data: demandasPendentes } = await supabase
    .from("demandas")
    .select("id")
    .in("status", ["aguardando_aprovacao", "pendente_aprovacao"]);

  const missoesAtivas = (missoes ?? []).filter((m) => !STATUS_MISSAO_TERMINAL.includes(m.status));
  const missaoAtual =
    missoesAtivas.find((m) => m.status === "running") ??
    missoesAtivas.find((m) => m.status === "awaiting_approval") ??
    missoesAtivas[0] ??
    null;

  const contagemPendentes = (aprovacoesPendentes?.length ?? 0) + (demandasPendentes?.length ?? 0);

  if (!usuario) {
    return (
      <div className="px-6 py-10 text-center text-areia/60">
        Seu usuário ainda não está vinculado a um cliente Vetor. Fale com o time de suporte para concluir o
        cadastro.
      </div>
    );
  }

  return (
    <VetorCockpit
      missaoAtual={missaoAtual ? { id: missaoAtual.id, titulo: missaoAtual.titulo, status: missaoAtual.status } : null}
      contagemPendentes={contagemPendentes}
      contagemAtivas={missoesAtivas.length}
      // A pedido explícito do dono do produto: a saudação toca toda vez que
      // o usuário entra ou atualiza a página, não só na primeira vez — ver
      // apps/agentes/src/routes/perfil.ts (não é mais idempotente por
      // usuário).
      saudacaoJaTocada={false}
    />
  );
}
