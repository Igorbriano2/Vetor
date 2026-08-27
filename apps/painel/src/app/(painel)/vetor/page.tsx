import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import { buscarArtefatos } from "@/lib/artifacts/fetchArtifacts";
import VetorCockpit from "@/components/VetorCockpit";

const STATUS_MISSAO_TERMINAL = ["completed", "completed_with_caveats", "failed", "cancelled", "archived"];

// Painel principal — sala de interação do Vetor (núcleo grande + chat
// multimodal), não um dashboard de indicadores. Campanhas, Design, Conteúdo,
// Tráfego, Solicitações, Planejamento, Entregas e Insights continuam
// acessíveis pela navegação existente (VetorAppShell, intocado) — só o
// conteúdo central desta página muda, por instrução explícita do comando.
// Fase 1 do Vetor Manager UX (docs/VETOR-MANAGER-UX-AUDIT.md) — home híbrida:
// além do núcleo+chat, agora busca as criações mais recentes (mesma
// buscarArtefatos já usada em /criacoes) pra dar uma primeira dobra menos
// vazia. Nenhuma tabela nova, nenhum caminho de dado novo.
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return (
      <div className="px-6 py-10 text-center text-areia/60">
        Seu usuário ainda não está vinculado a um cliente Vetor. Fale com o time de suporte para concluir o
        cadastro.
      </div>
    );
  }

  // Fase 8 do reset de produto — filtro explícito por cliente_id, não só
  // RLS implícito: admin_vetor passa por toda policy (current_papel() =
  // 'admin_vetor'), então sem este filtro o dashboard misturava missões de
  // QUALQUER cliente. Com o workspace switcher (resolverClienteAtivo.ts),
  // isso precisa refletir o workspace escolhido de verdade.
  const { data: missoes } = await supabase
    .from("missions")
    .select("id, titulo, status, created_at")
    .eq("cliente_id", ativo.clienteId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: aprovacoesPendentes } = await supabase
    .from("approvals")
    .select("id")
    .eq("cliente_id", ativo.clienteId)
    .eq("status", "pending");

  const { data: demandasPendentes } = await supabase
    .from("demandas")
    .select("id")
    .eq("cliente_id", ativo.clienteId)
    .in("status", ["aguardando_aprovacao", "pendente_aprovacao"]);

  const missoesAtivas = (missoes ?? []).filter((m) => !STATUS_MISSAO_TERMINAL.includes(m.status));
  const missaoAtual =
    missoesAtivas.find((m) => m.status === "running") ??
    missoesAtivas.find((m) => m.status === "awaiting_approval") ??
    missoesAtivas[0] ??
    null;

  const contagemPendentes = (aprovacoesPendentes?.length ?? 0) + (demandasPendentes?.length ?? 0);

  const criacoesRecentes = (
    await buscarArtefatos(supabase, { departamentos: ["design", "videomaker"], clienteId: ativo.clienteId })
  ).slice(0, 4);

  // Fase 1 do VETOR Manager V2 (docs/IMPLEMENTATION-AUDIT-V2.md) — dado real
  // pros painéis de telemetria do cockpit fullscreen. Nunca um percentual
  // inventado: cada painel só mostra o que existe de verdade, ou um estado
  // "aguardando"/"indisponível" honesto quando o dado não existe ainda.
  const [{ data: conexoes }, { data: brandKitAtual }, { count: contagemReferencias }, { data: artefatosRecentes }] =
    await Promise.all([
      supabase.from("connections").select("provider, status").eq("cliente_id", ativo.clienteId),
      supabase.from("brand_kits").select("id").eq("cliente_id", ativo.clienteId).eq("is_atual", true).maybeSingle(),
      supabase
        .from("reference_library_items")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", ativo.clienteId)
        .eq("status", "ativo"),
      // Últimos 7 dias de artifacts — sparkline real de atividade
      // (ANALYTICS), nunca uma série de números fabricada.
      supabase
        .from("artifacts")
        .select("created_at")
        .eq("cliente_id", ativo.clienteId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

  // Cada provider pode ter várias linhas em `connections` (histórico de
  // contas conectadas/revogadas — comum em conta de agência com várias
  // contas de anúncio). Nunca pega "a última linha lida" (ordem não é
  // garantida pela query) — um provider está conectado se QUALQUER linha
  // dele estiver com status "connected", nunca menos que isso.
  const providersConectados = new Set(
    (conexoes ?? []).filter((c) => c.status === "connected").map((c) => c.provider as string),
  );

  // Agrupa created_at real em 7 baldes diários (hoje - 6 até hoje) — nunca
  // preenche um dia sem artefato com um valor fabricado, só com 0 real.
  const atividadeDiaria: number[] = Array.from({ length: 7 }, () => 0);
  const hojeUTC = new Date();
  hojeUTC.setUTCHours(0, 0, 0, 0);
  for (const a of artefatosRecentes ?? []) {
    const data = new Date(a.created_at as string);
    data.setUTCHours(0, 0, 0, 0);
    const diffDias = Math.round((hojeUTC.getTime() - data.getTime()) / (24 * 60 * 60 * 1000));
    const indice = 6 - diffDias;
    if (indice >= 0 && indice < 7) atividadeDiaria[indice]!++;
  }

  return (
    <VetorCockpit
      missaoAtual={missaoAtual ? { id: missaoAtual.id, titulo: missaoAtual.titulo, status: missaoAtual.status } : null}
      contagemPendentes={contagemPendentes}
      contagemAtivas={missoesAtivas.length}
      criacoesRecentes={criacoesRecentes}
      contextoNegocio={{
        workspaceNome: ativo.clienteNome,
        temBrandKit: !!brandKitAtual,
        contagemReferencias: contagemReferencias ?? 0,
      }}
      conexoes={{
        supabase: true,
        metaAds: providersConectados.has("meta_ads"),
        instagram: providersConectados.has("instagram"),
        whatsapp: providersConectados.has("whatsapp"),
      }}
      atividadeDiaria={atividadeDiaria}
      // A pedido explícito do dono do produto: a saudação toca toda vez que
      // o usuário entra ou atualiza a página, não só na primeira vez — ver
      // apps/agentes/src/routes/perfil.ts (não é mais idempotente por
      // usuário).
      saudacaoJaTocada={false}
    />
  );
}
