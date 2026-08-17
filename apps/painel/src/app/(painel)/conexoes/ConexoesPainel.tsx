"use client";

import { useState } from "react";

interface Conexao {
  provider: string;
  status: string;
  display_name: string | null;
  updated_at: string;
}

const SERVICOS: Array<{ id: string; label: string }> = [
  { id: "meta_ads", label: "Conta de anúncios" },
  { id: "meta_business", label: "Página do Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp Business" },
];

export default function ConexoesPainel({ conexoesIniciais }: { conexoesIniciais: Conexao[] }) {
  const [conexoes, setConexoes] = useState(conexoesIniciais);
  const [desconectando, setDesconectando] = useState<string | null>(null);

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

  return (
    <div className="mt-8 space-y-3">
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
