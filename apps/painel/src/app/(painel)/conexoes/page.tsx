import { createSupabaseServerClient } from "@/lib/supabase/server";
import ConexoesPainel from "./ConexoesPainel";

// Página dedicada de conexões oficiais — mesma lógica de
// components/onboarding/OnboardingWizard.tsx (etapa "conexoes"), só que como
// tela própria e com opção de desconectar, pra não obrigar o cliente a
// reabrir o onboarding pra gerenciar isso depois.
export default async function ConexoesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();
  if (!usuario?.cliente_id) {
    return (
      <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>
    );
  }

  const { data: conexoes } = await supabase
    .from("connections")
    .select("provider, status, display_name, updated_at")
    .eq("cliente_id", usuario.cliente_id);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Conexões</h1>
        <p className="mt-2 text-sm text-areia/60">
          Contas oficiais conectadas — a Meta nunca pede sua senha pro Vetor, é sempre a tela oficial dela.
        </p>

        <ConexoesPainel conexoesIniciais={conexoes ?? []} />
      </div>
    </div>
  );
}
