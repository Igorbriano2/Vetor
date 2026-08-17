import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM — token de conexão OAuth nunca fica em texto plano no banco
// (connections.encrypted_access_token/encrypted_refresh_token). TOKEN_ENCRYPTION_KEY
// é uma chave de 32 bytes em base64, gerada uma vez por ambiente (nunca commitada,
// ver .env.example). Formato armazenado: base64(iv).base64(authTag).base64(ciphertext).

const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12;

export class ChaveDeCriptografiaAusenteError extends Error {
  constructor() {
    super("TOKEN_ENCRYPTION_KEY é obrigatório para conectar canais externos (connections).");
    this.name = "ChaveDeCriptografiaAusenteError";
  }
}

function chave(): Buffer {
  const valor = process.env.TOKEN_ENCRYPTION_KEY;
  if (!valor) throw new ChaveDeCriptografiaAusenteError();
  const buf = Buffer.from(valor, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY deve decodificar para exatamente 32 bytes (base64 de uma chave AES-256).");
  }
  return buf;
}

export function criptografarToken(texto: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave(), iv);
  const ciphertext = Buffer.concat([cipher.update(texto, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function descriptografarToken(valor: string): string {
  const partes = valor.split(".");
  if (partes.length !== 3) throw new Error("Formato de token criptografado inválido.");
  const [ivB64, authTagB64, ciphertextB64] = partes as [string, string, string];
  const decipher = createDecipheriv(ALGORITMO, chave(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const texto = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return texto.toString("utf-8");
}
