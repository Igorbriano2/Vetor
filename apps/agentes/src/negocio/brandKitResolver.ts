import { supabase } from "../db/supabase.js";
import type { FormatoPeca } from "./designLayout.js";

// Extraído de agents/specialistRunner.ts (achado ao vivo: o ImageAdapter da
// suíte de IA — geração direta pelo canvas, sem missão — precisava do MESMO
// resolvedor de fonte/cor/logo do BrandKit que o fluxo de missão usa, mas
// importar de agents/ pra dentro de negocio/ inverteria a direção certa de
// dependência (agents/ já importa de negocio/, nunca o contrário). Nenhuma
// lógica mudou, só o endereço.

export interface BrandKitResolvido {
  cores: unknown;
  fontes: unknown;
  regras: unknown;
  logo_area_protecao?: string | null;
  logo_tamanho_minimo?: string | null;
  logo_fundos_proibidos?: unknown;
  logo_usos_proibidos?: unknown;
}

// Mesma query usada em missions/orchestrator.ts pra montar o contexto do
// especialista — nunca uma 2ª versão divergente do que "o BrandKit atual"
// significa.
export async function buscarBrandKit(clienteId: string): Promise<BrandKitResolvido | null> {
  const { data } = await supabase
    .from("brand_kits")
    .select("cores, fontes, regras, logo_area_protecao, logo_tamanho_minimo, logo_fundos_proibidos, logo_usos_proibidos")
    .eq("cliente_id", clienteId)
    .eq("is_atual", true)
    .maybeSingle();
  return (data as BrandKitResolvido | null) ?? null;
}

// mapa reels_cover->story / ad->feed / custom->generico: variante de logo
// de story (retrato), ad/custom caem no fallback "principal" da logo
// (nunca ficam sem logo só por não ter uma variante específica cadastrada
// pro formato novo).
export function mapearFormatoParaLogo(formato: FormatoPeca): string {
  if (formato === "reels_cover") return "story";
  if (formato === "ad") return "feed";
  if (formato === "custom") return "generico";
  return formato;
}

// Lê fonte/cor do BrandKit de forma defensiva — o schema de `fontes`/`cores`
// é jsonb livre, sem shape fixo — nunca assume uma chave que pode não
// existir, sempre cai num fallback seguro e nunca lança erro por causa
// disso. Duas famílias, não uma: brandbooks reais (ex: Dog King) separam
// fonte de título/destaque (headline, CTA — o que precisa "gritar") de
// fonte de apoio (subheadline, caption — texto corrido, mais legível em
// tamanho menor). Sem "apoio" cadastrado, cai pra mesma fonte do título
// (nunca duas fontes por acidente quando só uma foi informada).
export function resolverFonteDoBrandKit(brandKit: BrandKitResolvido | null | undefined): { fontFamilyTitulo: string; fontFamilyApoio: string; fallbackUsado: boolean } {
  const fontes = brandKit?.fontes as { principal?: unknown; titulo?: unknown; apoio?: unknown } | null | undefined;
  const candidataTitulo = fontes?.principal ?? fontes?.titulo;
  if (typeof candidataTitulo === "string" && candidataTitulo.trim()) {
    const titulo = candidataTitulo.trim();
    const candidataApoio = fontes?.apoio;
    const apoio = typeof candidataApoio === "string" && candidataApoio.trim() ? candidataApoio.trim() : titulo;
    return { fontFamilyTitulo: titulo, fontFamilyApoio: apoio, fallbackUsado: false };
  }
  return { fontFamilyTitulo: "sans", fontFamilyApoio: "sans", fallbackUsado: true };
}

export function resolverCorPrimariaDoBrandKit(brandKit: BrandKitResolvido | null | undefined): string | null {
  const cores = brandKit?.cores as { primaria?: unknown; texto?: unknown } | null | undefined;
  const candidata = cores?.primaria;
  return typeof candidata === "string" && /^#[0-9a-fA-F]{3,6}$/.test(candidata.trim()) ? candidata.trim() : null;
}
