import { Redis } from "ioredis";

let client: Redis | null = null;

// Mesmo padrão de lazy-init de db/supabase.ts: o servidor HTTP sobe e responde
// /health mesmo sem REDIS_URL configurado. O worker (src/workers/missionWorker.ts),
// esse sim, falha alto na inicialização se não houver Redis — fila de missão é
// infraestrutura obrigatória para o worker, não uma integração opcional como
// WhatsApp/Asaas em modo sandbox.
export function getRedisConnection(): Redis {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL é obrigatório para usar a fila de missões");
  }

  client = new Redis(url, { maxRetriesPerRequest: null });
  // Sem isso, o ioredis engole silenciosamente qualquer erro de conexão (é o
  // comportamento padrão da lib quando não há listener de "error") — combinado
  // com maxRetriesPerRequest: null, um problema de rede/credencial vira um
  // comando (ex: enfileirar missão) preso para sempre, sem nenhum log.
  client.on("error", (err) => {
    console.error("Erro na conexão Redis (fila de missões):", err.message);
  });
  return client;
}
