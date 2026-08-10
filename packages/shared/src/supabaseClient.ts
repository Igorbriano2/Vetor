import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceClient(url: string, serviceRoleKey: string) {
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
