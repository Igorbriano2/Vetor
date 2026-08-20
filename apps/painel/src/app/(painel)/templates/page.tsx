import { createSupabaseServerClient } from "@/lib/supabase/server";
import TemplatesPainel from "./TemplatesPainel";

export default async function TemplatesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user?.id ?? "").maybeSingle();
  if (!usuario?.cliente_id) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = usuario.cliente_id;

  const { data: templates } = await supabase
    .from("design_flows")
    .select("id, nome, descricao, department, tarefa_template, tags, vezes_usado, created_at")
    .eq("cliente_id", clienteId)
    .eq("status", "ativo")
    .order("vezes_usado", { ascending: false });

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Biblioteca</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Templates</h1>
        <p className="mt-2 text-sm text-areia/60">
          Guarde um pedido que funcionou bem e reaproveite depois — aplicar um template só prepara o texto no chat,
          você revisa e confirma antes de enviar. O Vetor continua entendendo cada pedido normalmente, nunca um modo
          automático que pula isso.
        </p>

        <TemplatesPainel
          clienteId={clienteId}
          templatesIniciais={(templates ?? []).map((t) => ({
            id: t.id as string,
            nome: t.nome as string,
            descricao: t.descricao as string | null,
            department: t.department as string | null,
            tarefaTemplate: t.tarefa_template as string,
            tags: (t.tags as string[]) ?? [],
            vezesUsado: t.vezes_usado as number,
            createdAt: t.created_at as string,
          }))}
        />
      </div>
    </div>
  );
}
