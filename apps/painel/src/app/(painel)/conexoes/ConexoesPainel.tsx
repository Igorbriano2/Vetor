"use client";

import { useEffect, useState } from "react";

interface Conexao {
  provider: string;
  status: string;
  display_name: string | null;
  updated_at: string;
}

interface ConexaoPendente {
  id: string;
  provider: string;
  display_name: string | null;
  external_account_id: string | null;
}

const SERVICOS: Array<{ id: string; label: string }> = [
  { id: "meta_ads", label: "Conta de anúncios" },
  { id: "meta_business", label: "Página do Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp Business" },
];

const LABEL_PROVIDER: Record<string, string> = Object.fromEntries(SERVICOS.map((s) => [s.id, s.label]));

export default function ConexoesPainel({ conexoesIniciais }: { conexoesIniciais: Conexao[] }) {
  const [conexoes, setConexoes] = useState(conexoesIniciais);
  const [desconectando, setDesconectando] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<ConexaoPendente[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    fetch("/api/connections/pendentes")
      .then((res) => (res.ok ? res.json() : { pendentes: [] }))
      .then((corpo: { pendentes?: ConexaoPendente[] }) => {
        const lista = corpo.pendentes ?? [];
        setPendentes(lista);
        setSelecionados(new Set(lista.map((p) => p.id)));
      })
      .catch(() => setPendentes([]));
  }, []);

  async function desconectar(provider: string) {
    setDesconectando(provider);
    try {
      const res = await fetch(`/api/connections/${provider}/disconnect`, { method: "POST" });
      if (res.ok) {
        setConexoes((atual) => atual.map((c) => (c.provider === provider ? { ...c, status: "revoked" } : c)));
      }
    } finally {
      setDesconectando(null);
    }
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function confirmarSelecao() {
    setConfirmando(true);
    try {
      const res = await fetch("/api/connections/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selecionados) }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="mt-8 space-y-3">
      {pendentes && pendentes.length > 0 && (
        <div className="rounded-2xl border border-ambar/30 bg-ambar/5 p-5">
          <p className="text-sm font-semibold text-ambar">Confirme quais contas são deste negócio</p>
          <p className="mt-1 text-xs text-areia/60">
            O login da Meta trouxe {pendentes.length} conta(s)/página(s) que essa conta administra. Marque só as que
            pertencem a este negócio — as demais são descartadas, não ficam vinculadas a este workspace.
          </p>

          <div className="mt-4 space-y-2">
            {pendentes.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-areia/10 bg-petroleo-2/60 p-3 text-sm text-areia"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(p.id)}
                  onChange={() => alternarSelecao(p.id)}
                  className="h-4 w-4 accent-ambar"
                />
                <span className="font-mono text-[10px] uppercase tracking-wide text-areia/40">
                  {LABEL_PROVIDER[p.provider] ?? p.provider}
                </span>
                <span className="flex-1">{p.display_name ?? p.external_account_id ?? "sem nome"}</span>
              </label>
            ))}
          </div>

          <button
            onClick={confirmarSelecao}
            disabled={confirmando}
            className="mt-4 rounded-full bg-ambar px-5 py-2 text-xs font-semibold text-petroleo disabled:opacity-50"
          >
            {confirmando
              ? "Confirmando..."
              : selecionados.size === 0
                ? "Descartar todas"
                : `Confirmar ${selecionados.size} selecionada(s)`}
          </button>
        </div>
      )}

      <a
        href="/api/connections/facebook/start"
        className="block rounded-xl border border-ambar/30 bg-ambar/10 p-4 text-center text-sm font-semibold text-ambar transition hover:bg-ambar/20"
      >
        Conectar com a Meta
      </a>

      {SERVICOS.map(({ id, label }) => {
        const conexao = conexoes.find((c) => c.provider === id && c.status === "connected");
        return (
          <div key={id} className="flex items-center justify-between rounded-2xl border border-areia/10 bg-petroleo-2/60 p-4 backdrop-blur">
            <div>
              <p className="text-sm font-medium text-areia">{label}</p>
              {conexao ? (
                <p className="mt-1 text-xs text-areia/40">
                  {conexao.display_name ?? "conectado"} · desde {new Date(conexao.updated_at).toLocaleDateString("pt-BR")}
                </p>
              ) : (
                <p className="mt-1 text-xs text-areia/30">não conectado</p>
              )}
            </div>
            {conexao ? (
              <button
                onClick={() => desconectar(id)}
                disabled={desconectando === id}
                className="rounded-full border border-coral/40 px-4 py-1.5 text-xs font-medium text-coral transition hover:bg-coral/10 disabled:opacity-50"
              >
                {desconectando === id ? "Desconectando..." : "Desconectar"}
              </button>
            ) : (
              <span className="font-mono text-[11px] text-areia/30">não conectado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
