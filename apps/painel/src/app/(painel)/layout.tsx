import { createSupabaseServerClient } from "@/lib/supabase/server";
import VetorAppShell from "@/components/shell/VetorAppShell";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome, clientes(nome_empresa)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const orgNome = (usuario?.clientes as unknown as { nome_empresa?: string } | null)?.nome_empresa;

  return (
    <VetorAppShell orgNome={orgNome} userNome={usuario?.nome}>
      {children}
    </VetorAppShell>
  );
}
