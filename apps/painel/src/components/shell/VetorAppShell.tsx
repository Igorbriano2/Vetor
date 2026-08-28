"use client";

import { usePathname } from "next/navigation";
import SidebarNav from "./SidebarNav";
import VetorVoiceProvider from "@/components/voice/VetorVoiceProvider";

export default function VetorAppShell({
  orgNome,
  userNome,
  ehAdmin = false,
  workspaceAtivoId = null,
  workspaces = [],
  children,
}: {
  orgNome?: string | null;
  userNome?: string | null;
  // Fase 8 do reset de produto — troca de workspace, só visível/funcional
  // pra admin_vetor (ver resolverClienteAtivo.ts).
  ehAdmin?: boolean;
  workspaceAtivoId?: string | null;
  workspaces?: Array<{ id: string; nome: string }>;
  children: React.ReactNode;
}) {
  // A sidebar agora é sempre um trilho de w-16 em repouso, expandindo pra
  // w-64 no hover como overlay (SidebarNav.tsx) — nunca empurra o layout,
  // então <main> reserva sempre o mesmo espaço do repouso, em toda rota
  // (antes só /vetor recolhia; a diferença de /vetor aqui é só o fundo
  // decorativo, que continua distinto por ter o próprio starfield).
  const pathname = usePathname();
  const ehVetor = pathname === "/vetor";

  return (
    // Instância única do assistente de voz por sessão — vive aqui (dentro do
    // layout autenticado, fora de qualquer página específica) pra funcionar
    // em qualquer rota e desmontar sozinha no logout (a árvore inteira sai
    // quando o layout (painel) deixa de renderizar).
    <VetorVoiceProvider>
      <div className="min-h-screen bg-petroleo text-areia">
        {/* Redesign Apple-style (fase 3) — textura ambiente do resto do
            painel; /vetor fica de fora porque já tem o próprio
            vetor-starfield (mais expressivo, não dá pra sobrepor os dois
            sem pesar visualmente). */}
        {!ehVetor && <div className="vetor-ambient" aria-hidden="true" />}
        <SidebarNav orgNome={orgNome} userNome={userNome} ehAdmin={ehAdmin} workspaceAtivoId={workspaceAtivoId} workspaces={workspaces} />
        <main className="lg:pl-16">{children}</main>
      </div>
    </VetorVoiceProvider>
  );
}
