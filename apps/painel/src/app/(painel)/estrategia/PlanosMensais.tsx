import Link from "next/link";
import GerarPecasCampanha from "@/components/GerarPecasCampanha";

interface CalendarioItem {
  data: string;
  titulo: string;
  canal?: string;
  tipo?: string;
}

export interface PlanoMensal {
  id: string;
  title: string;
  mission_id: string | null;
  created_at: string;
  metadata: {
    content?: string;
    periodo?: string;
    calendario?: CalendarioItem[];
    indicadores?: string[];
  } | null;
}

// Absorvido de /planejamento (reorganização de menus) — planos mensais
// (artifacts type=plan, sem metadata.formato="rota_estrategica", que fica
// na seção "Rotas estratégicas entregues" logo acima nesta mesma página).
export default function PlanosMensais({ planos }: { planos: PlanoMensal[] }) {
  if (planos.length === 0) {
    return (
      <p className="rounded-2xl panel p-4 text-sm text-areia/40">
        Nenhum planejamento mensal ainda — peça pro Vetor no chat.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {planos.map((p) => {
        const meta = p.metadata ?? {};
        const calendario = Array.isArray(meta.calendario) ? meta.calendario : [];

        return (
          <div key={p.id} className="rounded-2xl panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-areia">{p.title}</p>
              {meta.periodo && (
                <span className="font-mono text-[10px] uppercase tracking-wide text-ambar">{meta.periodo}</span>
              )}
            </div>
            {meta.content && <p className="mt-2 whitespace-pre-wrap text-sm text-areia/70">{meta.content}</p>}

            {calendario.length > 0 && (
              <GerarPecasCampanha tituloPlano={p.title} periodo={meta.periodo} calendario={calendario} />
            )}

            {Array.isArray(meta.indicadores) && meta.indicadores.length > 0 && (
              <div className="mt-3">
                <p className="mono-label">Indicadores sugeridos</p>
                <ul className="mt-1 space-y-0.5 text-xs text-areia/60">
                  {meta.indicadores.map((ind, i) => (
                    <li key={i}>• {ind}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-areia/30">
              <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
              {p.mission_id && (
                <Link href={`/missoes/${p.mission_id}`} className="text-menta hover:underline">
                  ver missão
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
