import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { criptografarToken, descriptografarToken, ChaveDeCriptografiaAusenteError } from "./tokenCrypto.js";

describe("tokenCrypto", () => {
  const original = process.env.TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  afterEach(() => {
    if (original === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = original;
  });

  it("round-trip: descriptografa exatamente o texto original", () => {
    const token = "EAAG_token_de_acesso_de_teste_123";
    expect(descriptografarToken(criptografarToken(token))).toBe(token);
  });

  it("gera ciphertext diferente a cada chamada (IV aleatório)", () => {
    const token = "mesmo-token";
    expect(criptografarToken(token)).not.toBe(criptografarToken(token));
  });

  it("lança erro claro sem TOKEN_ENCRYPTION_KEY configurada", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => criptografarToken("x")).toThrow(ChaveDeCriptografiaAusenteError);
  });

  it("lança erro se a chave não decodifica para 32 bytes", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("chave-curta-demais").toString("base64");
    expect(() => criptografarToken("x")).toThrow(/32 bytes/);
  });

  it("descriptografar detecta adulteração (authTag não bate)", () => {
    const cifrado = criptografarToken("token-sensivel");
    const partes = cifrado.split(".");
    const adulterado = [partes[0], partes[1], Buffer.from("lixo").toString("base64")].join(".");
    expect(() => descriptografarToken(adulterado)).toThrow();
  });
});
