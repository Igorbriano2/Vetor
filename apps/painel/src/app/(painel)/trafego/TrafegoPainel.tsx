"use client";

import { useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { readApiResponse } from "@/lib/api/readApiResponse";

interface Campanha {
  id: string;
  nome: string;
  status: string;
  orcamento_centavos: number | null;
  metricas: Record<string, unknown>;
  updated_at: string;
}

type Analise = {
  id: string;
  diagnostico: string | null;
  metricas_usadas: Record<string, unknown>;
  created_at: string;
} | null;

function centavosParaReais(centavos: number | null): string {
  if (centavos == null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ABAS = ["dashboard", "gestor", "conexoes"] as const;
type Aba = (typeof ABAS)[number];
const LABEL_ABA: Record<Aba, string> = { dashboard: "Dashboard", gestor: "Gestor de Tráfego", conexoes: "Conexões" };

export default function TrafegoPainel({
  campanhasIniciais,
  analiseInicial,
  contaConectada,
}: {
  campanhasIniciais: Campanha[];
  analiseInicial: Analise;
  contaConectada: boolean;
}) {
  const [aba, setAba] = useState<Aba>("dashboard");
  // Sincronizar recarrega a página inteira (idempotente, sem reconciliar
  // estado local) — campanhas/análise só precisam do valor inicial do server.
  const campanhas = campanhasIniciais;
  const analise = analiseInicial;
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function sincronizar() {
    setSincronizando(true);
    setErro(null);
    try {
      const res = await fetch("/api/trafego/sincronizar", { method: "POST" });
      if (res.status === 409) {
        setErro("Nenhuma conta de anúncios conectada ainda — conecte na aba Conexões.");
        return;
      }
      await readApiResponse(res);
      // Idempotente: refaz a leitura em vez de tentar reconciliar estado local.
      window.location.reload();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui sincronizar agora.");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex gap-2 border-b border-areia/10 pb-3">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              aba === a ? "border-menta text-menta bg-menta/10" : "border-areia/15 text-areia/60 hover:border-menta/40"
            }`}
          >
            {LABEL_ABA[a]}
          </button>
        ))}
      </div>

      {aba === "dashboard" && (
        <div className="mt-6">
          {!contaConectada ? (
            <div className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/50">
              Nenhuma conta de anúncios conectada — conecte na aba{" "}
              <button onClick={() => setAba("conexoes")} className="text-menta underline underline-offset-2">
                Conexões
              </button>{" "}
              pra ver dados reais aqui.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-areia/50">
                  {analise ? `Última sincronização: ${new Date(analise.created_at).toLocaleString("pt-BR")}` : "Ainda não sincronizado."}
                </p>
                <button
                  onClick={sincronizar}
                  disabled={sincronizando}
                  className="rounded-full bg-ambar px-4 py-1.5 text-xs font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
                >
                  {sincronizando ? "Sincronizando..." : "Sincronizar agora"}
                </button>
              </div>
              {erro && <p className="mt-2 text-xs text-coral">{erro}</p>}
              {analise?.diagnostico && (
                <p className="mt-4 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/70">
                  {analise.diagnostico}
                </p>
              )}
            </>
          )}

          <section className="mt-6">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-areia/40">Campanhas</h2>
            <div className="mt-3 space-y-3">
              {campanhas.length ? (
                campanhas.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-areia">{c.nome}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-areia/50">
                      <span>Orçamento: {centavosParaReais(c.orcamento_centavos)}</span>
                      {typeof c.metricas?.spend === "string" && <span>Gasto (30d): R$ {c.metricas.spend}</span>}
                      {typeof c.metricas?.impressions === "string" && <span>Impressões: {c.metricas.impressions}</span>}
                      {typeof c.metricas?.clicks === "string" && <span>Cliques: {c.metricas.clicks}</span>}
                      {typeof c.metricas?.ctr === "string" && <span>CTR: {c.metricas.ctr}%</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 text-sm text-areia/40">
                  Nenhuma campanha registrada ainda.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {aba === "gestor" && (
        <div className="mt-6 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4">
          <p className="text-sm text-areia/60">
            O Gestor de Tráfego é o Vetor — peça pelo{" "}
            <Link href="/vetor" className="text-menta underline underline-offset-2">
              chat principal
            </Link>{" "}
            coisas como &ldquo;crie uma campanha pro combo de sexta com R$50/dia&rdquo; ou &ldquo;o que os números
            de ontem estão dizendo?&rdquo; — o Vetor monta o plano, passa pelo Policy Engine e pede sua aprovação
            antes de qualquer ação real na conta.
          </p>
        </div>
      )}

      {aba === "conexoes" && (
        <div className="mt-6 rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4">
          <p className="text-sm text-areia/60">
            Gerencie a conexão da conta de anúncios em{" "}
            <Link href="/conexoes" className="text-menta underline underline-offset-2">
              Conexões
            </Link>
            . Status atual: <span className={contaConectada ? "text-menta" : "text-areia/40"}>{contaConectada ? "conectada" : "não conectada"}</span>.
          </p>
        </div>
      )}
    </div>
  );
}
