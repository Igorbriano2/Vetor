import Link from "next/link";
import StatusBadge from "./StatusBadge";
import type { ArtefatoBiblioteca } from "@/lib/artifacts/fetchArtifacts";
import { rotuloDoPlaceholder, LABEL_TIPO } from "@/lib/campanha/rotuloDePeca";

// Força download real mesmo cross-origin (o atributo `download` do <a>
// sozinho é ignorado pelo navegador em recursos de outra origem, e a URL
// assinada do Supabase Storage é sempre de outra origem). Supabase Storage
// reconhece esse parâmetro de query em qualquer URL assinada — mesmo
// efeito de createSignedUrl(path, exp, { download: true }), sem precisar
// gerar uma segunda URL assinada só pra isso. URLs externas (ex:
// Higgsfield, storage_provider "external") não têm "token=" — o link cai
// pro comportamento normal (abre a URL real, nunca finge suporte a
// download que o provider externo não tem).
function comDownloadForcado(url: string): string {
  if (!url.includes("token=")) return url;
  return url.includes("?") ? `${url}&download=` : `${url}?download=`;
}

// Biblioteca visual reutilizada por Design/Videomaker/Entregas — mesma
// lógica de card (thumbnail/preview, tipo, data, origem, status, ação),
// só a query de artefatos que muda por página (ver fetchArtifacts).
export default function ArtifactLibrary({
  artefatos,
  vazio,
}: {
  artefatos: ArtefatoBiblioteca[];
  vazio: string;
}) {
  if (artefatos.length === 0) {
    return <p className="rounded-2xl panel p-4 text-sm text-areia/40">{vazio}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {artefatos.map((a, i) => (
        <div
          key={a.id}
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          className="card-lift fade-in-up flex flex-col overflow-hidden rounded-2xl panel"
        >
          {a.type === "image" && a.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt={a.title} className="h-48 w-full object-cover" />
          )}
          {a.type === "video" && a.url && <video src={a.url} className="h-48 w-full object-cover" muted />}
          {!(a.url && (a.type === "image" || a.type === "video")) && (
            <div className="flex h-48 w-full items-center justify-center bg-petroleo/60 font-mono text-[10px] uppercase tracking-wide text-areia/30">
              {/* Fase 2 do Vetor Manager UX — nunca finge um preview que não
                  existe, mas também nunca deixa um estado em andamento
                  parecer indistinguível de "nunca foi gerado" — texto muda
                  conforme o status real da peça. */}
              {rotuloDoPlaceholder(a.status, a.type)}
            </div>
          )}

          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-areia/40">{LABEL_TIPO[a.type] ?? a.type}</span>
              <StatusBadge status={a.status === "ready" ? "concluida" : a.status} />
            </div>
            <p className="text-sm font-medium text-areia">{a.title}</p>
            {a.content && <p className="line-clamp-2 text-xs text-areia/50">{a.content}</p>}
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              <span className="font-mono text-[10px] text-areia/30">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</span>
              <div className="flex items-center gap-3">
                {a.missionId && (
                  <Link href={`/missoes/${a.missionId}`} className="font-mono text-[11px] text-areia/50 hover:text-menta">
                    missão
                  </Link>
                )}
                {a.designProjectId && (
                  <Link
                    href={`/design/editor/${a.designProjectId}`}
                    className="font-mono text-[11px] text-menta underline underline-offset-2 hover:text-menta-forte"
                  >
                    editar
                  </Link>
                )}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-menta underline underline-offset-2 hover:text-menta-forte"
                  >
                    abrir
                  </a>
                )}
                {a.url && (a.type === "image" || a.type === "video") && (
                  <a
                    href={comDownloadForcado(a.url)}
                    download
                    className="font-mono text-[11px] text-menta underline underline-offset-2 hover:text-menta-forte"
                  >
                    baixar
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
