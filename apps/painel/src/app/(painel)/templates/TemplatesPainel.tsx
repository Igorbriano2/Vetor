"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { salvarPrefillComando } from "@/lib/conversation";

interface Receita {
  objetivo?: string;
  setorRecomendado?: string;
  formato?: string;
  exemploResultado?: string;
  tom?: string;
  oferta?: string;
  produtoOuPessoa?: string;
  cta?: string;
  restricoes?: string;
  assetsNecessarios?: string;
  numeroVariacoes?: number;
  etapasExecucao?: string[];
  aprovacaoNecessaria?: boolean;
}

interface Template {
  id: string;
  nome: string;
  descricao: string | null;
  department: string | null;
  tarefaTemplate: string;
  tags: string[];
  vezesUsado: number;
  createdAt: string;
  thumbnailUrl: string | null;
  receita: Receita;
}

const DEPARTAMENTOS = [
  { valor: "design", label: "Design" },
  { valor: "videomaker", label: "Videomaker" },
  { valor: "trafego", label: "Tráfego" },
  { valor: "planejamento", label: "Planejamento" },
  { valor: "conteudo", label: "Conteúdo" },
] as const;

// Composição própria do Vetor por departamento — mesmo princípio das
// categorias curadas em /referencias: nunca um card vazio, mas também
// nunca uma imagem fingindo ser um exemplo real quando não existe um.
const GRADIENTE_POR_DEPARTAMENTO: Record<string, string> = {
  design: "from-menta/25 to-petroleo",
  videomaker: "from-coral/25 to-petroleo",
  trafego: "from-ambar/25 to-petroleo",
  planejamento: "from-menta/20 to-petroleo-2",
  conteudo: "from-ambar/20 to-petroleo-2",
};

// Fase 3 do reset de produto (docs/PRODUCT-RESET-AUDIT.md) — template deixa
// de ser só um texto guardado e vira uma receita completa (objetivo, setor,
// formato, exemplo, campos guiados, assets, variações, etapas, aprovação).
// "Usar este template" abre o MESMO wizard da Fase 1 (CriarPecaWizard, via
// /design?template=...) já pré-preenchido — nunca um caminho de geração
// paralelo. Templates sem `receita` (ex: criados à mão antes desta rodada,
// ou de outro departamento) continuam funcionando pelo caminho antigo
// (prefill no chat do dashboard).
export default function TemplatesPainel({ clienteId, templatesIniciais }: { clienteId: string; templatesIniciais: Template[] }) {
  const [templates, setTemplates] = useState(templatesIniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

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
        .select("id, nome, descricao, department, tarefa_template, tags, vezes_usado, created_at, thumbnail_url, receita")
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
          thumbnailUrl: data.thumbnail_url as string | null,
          receita: (data.receita as Receita | null) ?? {},
        },
        ...atual,
      ]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui salvar o template agora.");
    } finally {
      setSalvando(false);
    }
  }

  async function registrarUso(template: Template) {
    // Contador é só indicativo (mostra os mais úteis primeiro) — nunca
    // bloqueia a navegação se a escrita falhar.
    await supabase
      .from("design_flows")
      .update({ vezes_usado: template.vezesUsado + 1 })
      .eq("id", template.id)
      .eq("cliente_id", clienteId);
  }

  // Receita real (Fase 3) → abre o wizard de Design já preenchido, com
  // resumo da missão antes de qualquer geração.
  async function usarTemplate(template: Template) {
    await registrarUso(template);
    const params = new URLSearchParams({ template: template.nome });
    if (template.receita.objetivo) params.set("objetivo", template.receita.objetivo);
    if (template.receita.formato) params.set("formato", template.receita.formato);
    if (template.receita.tom) params.set("tom", template.receita.tom);
    if (template.receita.oferta) params.set("oferta", template.receita.oferta);
    if (template.receita.produtoOuPessoa) params.set("produtoOuPessoa", template.receita.produtoOuPessoa);
    if (template.receita.cta) params.set("cta", template.receita.cta);
    if (template.receita.restricoes) params.set("restricoes", template.receita.restricoes);
    if (template.receita.numeroVariacoes) params.set("variacoes", String(template.receita.numeroVariacoes));
    router.push(`/design?${params.toString()}`);
  }

  // Sem receita (template legado, só tarefa_template) — caminho antigo:
  // prefill no Command Bar do dashboard.
  async function usarNoChat(template: Template) {
    await registrarUso(template);
    salvarPrefillComando(template.tarefaTemplate);
    // Navegação "dura" (não router.push) de propósito — achado real: o
    // router cache do Next.js pode reaproveitar uma instância de
    // /dashboard já montada antes nesta aba, e o lazy initializer do
    // Command Bar (que lê o prefill) só roda no mount.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination, react-hooks/immutability
    window.location.href = "/dashboard";
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 && (
          <p className="col-span-full rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
            Nenhum template ainda — guarde o primeiro acima.
          </p>
        )}
        {templates.map((t) => {
          const temReceita = Object.keys(t.receita ?? {}).length > 0;
          const gradiente = GRADIENTE_POR_DEPARTAMENTO[t.department ?? ""] ?? "from-areia/10 to-petroleo";
          return (
            <div key={t.id} className="flex flex-col overflow-hidden rounded-2xl border border-areia/10 bg-petroleo-2/60">
              <div className={`flex aspect-video items-center justify-center bg-gradient-to-br ${gradiente} p-3 text-center`}>
                {t.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnailUrl} alt={t.nome} className="size-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-areia">{t.nome}</span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-areia">{t.nome}</p>
                  {t.department && (
                    <span className="mono-label shrink-0 rounded border border-areia/15 px-1.5 py-0.5 text-[10px] text-areia/50">
                      {DEPARTAMENTOS.find((d) => d.valor === t.department)?.label ?? t.department}
                    </span>
                  )}
                </div>

                {(t.receita.objetivo ?? t.descricao) && (
                  <p className="text-xs text-areia/60">{t.receita.objetivo ?? t.descricao}</p>
                )}

                {temReceita ? (
                  <div className="space-y-1 rounded-lg bg-petroleo-3/40 p-2 text-[11px] text-areia/60">
                    {t.receita.setorRecomendado && (
                      <p>
                        <span className="text-areia/40">Setor:</span> {t.receita.setorRecomendado}
                      </p>
                    )}
                    {t.receita.formato && (
                      <p>
                        <span className="text-areia/40">Formato:</span> {t.receita.formato}
                      </p>
                    )}
                    {t.receita.exemploResultado && (
                      <p>
                        <span className="text-areia/40">Exemplo:</span> {t.receita.exemploResultado}
                      </p>
                    )}
                    {t.receita.assetsNecessarios && (
                      <p>
                        <span className="text-areia/40">Assets necessários:</span> {t.receita.assetsNecessarios}
                      </p>
                    )}
                    {typeof t.receita.numeroVariacoes === "number" && (
                      <p>
                        <span className="text-areia/40">Variações:</span> {t.receita.numeroVariacoes}
                      </p>
                    )}
                    {t.receita.etapasExecucao && t.receita.etapasExecucao.length > 0 && (
                      <p>
                        <span className="text-areia/40">Etapas:</span> {t.receita.etapasExecucao.join(" → ")}
                      </p>
                    )}
                    <p>
                      <span className="text-areia/40">Aprovação:</span>{" "}
                      {t.receita.aprovacaoNecessaria === false ? "não precisa" : "precisa aprovar antes de gerar"}
                    </p>
                  </div>
                ) : (
                  <p className="line-clamp-3 rounded-lg bg-petroleo-3/60 p-2 text-xs text-areia/60">{t.tarefaTemplate}</p>
                )}

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
                      onClick={() => (temReceita ? usarTemplate(t) : usarNoChat(t))}
                      className="mono-label rounded-lg border border-ambar/40 bg-ambar/10 px-3 py-1 text-[11px] text-ambar hover:bg-ambar/20"
                    >
                      Usar este template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
  const [aberto, setAberto] = useState(false);
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
    setAberto(false);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mono-label rounded-lg border border-menta/40 bg-menta/10 px-4 py-2 text-menta transition hover:bg-menta/20"
      >
        + Guardar um novo template
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-menta/20 bg-petroleo-2/60 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-menta">Novo template</h2>
        <button onClick={() => setAberto(false)} className="text-xs text-areia/40 hover:text-areia">
          cancelar
        </button>
      </div>
      <p className="mt-1 text-xs text-areia/50">
        Escreva o pedido exatamente como você digitaria pro Vetor — é esse texto que vai ser reaproveitado (ainda sem
        os campos guiados dos templates prontos do Vetor, isso é feito pelo time).
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
