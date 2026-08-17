// Configuração de OAuth com a Meta (Fase 3 — conexões oficiais).
//
// "facebook" é o fluxo real hoje: Login do Facebook para Empresas (Facebook
// Login for Business) — um único diálogo de autorização, um único
// redirect_uri fixo (cadastrado caractere por caractere no app Meta, nunca
// gerado dinamicamente), pedindo de uma vez os escopos de Ads/Páginas/
// Instagram/WhatsApp. Depois da troca de code por token, o backend descobre
// os ativos reais (páginas, contas de anúncio, contas Instagram vinculadas,
// WhatsApp Business Accounts) e grava uma linha em `connections` por ativo —
// ver connectionsService.ts, descobrirEArmazenarAtivos.
//
// instagram/whatsapp/meta_ads/meta_business continuam existindo como valores
// válidos da coluna connections.provider (o que foi descoberto), mas não têm
// mais fluxo de authorize próprio — "facebook" é o único ponto de entrada.

export type ConnectionProvider = "instagram" | "whatsapp" | "meta_ads" | "meta_business" | "facebook";

export interface ProviderConfig {
  appIdEnv: string;
  appSecretEnv: string;
  redirectUriEnv: string;
  authorizeBaseUrl: string;
  scopes: string[];
  usaEmbeddedSignup?: boolean;
}

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";

// Escopos exatamente como habilitados no app Meta "Vetor-App" (Ads Manager,
// Páginas, Instagram, WhatsApp Business Platform) — nunca pedir escopo que o
// app não tem caso de uso aprovado/configurado pra cobrir.
const ESCOPOS_FACEBOOK_LOGIN_NEGOCIOS = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_comments",
  "instagram_content_publish",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
];

export const PROVIDER_CONFIG: Record<ConnectionProvider, ProviderConfig> = {
  facebook: {
    appIdEnv: "META_APP_ID",
    appSecretEnv: "META_APP_SECRET",
    // Fixo — precisa bater EXATAMENTE com o que está cadastrado no app Meta:
    // https://vetormkt.online/auth/facebook/callback (serve pelo apps/landing,
    // não pelo painel — ver apps/landing/src/app/auth/facebook/callback/route.ts).
    redirectUriEnv: "META_REDIRECT_URI",
    authorizeBaseUrl: "https://www.facebook.com/dialog/oauth",
    scopes: ESCOPOS_FACEBOOK_LOGIN_NEGOCIOS,
  },
  // Mantidos só como valores possíveis de connections.provider (o que foi
  // descoberto após o login unificado) — sem authorizeBaseUrl próprio.
  instagram: {
    appIdEnv: "META_APP_ID",
    appSecretEnv: "META_APP_SECRET",
    redirectUriEnv: "META_REDIRECT_URI",
    authorizeBaseUrl: "",
    scopes: ESCOPOS_FACEBOOK_LOGIN_NEGOCIOS,
  },
  whatsapp: {
    appIdEnv: "META_APP_ID",
    appSecretEnv: "META_APP_SECRET",
    redirectUriEnv: "META_REDIRECT_URI",
    authorizeBaseUrl: "",
    scopes: ESCOPOS_FACEBOOK_LOGIN_NEGOCIOS,
  },
  meta_ads: {
    appIdEnv: "META_APP_ID",
    appSecretEnv: "META_APP_SECRET",
    redirectUriEnv: "META_REDIRECT_URI",
    authorizeBaseUrl: "",
    scopes: ESCOPOS_FACEBOOK_LOGIN_NEGOCIOS,
  },
  meta_business: {
    appIdEnv: "META_APP_ID",
    appSecretEnv: "META_APP_SECRET",
    redirectUriEnv: "META_REDIRECT_URI",
    authorizeBaseUrl: "",
    scopes: ESCOPOS_FACEBOOK_LOGIN_NEGOCIOS,
  },
};

export function graphApiUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}${path}`;
}

export class ConfiguracaoProvedorAusenteError extends Error {
  constructor(provider: ConnectionProvider, envVar: string) {
    super(`Conexão "${provider}" não está configurada neste ambiente — falta ${envVar}.`);
    this.name = "ConfiguracaoProvedorAusenteError";
  }
}

export function credenciaisProvedor(provider: ConnectionProvider): { appId: string; appSecret: string; redirectUri: string } {
  const config = PROVIDER_CONFIG[provider];
  const appId = process.env[config.appIdEnv];
  const appSecret = process.env[config.appSecretEnv];
  const redirectUri = process.env[config.redirectUriEnv];
  if (!appId) throw new ConfiguracaoProvedorAusenteError(provider, config.appIdEnv);
  if (!appSecret) throw new ConfiguracaoProvedorAusenteError(provider, config.appSecretEnv);
  if (!redirectUri) throw new ConfiguracaoProvedorAusenteError(provider, config.redirectUriEnv);
  return { appId, appSecret, redirectUri };
}
