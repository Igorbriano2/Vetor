import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolverClienteAtivo } from "@/lib/workspace/resolverClienteAtivo";
import { buscarArtefatos, buscarVideosFinalizados } from "@/lib/artifacts/fetchArtifacts";
import { agruparPorCampanha } from "@/lib/artifacts/agruparPorCampanha";
import { AreaIconBadge, ÍCONE_POR_HREF } from "@/components/ui/areaIcons";
import CriacoesGaleria from "./CriacoesGaleria";

const ENTRADAS = [
  { href: "/design", titulo: "Criar uma peça", descricao: "Wizard guiado ou canvas de nós — objetivo, formato, referência e ajustes." },
  { href: "/videomaker/editor", titulo: "Criar um vídeo", descricao: "Envie um arquivo de origem e monte a timeline." },
  { href: "/referencias", titulo: "Usar uma referência", descricao: "Biblioteca curada + suas próprias referências." },
  { href: "/templates", titulo: "Usar uma receita", descricao: "Templates prontos de agência, já com os campos guiados." },
  { href: "/entregas", titulo: "Ver entregas", descricao: "Tudo já entregue, organizado por campanha." },
] as const;

// Fase 3 do Vetor Manager (área "Criações") — hub único de entrada pra
// Design/Videomaker/Referências/Templates/Entregas. Não substitui nenhuma
// dessas páginas (cada uma continua existindo e é reaproveitada como
// destino de link ou como fonte de dado), só unifica onde o cliente chega
// primeiro quando quer criar ou revisar algo visual.
//
// Reorganização de menus (achado ao vivo, 2 rodadas): 1ª — a galeria de "em
// produção"/"com falha" daqui duplicava o que já mora nos workspaces de
// /design e /videomaker, removida. 2ª (esta) — Criações tinha DOIS pontos
// de entrada pra criar algo (esta grade + o botão "+Novo projeto" com um
// modal próprio) e o Design tinha um TERCEIRO (linha de atalhos pra
// referência/template/campanha), tudo se sobrepondo. Agora só existe um:
// esta grade decide o DEPARTAMENTO (Design/Vídeo/Referência/Receita/
// Entregas); uma vez dentro do departamento, ele decide COMO criar (ex:
// Design oferece wizard ou canvas). Criações nunca mais é "o lugar onde o
// trabalho acontece", só o hub + a biblioteca do que já foi feito.
export default async function CriacoesPage() {
  const supabase = await createSupabaseServerClient();
  const ativo = await resolverClienteAtivo(supabase);

  if (!ativo.clienteId) {
    return <div className="px-6 py-10 text-sm text-coral">Seu usuário ainda não está vinculado a um cliente.</div>;
  }
  const clienteId = ativo.clienteId;

  const [artefatos, videosFinalizados] = await Promise.all([
    buscarArtefatos(supabase, { departamentos: ["design", "videomaker", "conteudo"], clienteId }),
    buscarVideosFinalizados(supabase),
  ]);
  const todosArtefatos = [...artefatos, ...videosFinalizados];

  const missionIds = Array.from(new Set(todosArtefatos.map((a) => a.missionId).filter((id): id is string => !!id)));
  const { data: missoesBrutas } = missionIds.length
    ? await supabase.from("missions").select("id, objetivo, status, created_at").eq("cliente_id", clienteId).in("id", missionIds)
    : { data: [] };

  const campanhas = agruparPorCampanha(
    todosArtefatos,
    (missoesBrutas ?? []).map((m) => ({
      id: m.id as string,
      objetivo: m.objetivo as string | null,
      status: m.status as string | null,
      createdAt: m.created_at as string,
    })),
  );

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <AreaIconBadge href="/criacoes" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-areia/40">VETOR / CRIAÇÕES</p>
            <h1 className="text-2xl font-bold text-areia">Criações</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-areia/60">Tudo o que o VETOR produz para sua marca. Escolha onde criar, ou navegue pelo que já foi feito abaixo.</p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ENTRADAS.map((e, i) => {
            // Hierarquia visual (referência: Gravyx) — um único card em
            // destaque (o atalho mais usado, "Criar uma peça"), nunca mais
            // de um por tela, senão a hierarquia se perde.
            const destaque = i === 0;
            return (
              <Link
                key={e.href}
                href={e.href}
                className={`relative rounded-2xl card-lift p-4 ${destaque ? "hero-card" : "panel"}`}
              >
                <span
                  className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl ${
                    destaque ? "border border-areia/30 bg-areia/15 text-areia" : "border border-menta/25 bg-menta/10 text-menta"
                  }`}
                >
                  {ÍCONE_POR_HREF[e.href]}
                </span>
                <p className={`relative mt-3 font-medium ${destaque ? "text-areia" : "text-areia"}`}>{e.titulo}</p>
                <p className={`relative mt-1 text-xs ${destaque ? "text-areia/80" : "text-areia/50"}`}>{e.descricao}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-10">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">Biblioteca visual</h2>
          <div className="mt-3">
            <CriacoesGaleria artefatos={todosArtefatos} campanhas={campanhas} />
          </div>
        </div>
      </div>
    </div>
  );
}
