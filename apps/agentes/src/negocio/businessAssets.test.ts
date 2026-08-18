import { describe, expect, it } from "vitest";
import { resolverAssetIdDaLogo } from "./businessAssets.js";

describe("resolverAssetIdDaLogo", () => {
  it("usa a variante preferida quando cadastrada pro formato", () => {
    const resultado = resolverAssetIdDaLogo("story", {
      logoPorFormato: { story: "fundo_escuro" },
      principal: "asset-principal",
      fundoClaro: "asset-claro",
      fundoEscuro: "asset-escuro",
      monocromatica: null,
      simbolo: null,
    });
    expect(resultado).toBe("asset-escuro");
  });

  it("cai pra logo principal quando o formato não tem preferência cadastrada", () => {
    const resultado = resolverAssetIdDaLogo("avatar", {
      logoPorFormato: { story: "fundo_escuro" },
      principal: "asset-principal",
      fundoClaro: null,
      fundoEscuro: null,
      monocromatica: null,
      simbolo: null,
    });
    expect(resultado).toBe("asset-principal");
  });

  it("cai pra logo principal quando a variante preferida aponta pra um asset_id vazio", () => {
    const resultado = resolverAssetIdDaLogo("avatar", {
      logoPorFormato: { avatar: "simbolo" },
      principal: "asset-principal",
      fundoClaro: null,
      fundoEscuro: null,
      monocromatica: null,
      simbolo: null, // cadastrada como preferência mas sem asset — não deve travar sem logo nenhuma
    });
    expect(resultado).toBe("asset-principal");
  });

  it("devolve null quando não há nenhuma logo cadastrada (nunca inventa)", () => {
    const resultado = resolverAssetIdDaLogo("feed", {
      logoPorFormato: {},
      principal: null,
      fundoClaro: null,
      fundoEscuro: null,
      monocromatica: null,
      simbolo: null,
    });
    expect(resultado).toBeNull();
  });
});
