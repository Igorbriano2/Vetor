"use client";

import { useEffect, useState } from "react";

interface Voz {
  id: string;
  nome: string;
  idioma: string;
  genero: string | null;
  sotaque: string | null;
  preview_url: string | null;
}

const LIMITE_LOCUTORES = 2;

// "Biblioteca de vozes" (Módulo 3 do prompt-mestre) — grade com busca por
// idioma (Português-BR sempre primeiro na lista, ver seed em
// docs/relatorio-manha.md), até 2 locutores por geração (diálogo).
export default function VoicePicker({ selecionadas, onChange }: { selecionadas: string[]; onChange: (ids: string[]) => void }) {
  const [vozes, setVozes] = useState<Voz[]>([]);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetch("/api/ai-suite/voices")
      .then((r) => r.json())
      .then((data) => setVozes(data.voices ?? []));
  }, []);

  function alternar(id: string) {
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((s) => s !== id));
    } else if (selecionadas.length < LIMITE_LOCUTORES) {
      onChange([...selecionadas, id]);
    }
  }

  // pt-BR sempre primeiro, mesmo depois de um filtro de busca.
  const filtradas = vozes
    .filter((v) => (v.nome + v.sotaque).toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (a.idioma === "pt-BR" ? -1 : 1) - (b.idioma === "pt-BR" ? -1 : 1));

  const nomesSelecionados = vozes.filter((v) => selecionadas.includes(v.id)).map((v) => v.nome);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="mono-label text-areia/50">Locutor{selecionadas.length > 1 ? "es" : ""}</p>
        <button type="button" onClick={() => setAberto((v) => !v)} className="text-xs text-menta hover:underline">
          {aberto ? "Fechar" : "Escolher voz"}
        </button>
      </div>
      <p className="mt-1 text-sm text-areia">{nomesSelecionados.length > 0 ? nomesSelecionados.join(" + ") : "Nenhuma voz escolhida"}</p>

      {aberto && (
        <div className="mt-2 rounded-xl border border-areia/10 p-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou sotaque..."
            className="mb-2 w-full rounded-lg border border-areia/15 bg-petroleo-2 p-2 text-xs text-areia placeholder:text-areia/30 focus:border-menta/50 focus:outline-none"
          />
          <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto">
            {filtradas.map((v) => {
              const marcado = selecionadas.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => alternar(v.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                    marcado ? "border-menta/50 bg-menta/10" : "border-areia/10 hover:border-areia/25"
                  }`}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-petroleo-2 text-[10px] text-areia/60">{v.nome[0]}</span>
                  <span className="min-w-0">
                    <p className="truncate text-xs text-areia">{v.nome}</p>
                    <p className="truncate text-[10px] text-areia/40">
                      {v.idioma}
                      {v.sotaque ? ` · ${v.sotaque}` : ""}
                    </p>
                  </span>
                </button>
              );
            })}
          </div>
          {selecionadas.length >= LIMITE_LOCUTORES && <p className="mt-1.5 text-[10px] text-areia/40">Máximo de {LIMITE_LOCUTORES} locutores (diálogo).</p>}
        </div>
      )}
    </div>
  );
}
