import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PlanejamentoPage() {
  const supabase = await createSupabaseServerClient();

  const { data: missoes } = await supabase
    .from("missions")
    .select("id, titulo, objetivo, hipotese, criterio_sucesso, status, created_at")
    .order("created_at", { ascending: false });

  const comHipotese = (missoes ?? []).filter((m) => m.hipotese);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Planejamento</h1>
        <p className="mt-2 text-sm text-areia/60">
          Hipóteses e critérios de sucesso das missões já propostas — o porquê por trás de cada ação, não só o
          calendário.
        </p>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Hipóteses em jogo
          </h2>
          <div className="mt-3 space-y-3">
            {comHipotese.length ? (
              comHipotese.map((m) => (
                <Link
                  key={m.id}
                  href={`/missoes/${m.id}`}
                  className="block rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur transition hover:border-menta/40"
                >
                  <p className="font-medium text-areia">{m.titulo}</p>
                  <p className="mt-1 text-sm text-areia/70">
                    <span className="text-areia/50">Hipótese:</span> {m.hipotese}
                  </p>
                  {Array.isArray(m.criterio_sucesso) && m.criterio_sucesso.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-areia/50">
                      {m.criterio_sucesso.map((c: string, i: number) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  )}
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                Nenhuma missão com hipótese registrada ainda — elas aparecem aqui assim que o Vetor propõe um
                plano com objetivo mensurável.
              </p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">
            Funil e calendário de mídia
          </h2>
          <p className="mt-3 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
            Ainda não há dados de funil ou calendário de campanhas — essa área fica ativa quando uma conta de
            tráfego for conectada em Tráfego.
          </p>
        </section>
      </div>
    </div>
  );
}
