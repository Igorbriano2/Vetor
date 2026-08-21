"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import ArtifactLibrary from "@/components/ArtifactLibrary";
import type { ArtefatoBiblioteca } from "@/lib/artifacts/fetchArtifacts";
import CriarPecaWizard, { type TemplatePreFill } from "./CriarPecaWizard";

interface EtapaEmAndamento {
  id: string;
  tarefa: string;
  status: string;
  missionId: string;
  missionTitulo: string;
}

interface Campanha {
  id: string;
  titulo: string;
  status: string;
  contagem: { total: number; aprovacao: number; concluidas: number };
}

interface Projeto {
  id: string;
  title: string;
  version: number;
  status: string;
  thumbnailUrl: string | null;
  missionId: string | null;
  missionTitulo: string | null;
}

interface ReferenciaPreview {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
}

// Fase 1 do reset de produto — primeira dobra do departamento de Design:
// entrada por intenção, trabalho em andamento, campanhas, projetos recentes
// e biblioteca visual. Ver docs/PRODUCT-RESET-AUDIT.md.
export default function DesignCommandCenter({
  temBrandKit,
  etapasEmAndamento,
  campanhas,
  projetos,
  artefatos,
  referencias,
  assetsDrive,
}: {
  temBrandKit: boolean;
  etapasEmAndamento: EtapaEmAndamento[];
  campanhas: Campanha[];
  projetos: Projeto[];
  artefatos: ArtefatoBiblioteca[];
  referencias: ReferenciaPreview[];
  assetsDrive: Array<{ id: string; nome: string }>;
}) {
  const [wizardAberto, setWizardAberto] = useState(false);
  const [referenciaPreSelecionada, setReferenciaPreSelecionada] = useState<{ id: string; nome: string } | undefined>(undefined);
  const [categoriaInicial, setCategoriaInicial] = useState<string | undefined>(undefined);
  const [templatePreFill, setTemplatePreFill] = useState<TemplatePreFill | undefined>(undefined);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Chegando de /referencias ("Usar como inspiração" num item real ou num
  // tile de categoria curada) ou de /templates ("Usar este template") —
  // abre o wizard já com esse contexto, e limpa a query string pra não
  // reabrir num refresh/voltar.
  useEffect(() => {
    const referenciaId = searchParams.get("referencia");
    const referenciaNome = searchParams.get("nome");
    const categoria = searchParams.get("categoria");
    const templateNome = searchParams.get("template");
    if (referenciaId && referenciaNome) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReferenciaPreSelecionada({ id: referenciaId, nome: referenciaNome });
      setWizardAberto(true);
      router.replace("/design");
    } else if (categoria) {
      setCategoriaInicial(categoria);
      setWizardAberto(true);
      router.replace("/design");
    } else if (templateNome) {
      const numeroVariacoes = Number(searchParams.get("variacoes"));
      setTemplatePreFill({
        nome: templateNome,
        objetivo: searchParams.get("objetivo") ?? undefined,
        formato: searchParams.get("formato") ?? undefined,
        tom: searchParams.get("tom") ?? undefined,
        oferta: searchParams.get("oferta") ?? undefined,
        produtoOuPessoa: searchParams.get("produtoOuPessoa") ?? undefined,
        cta: searchParams.get("cta") ?? undefined,
        restricoes: searchParams.get("restricoes") ?? undefined,
        estiloVisual: searchParams.get("estiloVisual") ?? undefined,
        numeroVariacoes: Number.isFinite(numeroVariacoes) && numeroVariacoes > 0 ? numeroVariacoes : undefined,
      });
      setWizardAberto(true);
      router.replace("/design");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Design</h1>
        <p className="mt-2 max-w-2xl text-sm text-areia/60">
          O departamento de criação do Vetor. Peça uma peça nova, se inspire numa referência, reaproveite um template
          ou acompanhe uma campanha em andamento — tudo aqui.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setWizardAberto(true)}
            className="rounded-full bg-ambar px-5 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
          >
            + Criar uma nova peça
          </button>
          <Link
            href="/referencias"
            className="rounded-full border border-areia/15 px-5 py-2.5 text-sm text-areia/80 transition hover:border-menta/40 hover:text-menta"
          >
            Escolher uma referência
          </Link>
          <Link
            href="/templates"
            className="rounded-full border border-areia/15 px-5 py-2.5 text-sm text-areia/80 transition hover:border-menta/40 hover:text-menta"
          >
            Usar um template
          </Link>
          <Link
            href="/planejamento"
            className="rounded-full border border-areia/15 px-5 py-2.5 text-sm text-areia/80 transition hover:border-menta/40 hover:text-menta"
          >
            Abrir uma campanha
          </Link>
        </div>

        {etapasEmAndamento.length > 0 && (
          <section className="mt-10">
            <p className="mono-label mb-3 text-areia/50">Trabalhando agora</p>
            <div className="space-y-2">
              {etapasEmAndamento.map((e) => (
                <Link
                  key={e.id}
                  href={`/missoes/${e.missionId}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur transition hover:border-menta/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-areia">{e.tarefa}</p>
                    <p className="mt-0.5 text-xs text-areia/40">{e.missionTitulo}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Minhas campanhas</p>
          {campanhas.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campanhas.map((c) => (
                <Link
                  key={c.id}
                  href={`/missoes/${c.id}`}
                  className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur transition hover:border-menta/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-areia">{c.titulo}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-2 text-xs text-areia/40">
                    {c.contagem.total} {c.contagem.total === 1 ? "peça" : "peças"}
                    {c.contagem.aprovacao > 0 && ` · ${c.contagem.aprovacao} aguardando aprovação`}
                    {c.contagem.concluidas > 0 && ` · ${c.contagem.concluidas} concluída${c.contagem.concluidas === 1 ? "" : "s"}`}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
              Nenhuma campanha de Design ainda — crie uma peça nova ou abra o Planejamento pra gerar as peças de um
              calendário.
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Projetos recentes</p>
          {projetos.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {projetos.map((p) => (
                <Link
                  key={p.id}
                  href={`/design/editor/${p.id}`}
                  className="group overflow-hidden rounded-xl border border-areia/10 bg-petroleo-2/60 transition hover:border-menta/40"
                >
                  <div className="flex aspect-square items-center justify-center bg-petroleo">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt={p.title} className="size-full object-cover" />
                    ) : (
                      <span className="px-3 text-center text-xs text-areia/30">Briefing aguardando criação</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs text-areia">{p.title}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-areia/40">v{p.version}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    {p.missionId && <p className="mt-0.5 truncate font-mono text-[10px] text-areia/30">{p.missionTitulo}</p>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
              Nenhum projeto editável ainda — crie sua primeira peça acima.
            </p>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <p className="mono-label text-areia/50">Biblioteca visual</p>
            <Link href="/referencias" className="text-xs text-menta hover:underline">
              ver tudo
            </Link>
          </div>
          {referencias.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {referencias.map((r) => (
                <div key={r.id} className="rounded-xl border border-areia/10 bg-petroleo-2/60 p-3">
                  <p className="truncate text-xs font-medium text-areia">{r.title}</p>
                  {r.description && <p className="mt-1 line-clamp-2 text-[11px] text-areia/40">{r.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
              Você ainda não tem referências salvas —{" "}
              <Link href="/referencias" className="text-menta hover:underline">
                comece adicionando uma
              </Link>
              .
            </p>
          )}
        </section>

        <section className="mt-10">
          <p className="mono-label mb-3 text-areia/50">Entregas</p>
          <ArtifactLibrary artefatos={artefatos} vazio="Nenhuma peça de design entregue ainda." />
        </section>
      </div>

      {wizardAberto && (
        <CriarPecaWizard
          temBrandKit={temBrandKit}
          referencias={referencias}
          assetsDrive={assetsDrive}
          referenciaPreSelecionada={referenciaPreSelecionada}
          categoriaInicial={categoriaInicial}
          templatePreFill={templatePreFill}
          onFechar={() => {
            setWizardAberto(false);
            setReferenciaPreSelecionada(undefined);
            setCategoriaInicial(undefined);
            setTemplatePreFill(undefined);
          }}
        />
      )}
    </div>
  );
}
