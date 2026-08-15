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
  return client;
}
