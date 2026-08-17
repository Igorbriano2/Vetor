import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { credenciaisProvedor, ConfiguracaoProvedorAusenteError } from "./providers.js";

// "facebook" é o único provider com fluxo de authorize próprio hoje (Login
// do Facebook para Empresas — cobre Ads/Páginas/Instagram/WhatsApp num só
// login); os demais valores de ConnectionProvider são só o que fica gravado
// em connections.provider depois da descoberta de ativos.
describe("credenciaisProvedor", () => {
  const chaves = ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"];
  const originais: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const chave of chaves) {
      originais[chave] = process.env[chave];
      delete process.env[chave];
    }
  });

  afterEach(() => {
    for (const chave of chaves) {
      if (originais[chave] === undefined) delete process.env[chave];
      else process.env[chave] = originais[chave];
    }
  });

  it("lança erro claro quando o app Meta não está configurado (nenhuma credencial)", () => {
    expect(() => credenciaisProvedor("facebook")).toThrow(ConfiguracaoProvedorAusenteError);
  });

  it("lança erro específico faltando só o redirect_uri", () => {
    process.env.META_APP_ID = "id-teste";
    process.env.META_APP_SECRET = "secret-teste";
    expect(() => credenciaisProvedor("facebook")).toThrow(/META_REDIRECT_URI/);
  });

  it("retorna as credenciais quando tudo está configurado", () => {
    process.env.META_APP_ID = "id-teste";
    process.env.META_APP_SECRET = "secret-teste";
    process.env.META_REDIRECT_URI = "https://vetormkt.online/auth/facebook/callback";
    expect(credenciaisProvedor("facebook")).toEqual({
      appId: "id-teste",
      appSecret: "secret-teste",
      redirectUri: "https://vetormkt.online/auth/facebook/callback",
    });
  });
});
