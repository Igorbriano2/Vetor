"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { salvarPrefillComando } from "@/lib/conversation";

interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  department: string | null;
  tarefaTemplate: string;
  tags: string[];
  vezesUsado: number;
  createdAt: string;
}

const DEPARTAMENTOS = [
  { valor: "design", label: "Design" },
  { valor: "videomaker", label: "Videomaker" },
  { valor: "trafego", label: "Tráfego" },
  { valor: "planejamento", label: "Planejamento" },
  { valor: "conteudo", label: "Conteúdo" },
] as const;

export default function TemplatesPainel({ clienteId, templatesIniciais }: { clienteId: string; templatesIniciais: Template[] }) {
  const [templates, setTemplates] = useState(templatesIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  async function criarTemplate(dados: { nome: string; descricao: string; department: string; tarefaTemplate: string; tagsTexto: string }) {
    if (!dados.nome.trim() || !dados.tarefaTemplate.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const tags = dados.tagsTexto.split(",").map((t) => t.trim()).filter(Boolean);
      const { data, error } = await supabase
        .from("design_flows")
        .insert({
          cliente_id: clienteId,
          nome: dados.nome.trim(),
          descricao: dados.descricao || null,
          department: dados.department || null,
          tarefa_template: dados.tarefaTemplate.trim(),
          tags,
        })
        .select("id, nome, descricao, department, tarefa_template, tags, vezes_usado, created_at")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Falha ao salvar o template.");

      setTemplates((atual) => [
        {
          id: data.id as string,
          nome: data.nome as string,
          descricao: data.descricao as string | null,
          department: data.department as string | null,
          tarefaTemplate: data.tarefa_template as string,
          tags: (data.tags as string[]) ?? [],
          vezesUsado: data.vezes_usado as number,
          createdAt: data.created_at as string,
        },
        ...atual,
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui salvar o template agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function usarNoChat(template: Template) {
    salvarPrefillComando(template.tarefaTemplate);
    // Contador é só indicativo (mostra os mais úteis primeiro) — nunca
    // bloqueia a navegação se a escrita falhar.
    await supabase
      .from("design_flows")
      .update({ vezes_usado: template.vezesUsado + 1 })
      .eq("id", template.id)
      .eq("cliente_id", clienteId);
    router.push("/dashboard");
  }

  async function arquivar(id: string) {
    const { error } = await supabase
      .from("design_flows")
      .update({ status: "arquivado", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("cliente_id", clienteId);
    if (error) {
      setErro(error.message);
      return;
    }
    setTemplates((atual) => atual.filter((t) => t.id !== id));
  }

  return (
    <div className="mt-8 space-y-8">
      <NovoTemplateForm salvando={salvando} onCriar={criarTemplate} />
      {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {templates.length === 0 && (
          <p className="col-span-full rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
            Nenhum template ainda — guarde o primeiro acima.
          </p>
        )}
        {templates.map((t) => (
          <div key={t.id} className="flex flex-col gap-2 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-areia">{t.nome}</p>
              {t.department && (
                <span className="mono-label shrink-0 rounded border border-areia/15 px-1.5 py-0.5 text-[10px] text-areia/50">
                  {DEPARTAMENTOS.find((d) => d.valor === t.department)?.label ?? t.department}
                </span>
              )}
            </div>
            {t.descricao && <p className="text-xs text-areia/50">{t.descricao}</p>}
            <p className="line-clamp-3 rounded-lg bg-petroleo-3/60 p-2 text-xs text-areia/60">{t.tarefaTemplate}</p>
            {t.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.tags.map((tag) => (
                  <span key={tag} className="rounded border border-areia/10 px-1.5 py-0.5 text-[10px] text-areia/40">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span className="text-[10px] text-areia/30">usado {t.vezesUsado}x</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => arquivar(t.id)}
                  className="mono-label rounded-lg border border-areia/15 px-2 py-1 text-[11px] text-areia/50 hover:text-coral"
                >
                  Arquivar
                </button>
                <button
                  type="button"
                  onClick={() => usarNoChat(t)}
                  className="mono-label rounded-lg border border-menta/40 bg-menta/10 px-3 py-1 text-[11px] text-menta hover:bg-menta/20"
                >
                  Usar no chat
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NovoTemplateForm({
  salvando,
  onCriar,
}: {
  salvando: boolean;
  onCriar: (dados: { nome: string; descricao: string; department: string; tarefaTemplate: string; tagsTexto: string }) => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [department, setDepartment] = useState("");
  const [tarefaTemplate, setTarefaTemplate] = useState("");
  const [tagsTexto, setTagsTexto] = useState("");

  function enviar() {
    onCriar({ nome, descricao, department, tarefaTemplate, tagsTexto });
    setNome("");
    setDescricao("");
    setDepartment("");
    setTarefaTemplate("");
    setTagsTexto("");
  }

  return (
    <div className="rounded-2xl border border-menta/20 bg-petroleo-2/60 p-5">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-menta">Novo template</h2>
      <p className="mt-1 text-xs text-areia/50">
        Escreva o pedido exatamente como você digitaria pro Vetor — é esse texto que vai ser reaproveitado.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do template (ex: Promoção da semana)"
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30"
        />
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia"
        >
          <option value="">Sem departamento definido</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.label}
            </option>
          ))}
        </select>
        <textarea
          value={tarefaTemplate}
          onChange={(e) => setTarefaTemplate(e.target.value)}
          placeholder="Ex: Cria uma peça de feed com nossa identidade visual, headline sobre a promoção da semana, CTA 'peça já pelo WhatsApp'"
          rows={3}
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30 sm:col-span-2"
        />
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição (opcional)"
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30"
        />
        <input
          value={tagsTexto}
          onChange={(e) => setTagsTexto(e.target.value)}
          placeholder="Tags separadas por vírgula"
          className="rounded-xl border border-areia/15 bg-petroleo-3/60 px-3 py-2 text-sm text-areia placeholder:text-areia/30"
        />
      </div>

      <button
        type="button"
        onClick={enviar}
        disabled={salvando}
        className="mono-label mt-4 rounded-lg border border-menta/40 bg-menta/10 px-4 py-2 text-menta transition hover:bg-menta/20 disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Salvar template"}
      </button>
    </div>
  );
}
