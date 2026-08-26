"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readApiResponse } from "@/lib/api/readApiResponse";
import { ESTILOS_VISUAIS } from "@/lib/design/receitasAgencia";

interface ReferenciaOpcao {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
}

interface AssetOpcao {
  id: string;
  nome: string;
}

interface EtapaPlano {
  chave: string;
  agente: string;
  tarefa: string;
  dependeDe: string[];
  ferramentas: string[];
}

interface RespostaMissao {
  missionId: string;
  idempotente: boolean;
}

const FORMATOS = ["Feed", "Story", "Carrossel", "Capa de Reel", "Anúncio", "Outro"];
const NUMERO_DE_DIRECOES_PADRAO = 3;

type OrigemReferencia = "biblioteca" | "url" | "drive" | "nenhuma";

export interface TemplatePreFill {
  nome: string;
  objetivo?: string;
  formato?: string;
  tom?: string;
  oferta?: string;
  produtoOuPessoa?: string;
  cta?: string;
  restricoes?: string;
  estiloVisual?: string;
  numeroVariacoes?: number;
}

// Wizard em linguagem natural (Fase 1 do reset de produto) — nunca um
// formulário técnico vazio. Ao confirmar, monta um PlanoConfirmado com N
// etapas do agente "design" declarando gerar_imagem (a mesma ferramenta que
// qualquer missão de Design criada via chat já declara) e reusa o caminho
// de criação de missão já existente (POST /api/missoes →
// criarMissaoDeIntencao) — nunca um caminho paralelo. gerar_imagem é risco
// médio no Tool Registry, então a missão nasce aguardando aprovação
// automaticamente (mesmo mecanismo de sempre); a aprovação de fato acontece
// na tela da missão, ainda sem um botão dedicado aqui (isso é escopo da
// Fase 5 — "Aprovar criação de N opções").
export default function CriarPecaWizard({
  temBrandKit,
  referencias,
  assetsDrive,
  referenciaPreSelecionada,
  categoriaInicial,
  templatePreFill,
  onFechar,
}: {
  temBrandKit: boolean;
  referencias: ReferenciaOpcao[];
  assetsDrive: AssetOpcao[];
  // Chegou de /referencias ("Usar como inspiração" num item real) — já sabe
  // qual referência usar, nem sempre presente na lista curta `referencias`.
  referenciaPreSelecionada?: { id: string; nome: string };
  // Chegou de um tile de categoria curada (sem item real por trás — ver
  // CATEGORIAS_CURADAS em ReferenciasPainel.tsx) — só um hint de contexto.
  categoriaInicial?: string;
  // Chegou de /templates ("Usar este template") — Fase 3 do reset de
  // produto: pré-preenche os campos guiados, mas continua editável (o
  // cliente sempre revisa e confirma antes de gastar geração).
  templatePreFill?: TemplatePreFill;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(1);
  const [objetivo, setObjetivo] = useState(templatePreFill?.objetivo ?? "");
  const [formato, setFormato] = useState<string>(templatePreFill?.formato ?? FORMATOS[0]);
  const [origemReferencia, setOrigemReferencia] = useState<OrigemReferencia>(referenciaPreSelecionada ? "biblioteca" : "nenhuma");
  const [referenciaId, setReferenciaId] = useState(referenciaPreSelecionada?.id ?? "");
  const [referenciaUrl, setReferenciaUrl] = useState("");
  const [assetDriveId, setAssetDriveId] = useState("");
  const [tom, setTom] = useState(templatePreFill?.tom ?? "");
  const [oferta, setOferta] = useState(templatePreFill?.oferta ?? "");
  const [produtoOuPessoa, setProdutoOuPessoa] = useState(templatePreFill?.produtoOuPessoa ?? "");
  const [cta, setCta] = useState(templatePreFill?.cta ?? "");
  const [restricoes, setRestricoes] = useState(templatePreFill?.restricoes ?? "");
  const [estiloVisual, setEstiloVisual] = useState(templatePreFill?.estiloVisual ?? "");
  const numeroDeDirecoes = templatePreFill?.numeroVariacoes ?? NUMERO_DE_DIRECOES_PADRAO;

  const [status, setStatus] = useState<"formulario" | "enviando" | "confirmada" | "erro">("formulario");
  const [erro, setErro] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);

  const referenciaEscolhida = referencias.find((r) => r.id === referenciaId);
  const assetEscolhido = assetsDrive.find((a) => a.id === assetDriveId);

  function nomeDaReferencia(): string | null {
    if (origemReferencia === "biblioteca" && referenciaId === referenciaPreSelecionada?.id) return referenciaPreSelecionada.nome;
    if (origemReferencia === "biblioteca" && referenciaEscolhida) return referenciaEscolhida.title;
    if (origemReferencia === "url" && referenciaUrl.trim()) return referenciaUrl.trim();
    if (origemReferencia === "drive" && assetEscolhido) return assetEscolhido.nome;
    return null;
  }

  function contextoReferenciaParaTarefa(): string {
    const nome = nomeDaReferencia();
    if (!nome) return "";
    if (origemReferencia === "drive") {
      return ` Use como referência visual o arquivo do Drive "${nome}" (asset_ids relevante, se aplicável) — inspiração de composição/tom, nunca copiado literalmente.`;
    }
    return ` Use como referência de estilo "${nome}" — inspiração de composição/tom/ritmo, nunca copiado literalmente (texto, logo ou marca d'água de referência nunca são reproduzidos).`;
  }

  function contextoAjustesParaTarefa(): string {
    const partes: string[] = [];
    if (categoriaInicial) partes.push(`Categoria de referência: ${categoriaInicial}.`);
    if (tom.trim()) partes.push(`Tom: ${tom.trim()}.`);
    if (oferta.trim()) partes.push(`Oferta: ${oferta.trim()}.`);
    if (produtoOuPessoa.trim()) partes.push(`Produto/pessoa em destaque: ${produtoOuPessoa.trim()}.`);
    if (cta.trim()) partes.push(`CTA: ${cta.trim()}.`);
    if (restricoes.trim()) partes.push(`Restrições: ${restricoes.trim()}.`);
    // Mesmo padrão real já usado pro provider de imagem preferido — uma
    // frase no briefing que o agente de Design lê e usa pra preencher o
    // campo opcional `estilo_visual` de criar_peca_de_design (ver
    // apps/agentes/src/agents/prompts/design.md). Nunca um campo
    // estrutural novo no plano da missão.
    if (estiloVisual) partes.push(`Direção de arte preferida: ${estiloVisual}.`);
    return partes.length ? ` ${partes.join(" ")}` : "";
  }

  async function confirmar() {
    setStatus("enviando");
    setErro(null);

    const contextoBase =
      `Crie uma peça de design para divulgar: ${objetivo.trim()}. Formato: ${formato}.` +
      contextoReferenciaParaTarefa() +
      contextoAjustesParaTarefa() +
      " Use a identidade visual e o brand kit já cadastrados do cliente.";

    const etapas: EtapaPlano[] = Array.from({ length: numeroDeDirecoes }, (_, i) => ({
      chave: `direcao-${i + 1}`,
      agente: "design",
      tarefa:
        `${contextoBase} Esta é a Direção ${i + 1} de ${numeroDeDirecoes} para a mesma peça — produza uma direção ` +
        `visual DIFERENTE das outras (varie composição, paleta ou enquadramento), nunca uma cópia, pra o cliente ` +
        `poder escolher entre opções de verdade.`,
      dependeDe: [],
      ferramentas: ["criar_briefing", "gerar_imagem"],
    }));

    const plano = {
      titulo: `Design — ${objetivo.trim().slice(0, 60)}`,
      objetivo: objetivo.trim(),
      criterioSucesso: [
        `Cliente recebe ${numeroDeDirecoes} direções visuais distintas para escolher`,
        "Peça aprovada reflete o brand kit e a referência indicada (quando houver)",
      ],
      etapas,
    };

    try {
      const res = await fetch("/api/missoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const data = await readApiResponse<RespostaMissao>(res);
      setMissionId(data.missionId);
      setStatus("confirmada");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui criar a missão agora.");
      setStatus("erro");
    }
  }

  const podeAvancarPasso1 = objetivo.trim().length > 0;
  const podeAvancarPasso3 =
    origemReferencia === "nenhuma" ||
    (origemReferencia === "biblioteca" && !!referenciaId) ||
    (origemReferencia === "url" && referenciaUrl.trim().length > 0) ||
    (origemReferencia === "drive" && !!assetDriveId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-petroleo/80 p-4 backdrop-blur-sm">
      <div className="liquid-glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6">
        {status === "confirmada" && missionId ? (
          <div>
            <p className="mono-label text-menta">Missão criada</p>
            <h2 className="mt-2 text-lg font-semibold text-areia">
              Vou preparar {numeroDeDirecoes} direções visuais e avisar quando estiverem prontas pra sua aprovação.
            </h2>
            <p className="mt-2 text-sm text-areia/60">
              Como é uma peça final (não só briefing), a criação precisa da sua aprovação antes de gerar de verdade —
              acompanhe e aprove na tela da missão.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link
                href={`/missoes/${missionId}`}
                className="rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
              >
                Acompanhar e aprovar
              </Link>
              <button onClick={onFechar} className="text-sm text-areia/50 hover:text-areia">
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="mono-label text-areia/40">Criar uma nova peça — passo {Math.min(passo, 4)} de 4</p>
              <button onClick={onFechar} className="text-areia/40 hover:text-areia" aria-label="Fechar">
                ✕
              </button>
            </div>

            {passo === 1 && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold text-areia">O que você quer divulgar?</h2>
                {templatePreFill && (
                  <p className="mt-1 text-xs text-areia/40">Template: {templatePreFill.nome} — revise e ajuste o que quiser antes de confirmar.</p>
                )}
                {categoriaInicial && (
                  <p className="mt-1 text-xs text-areia/40">Categoria escolhida: {categoriaInicial}</p>
                )}
                <textarea
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  placeholder={
                    categoriaInicial
                      ? `Ex: um(a) ${categoriaInicial.toLowerCase()} sobre...`
                      : 'Ex: "Promoção de combo de dogs pra Black Friday"'
                  }
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-areia/15 bg-petroleo px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
                />
              </div>
            )}

            {passo === 2 && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold text-areia">Para onde é a peça?</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FORMATOS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormato(f)}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        formato === f ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/70 hover:border-menta/40"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {passo === 3 && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold text-areia">Existe alguma referência?</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["nenhuma", "Continuar sem referência"],
                      ["biblioteca", "Escolher da biblioteca"],
                      ["url", "Colar URL"],
                      ["drive", "Escolher do Drive"],
                    ] as Array<[OrigemReferencia, string]>
                  ).map(([valor, label]) => (
                    <button
                      key={valor}
                      onClick={() => setOrigemReferencia(valor)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        origemReferencia === valor ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/70 hover:border-menta/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {origemReferencia === "biblioteca" && (
                  <div className="mt-3 space-y-2">
                    {referenciaPreSelecionada && referenciaId === referenciaPreSelecionada.id && (
                      <p className="rounded-xl border border-menta/30 bg-menta/10 px-3 py-2 text-sm text-areia">
                        Selecionada: <strong>{referenciaPreSelecionada.nome}</strong>
                      </p>
                    )}
                    {referencias.length === 0 && !referenciaPreSelecionada && (
                      <p className="text-xs text-areia/40">
                        Sua biblioteca ainda não tem referências salvas —{" "}
                        <Link href="/referencias" className="text-menta hover:underline">
                          adicionar uma
                        </Link>
                        .
                      </p>
                    )}
                    {referencias.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setReferenciaId(r.id)}
                        className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                          referenciaId === r.id ? "border-menta bg-menta/10 text-areia" : "border-areia/10 bg-petroleo text-areia/70 hover:border-menta/30"
                        }`}
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                )}

                {origemReferencia === "url" && (
                  <input
                    value={referenciaUrl}
                    onChange={(e) => setReferenciaUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-3 w-full rounded-xl border border-areia/15 bg-petroleo px-4 py-2.5 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
                  />
                )}

                {origemReferencia === "drive" && (
                  <div className="mt-3 space-y-2">
                    {assetsDrive.length === 0 && <p className="text-xs text-areia/40">Nenhum arquivo aprovado no Drive ainda.</p>}
                    {assetsDrive.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setAssetDriveId(a.id)}
                        className={`block w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                          assetDriveId === a.id ? "border-menta bg-menta/10 text-areia" : "border-areia/10 bg-petroleo text-areia/70 hover:border-menta/30"
                        }`}
                      >
                        {a.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {passo === 4 && (
              <div className="mt-4 space-y-3">
                <h2 className="text-lg font-semibold text-areia">O que precisa ser diferente?</h2>
                <p className="text-xs text-areia/40">Tudo aqui é opcional — preencha só o que fizer diferença.</p>
                <CampoCurto label="Tom" value={tom} onChange={setTom} placeholder="Ex: divertido, premium, urgente..." />
                <CampoCurto label="Oferta" value={oferta} onChange={setOferta} placeholder="Ex: 20% off, combo, frete grátis..." />
                <CampoCurto label="Produto ou pessoa" value={produtoOuPessoa} onChange={setProdutoOuPessoa} placeholder="Ex: hot dog especial, foto da equipe..." />
                <CampoCurto label="CTA" value={cta} onChange={setCta} placeholder='Ex: "Peça já pelo WhatsApp"' />
                <CampoCurto label="Restrições" value={restricoes} onChange={setRestricoes} placeholder="Ex: sem preço na arte, sem pessoas..." />
                <div>
                  <span className="mono-label text-areia/40">Estilo visual</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEstiloVisual("")}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        estiloVisual === "" ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/70 hover:border-menta/40"
                      }`}
                    >
                      Deixar o Vetor decidir
                    </button>
                    {ESTILOS_VISUAIS.map((e) => (
                      <button
                        key={e.valor}
                        type="button"
                        onClick={() => setEstiloVisual(e.valor)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          estiloVisual === e.valor ? "border-menta bg-menta/10 text-menta" : "border-areia/15 text-areia/70 hover:border-menta/40"
                        }`}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {passo === 5 && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold text-areia">Confirmar</h2>
                <p className="mt-3 rounded-xl border border-areia/10 bg-petroleo p-4 text-sm text-areia/80">
                  Vou criar <strong className="text-areia">{numeroDeDirecoes} direções visuais</strong> para{" "}
                  <strong className="text-areia">{objetivo.trim() || "essa peça"}</strong> ({formato}), usando a identidade{" "}
                  {temBrandKit ? "cadastrada da marca" : "padrão (nenhum brand kit cadastrado ainda)"}
                  {nomeDaReferencia() ? (
                    <>
                      {" "}
                      e a referência <strong className="text-areia">&ldquo;{nomeDaReferencia()}&rdquo;</strong>
                    </>
                  ) : (
                    ""
                  )}
                  . Você vai poder escolher uma e editar as camadas antes da entrega.
                </p>
                <p className="mt-3 text-xs text-areia/40">
                  Como é uma peça final (custo real por geração), a criação só roda depois que você aprovar — nada é
                  gerado automaticamente.
                </p>
                {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setPasso((p) => Math.max(1, p - 1))}
                disabled={passo === 1 || status === "enviando"}
                className="text-sm text-areia/50 hover:text-areia disabled:opacity-0"
              >
                ← Voltar
              </button>
              {passo < 5 ? (
                <button
                  onClick={() => setPasso((p) => p + 1)}
                  disabled={(passo === 1 && !podeAvancarPasso1) || (passo === 3 && !podeAvancarPasso3)}
                  className="rounded-full bg-ambar px-5 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
                >
                  Continuar
                </button>
              ) : (
                <button
                  onClick={confirmar}
                  disabled={status === "enviando"}
                  className="rounded-full bg-ambar px-5 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
                >
                  {status === "enviando" ? "Criando..." : "Confirmar e criar"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CampoCurto({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mono-label text-areia/40">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-areia/15 bg-petroleo px-3 py-2 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
      />
    </label>
  );
}
