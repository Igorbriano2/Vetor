import { randomUUID } from "node:crypto";
import { supabase } from "../db/supabase.js";
import { criptografarToken } from "../security/tokenCrypto.js";
import {
  PROVIDER_CONFIG,
  credenciaisProvedor,
  graphApiUrl,
  type ConnectionProvider,
} from "./providers.js";

// Nunca aceitar/pedir senha do provedor no formulário do Vetor — todo fluxo
// aqui é OAuth redirect + troca de code server-side (Fase 3, "O VETOR nunca
// deve pedir senha... nem automatizar digitação").

export class EstadoOAuthInvalidoError extends Error {
  constructor(motivo: string) {
    super(`Callback OAuth rejeitado: ${motivo}`);
    this.name = "EstadoOAuthInvalidoError";
  }
}

export interface IniciarConexaoResultado {
  authorizeUrl: string;
  state: string;
}

// 1) Gera state opaco e amarra ao cliente/usuario/provider no banco — o
// callback só é aceito se o state bater exatamente (nunca confia em
// cliente_id vindo da URL de callback, só no que foi gravado aqui).
export async function iniciarConexao(
  clienteId: string,
  usuarioId: string,
  provider: ConnectionProvider,
): Promise<IniciarConexaoResultado> {
  const config = PROVIDER_CONFIG[provider];
  if (!config.authorizeBaseUrl) {
    throw new Error(`"${provider}" não tem diálogo de autorização próprio — use "facebook" (Login do Facebook para Empresas).`);
  }

  const { appId, redirectUri } = credenciaisProvedor(provider);
  const state = randomUUID();

  const { error } = await supabase.from("oauth_states").insert({
    cliente_id: clienteId,
    usuario_id: usuarioId,
    provider,
    state,
    redirect_uri: redirectUri,
  });
  if (error) throw new Error(`Falha ao registrar state OAuth: ${error.message}`);

  const url = new URL(config.authorizeBaseUrl);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", config.scopes.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return { authorizeUrl: url.toString(), state };
}

interface EstadoValidado {
  clienteId: string;
  usuarioId: string;
  redirectUri: string;
}

// Valida o state contra o banco: existe, não expirou, não foi usado, e
// pertence ao provider esperado — bloqueia replay de code (marca used_at) e
// callback direcionado ao tenant errado.
async function validarEConsumirState(provider: ConnectionProvider, state: string): Promise<EstadoValidado> {
  const { data, error } = await supabase
    .from("oauth_states")
    .select("id, cliente_id, usuario_id, provider, redirect_uri, expires_at, used_at")
    .eq("state", state)
    .maybeSingle();

  if (error || !data) throw new EstadoOAuthInvalidoError("state desconhecido");
  if (data.provider !== provider) throw new EstadoOAuthInvalidoError("provider não bate com o state");
  if (data.used_at) throw new EstadoOAuthInvalidoError("code/state já foi usado (replay)");
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    throw new EstadoOAuthInvalidoError("state expirado — inicie a conexão de novo");
  }

  const { error: erroUpdate } = await supabase
    .from("oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id);
  if (erroUpdate) throw new Error(`Falha ao marcar state como usado: ${erroUpdate.message}`);

  return { clienteId: data.cliente_id as string, usuarioId: data.usuario_id as string, redirectUri: data.redirect_uri as string };
}

async function trocarCodePorTokenCurto(provider: ConnectionProvider, code: string, redirectUri: string): Promise<string> {
  const { appId, appSecret } = credenciaisProvedor(provider);

  const url = new URL(graphApiUrl("/oauth/access_token"));
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao trocar code por token (${provider}, ${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// Token de curta duração dura só ~1-2h — trocamos imediatamente pelo de
// longa duração (~60 dias) pra não precisar reautenticar o cliente toda hora.
async function trocarPorTokenLongaDuracao(provider: ConnectionProvider, tokenCurto: string): Promise<{ token: string; expiresInSeconds?: number }> {
  const { appId, appSecret } = credenciaisProvedor(provider);

  const url = new URL(graphApiUrl("/oauth/access_token"));
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", tokenCurto);

  const res = await fetch(url.toString());
  if (!res.ok) {
    // Não é fatal — segue com o token curto em vez de derrubar a conexão
    // inteira; só fica valendo por menos tempo (last_error_code registra o motivo).
    console.warn(`Falha ao trocar por token de longa duração (${provider}): ${res.status}`);
    return { token: tokenCurto };
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return { token: data.access_token, expiresInSeconds: data.expires_in };
}

interface AtivoDescoberto {
  provider: ConnectionProvider;
  externalAccountId: string;
  externalAssetId?: string;
  displayName?: string;
}

// Depois do Login do Facebook para Empresas (1 token cobrindo Ads/Páginas/
// Instagram/WhatsApp), descobre o que o cliente de fato tem acesso e grava
// uma linha de connections por ativo real — nunca assume que "autorizou" =
// "tem conta de anúncio" ou "tem WhatsApp Business", sempre confirma via Graph API.
async function descobrirAtivos(accessToken: string): Promise<AtivoDescoberto[]> {
  const ativos: AtivoDescoberto[] = [];

  const [contasAnuncio, paginas, negocios] = await Promise.all([
    graphGet<{ data: Array<{ id: string; name?: string }> }>("/me/adaccounts?fields=id,name", accessToken),
    graphGet<{ data: Array<{ id: string; name?: string; instagram_business_account?: { id: string; username?: string } }> }>(
      "/me/accounts?fields=id,name,instagram_business_account{id,username}",
      accessToken,
    ),
    graphGet<{ data: Array<{ id: string; name?: string }> }>("/me/businesses?fields=id,name", accessToken),
  ]);

  for (const conta of contasAnuncio?.data ?? []) {
    ativos.push({ provider: "meta_ads", externalAccountId: conta.id, displayName: conta.name });
  }

  for (const pagina of paginas?.data ?? []) {
    ativos.push({ provider: "meta_business", externalAccountId: pagina.id, displayName: pagina.name });
    if (pagina.instagram_business_account) {
      ativos.push({
        provider: "instagram",
        externalAccountId: pagina.instagram_business_account.id,
        externalAssetId: pagina.id,
        displayName: pagina.instagram_business_account.username ?? pagina.name,
      });
    }
  }

  for (const negocio of negocios?.data ?? []) {
    const wabas = await graphGet<{ data: Array<{ id: string; name?: string }> }>(
      `/${negocio.id}/owned_whatsapp_business_accounts?fields=id,name`,
      accessToken,
    );
    for (const waba of wabas?.data ?? []) {
      ativos.push({ provider: "whatsapp", externalAccountId: waba.id, externalAssetId: negocio.id, displayName: waba.name });
    }
  }

  return ativos;
}

async function graphGet<T>(path: string, accessToken: string): Promise<T | null> {
  const separador = path.includes("?") ? "&" : "?";
  const res = await fetch(graphApiUrl(`${path}${separador}access_token=${encodeURIComponent(accessToken)}`));
  if (!res.ok) {
    console.warn(`Graph API falhou em ${path}: ${res.status}`);
    return null;
  }
  return (await res.json()) as T;
}

// 2) Recebe o callback (code+state), valida, troca por token de longa
// duração, descobre os ativos reais e grava uma connection por ativo. Nunca
// loga o token em claro.
export async function concluirConexao(
  provider: ConnectionProvider,
  code: string,
  state: string,
): Promise<{ clienteId: string; status: "connected"; ativos: number }> {
  const estado = await validarEConsumirState(provider, state);
  const tokenCurto = await trocarCodePorTokenCurto(provider, code, estado.redirectUri);
  const { token, expiresInSeconds } = await trocarPorTokenLongaDuracao(provider, tokenCurto);

  const ativos = provider === "facebook" ? await descobrirAtivos(token) : [];

  if (ativos.length === 0) {
    // Sem ativo nenhum descoberto (ex: usuário sem página/conta de anúncio)
    // ainda registra a autorização em si, pra não perder o consentimento dado.
    await gravarConexao("meta_business", estado.clienteId, {
      accessToken: token,
      expiresInSeconds,
      externalAccountId: "conta-sem-ativos",
      displayName: "Login autorizado (sem página/conta vinculada ainda)",
      scopes: PROVIDER_CONFIG.facebook.scopes,
    });
  } else {
    for (const ativo of ativos) {
      await gravarConexao(ativo.provider, estado.clienteId, {
        accessToken: token,
        expiresInSeconds,
        externalAccountId: ativo.externalAccountId,
        externalAssetId: ativo.externalAssetId,
        displayName: ativo.displayName,
        scopes: PROVIDER_CONFIG.facebook.scopes,
      });
    }
  }

  return { clienteId: estado.clienteId, status: "connected", ativos: ativos.length };
}

interface DadosConexao {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  externalAccountId?: string;
  externalAssetId?: string;
  displayName?: string;
  scopes: string[];
}

async function gravarConexao(provider: ConnectionProvider, clienteId: string, dados: DadosConexao): Promise<void> {
  const expiresAt = dados.expiresInSeconds
    ? new Date(Date.now() + dados.expiresInSeconds * 1000).toISOString()
    : null;

  const { error } = await supabase.from("connections").upsert(
    {
      cliente_id: clienteId,
      provider,
      external_account_id: dados.externalAccountId ?? null,
      external_asset_id: dados.externalAssetId ?? null,
      display_name: dados.displayName ?? null,
      scopes: dados.scopes,
      encrypted_access_token: criptografarToken(dados.accessToken),
      encrypted_refresh_token: dados.refreshToken ? criptografarToken(dados.refreshToken) : null,
      expires_at: expiresAt,
      status: "connected",
      last_validated_at: new Date().toISOString(),
      consent_given_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cliente_id,provider,external_account_id" },
  );
  if (error) throw new Error(`Falha ao gravar conexão "${provider}": ${error.message}`);
}

// Embedded Signup (WhatsApp) via SDK — caminho alternativo ao Login do
// Facebook para Empresas, não usado pelo botão principal hoje (que já cobre
// WhatsApp via descoberta de owned_whatsapp_business_accounts), mas
// disponível caso o fluxo unificado não encontre o WABA automaticamente
// (ex: conta recém-criada fora do Business Manager already vinculado).
export async function concluirWhatsappEmbeddedSignup(
  clienteId: string,
  code: string,
  wabaId: string,
  phoneNumberId: string,
): Promise<{ status: "connected" }> {
  const { appId, appSecret } = credenciaisProvedor("whatsapp");

  const url = new URL(graphApiUrl("/oauth/access_token"));
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao trocar code do Embedded Signup: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { access_token: string };

  await gravarConexao("whatsapp", clienteId, {
    accessToken: data.access_token,
    externalAccountId: wabaId,
    externalAssetId: phoneNumberId,
    displayName: `WABA ${wabaId}`,
    scopes: PROVIDER_CONFIG.whatsapp.scopes,
  });

  return { status: "connected" };
}

export async function listarConexoes(clienteId: string) {
  const { data, error } = await supabase
    .from("connections")
    .select("provider, display_name, status, external_account_id, last_validated_at, updated_at")
    .eq("cliente_id", clienteId);
  if (error) throw new Error(`Falha ao listar conexões: ${error.message}`);
  return data ?? [];
}

export async function revogarConexao(clienteId: string, provider: ConnectionProvider): Promise<void> {
  const { error } = await supabase
    .from("connections")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .eq("provider", provider);
  if (error) throw new Error(`Falha ao revogar conexão "${provider}": ${error.message}`);
}
