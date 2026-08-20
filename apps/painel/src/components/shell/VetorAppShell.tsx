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
  return (
    // Instância única do assistente de voz por sessão — vive aqui (dentro do
    // layout autenticado, fora de qualquer página específica) pra funcionar
    // em qualquer rota e desmontar sozinha no logout (a árvore inteira sai
    // quando o layout (painel) deixa de renderizar).
    <VetorVoiceProvider>
      <div className="min-h-screen bg-petroleo text-areia">
        <SidebarNav orgNome={orgNome} userNome={userNome} ehAdmin={ehAdmin} workspaceAtivoId={workspaceAtivoId} workspaces={workspaces} />
        <main className="lg:pl-64">{children}</main>
      </div>
    </VetorVoiceProvider>
  );
}
