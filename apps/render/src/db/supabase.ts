import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para acessar o banco");
  }

  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}

// Proxy em vez de inicializar no import: deixa o servidor subir e responder
// /health mesmo antes das credenciais reais do Supabase estarem configuradas
// (mesmo padrão de apps/agentes/src/db/supabase.ts).
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    const real = getClient();
    const value = Reflect.get(real, prop) as unknown;
    return typeof value === "function" ? value.bind(real) : value;
  },
});
