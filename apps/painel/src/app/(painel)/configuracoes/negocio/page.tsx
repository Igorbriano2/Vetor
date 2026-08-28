import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import ConexoesPainel from "../../conexoes/ConexoesPainel";
import { perfilVazio, brandKitVazio, type BusinessProfileForm, type BrandKitForm } from "@/lib/onboarding/types";
import NegocioTabs from "./NegocioTabs";

// brand_kits.cores é jsonb livre — já apareceu em pelo menos duas formas
// reais em produção: array já no formato certo, ou um objeto agrupado
// {primarias:[{nome,hex}...], secundarias:[{nome,hex}...]} (usado pelo
// brand kit real do Dog King, configurado via SQL direto numa rodada
// anterior). Achado ao vivo verificando a área Negócio desta rodada: o
// código antigo tratava QUALQUER objeto como um mapa plano {nome: hex},
// então um grupo virava `hex: "[object Object],[object Object]"`. Nunca
// assume o shape — sempre normaliza pro formato flat que BrandKitForm
// espera.
function normalizarCoresBrandKit(cores: unknown): BrandKitForm["cores"] {
  if (Array.isArray(cores)) return cores as BrandKitForm["cores"];
  if (!cores || typeof cores !== "object") return [];

  const obj = cores as Record<string, unknown>;
  const grupos = ["primarias", "secundarias"] as const;
  if (grupos.some((g) => Array.isArray(obj[g]))) {
    return grupos.flatMap((g) => {
      const lista = obj[g];
      if (!Array.isArray(lista)) return [];
      return lista
        .filter((item): item is { nome?: string; hex?: string } => !!item && typeof item === "object")
        .map((item) => ({ nome: String(item.nome ?? ""), hex: String(item.hex ?? ""), uso: g }));
    });
  }

  // Fallback: mapa plano {nome: hex}.
  return Object.entries(obj).map(([nome, hex]) => ({ nome, hex: String(hex) }));
}

// Server wrapper: resolve cliente_id da sessão e busca o estado salvo
// (retomada) antes de montar o wizard client-side (Fase 2). CRUD continua
// direto no Supabase (RLS já permite insert/update do próprio cliente_id),
// mesmo padrão que a tela anterior já usava.
// Fase 5 do Vetor Manager — Conexões passou a viver aqui como segunda aba
// (?aba=conexoes), reaproveitando ConexoesPainel tal como era em /conexoes
// (agora um redirect); nenhuma lógica de conexão foi duplicada ou reescrita.
export default async function ConfiguracoesNegocioPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba } = await searchParams;
  const abaAtiva = aba === "conexoes" ? "conexoes" : "negocio";

  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return (
      <main className="px-6 py-10 text-areia">
        <p className="text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</p>
      </main>
    );
  }

  const clienteId = ativo.clienteId;

  const [{ data: perfilDb }, { data: brandKitDb }, { data: conexoesDb }] = await Promise.all([
    supabase.from("business_profiles").select("*").eq("cliente_id", clienteId).maybeSingle(),
    supabase.from("brand_kits").select("*").eq("cliente_id", clienteId).eq("is_atual", true).maybeSingle(),
    supabase.from("connections").select("provider, status, display_name, updated_at").eq("cliente_id", clienteId),
  ]);

  const perfilInicial: BusinessProfileForm = perfilDb
    ? {
        ...perfilVazio(),
        nome_exibicao: perfilDb.nome_exibicao ?? "",
        nome_legal: perfilDb.nome_legal ?? "",
        categoria: perfilDb.categoria ?? "",
        descricao: perfilDb.descricao ?? "",
        site_url: perfilDb.site_url ?? "",
        telefone_principal: perfilDb.telefone_principal ?? "",
        whatsapp_telefone: perfilDb.whatsapp_telefone ?? "",
        email: perfilDb.email ?? "",
        endereco: perfilDb.endereco ?? {},
        areas_atendimento: perfilDb.areas_atendimento ?? [],
        timezone: perfilDb.timezone ?? "America/Sao_Paulo",
        horario_funcionamento:
          Array.isArray(perfilDb.horario_funcionamento) && perfilDb.horario_funcionamento.length > 0
            ? perfilDb.horario_funcionamento
            : perfilVazio().horario_funcionamento,
        modalidades_atendimento: perfilDb.modalidades_atendimento ?? [],
        redes_sociais: perfilDb.redes_sociais ?? {},
        produtos_ofertas: perfilDb.produtos_ofertas ?? [],
        publico: perfilDb.publico ?? {},
        objetivos: perfilDb.objetivos ?? [],
        concorrentes: perfilDb.concorrentes ?? [],
        ofertas: Array.isArray(perfilDb.ofertas) ? perfilDb.ofertas : [],
        tom: perfilDb.tom ?? "",
        restricoes: perfilDb.restricoes ?? [],
        onboarding_status: perfilDb.onboarding_status ?? "not_started",
        onboarding_etapa_atual: perfilDb.onboarding_etapa_atual ?? null,
      }
    : perfilVazio();

  const brandKitInicial: BrandKitForm = brandKitDb
    ? {
        ...brandKitVazio(),
        cores: normalizarCoresBrandKit(brandKitDb.cores),
        fontes: brandKitDb.fontes ?? {},
        logo_principal_ref: brandKitDb.logo_principal_ref ?? null,
        logo_clara_ref: brandKitDb.logo_clara_ref ?? null,
        logo_escura_ref: brandKitDb.logo_escura_ref ?? null,
        icone_ref: brandKitDb.icone_ref ?? null,
        estilo_visual: brandKitDb.estilo_visual ?? {},
        estilos_proibidos: brandKitDb.estilos_proibidos ?? [],
        exemplos_aprovados: brandKitDb.exemplos_aprovados ?? [],
        regras: brandKitDb.regras ?? {},
        voz_marca: brandKitDb.voz_marca ?? {},
        palavras_permitidas: brandKitDb.palavras_permitidas ?? [],
        palavras_proibidas: brandKitDb.palavras_proibidas ?? [],
        status: brandKitDb.status ?? "draft",
      }
    : brandKitVazio();

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <NegocioTabs ativa={abaAtiva} />

        {abaAtiva === "conexoes" ? (
          <div>
            <p className="mb-6 text-sm text-areia/60">
              Contas oficiais conectadas — a Meta nunca pede sua senha pro Vetor, é sempre a tela oficial dela.
            </p>
            <ConexoesPainel conexoesIniciais={conexoesDb ?? []} />
          </div>
        ) : (
          <OnboardingWizard
            clienteId={clienteId}
            perfilInicial={perfilInicial}
            brandKitInicial={brandKitInicial}
            conexoes={conexoesDb ?? []}
          />
        )}
      </div>
    </div>
  );
}
