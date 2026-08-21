"use client";

import { useState } from "react";
import NovoProjetoModal from "./NovoProjetoModal";

export default function NovoProjetoBotao({ clienteId }: { clienteId: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-full bg-ambar px-4 py-2 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
      >
        + Novo projeto
      </button>
      {aberto && <NovoProjetoModal clienteId={clienteId} onFechar={() => setAberto(false)} />}
    </>
  );
}
