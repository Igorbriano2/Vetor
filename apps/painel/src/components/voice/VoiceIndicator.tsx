"use client";

// Indicador + controles do assistente de voz — montado na sidebar, visível
// em qualquer página autenticada. Nunca reimplementa o núcleo: reusa
// VetorCore (compact) e VetorIntentCard como já existem, só traduz
// VoiceState pro vocabulário deles.

import VetorCore, { type EstadoCore } from "@/components/VetorCore";
import VetorIntentCard from "@/components/VetorIntentCard";
import VetorVoiceOverlay from "@/components/VetorVoiceOverlay";
import { useVetorVoice } from "./VetorVoiceProvider";
import type { VoiceState } from "@/lib/voice/types";

const ESTADO_CORE_POR_VOZ: Record<VoiceState, EstadoCore> = {
  disabled: "idle",
  permission_required: "idle",
  requesting_permission: "idle",
  permission_denied: "error",
  unsupported: "error",
  standby: "idle",
  wake_word_detected: "welcoming",
  listening_request: "listening",
  transcribing: "transcribing",
  thinking: "understanding",
  speaking: "speaking",
  paused_by_browser: "idle",
  error: "error",
};

// Só true nos estados em que a escuta de "vetor" está realmente rodando —
// nunca mostrar "voz ativa" fora disso (ex: durante requesting_permission ou
// erro), mesmo que o usuário já tenha ligado a voz antes.
const ESTADOS_ESCUTANDO: VoiceState[] = ["standby", "wake_word_detected", "listening_request"];

// A partir daqui o "vetor" foi detectado (ou o pedido já está sendo
// processado) — merece a atenção do usuário de verdade, não só o ponto
// discreto da sidebar. Reusa o mesmo VetorVoiceOverlay fullscreen que o
// cockpit (mic manual) já usa, pra não ter duas identidades visuais de voz
// diferentes no produto.
const ESTADOS_COM_OVERLAY: VoiceState[] = ["wake_word_detected", "listening_request", "transcribing", "thinking", "speaking"];

export default function VoiceIndicator() {
  const voz = useVetorVoice();

  if (!voz.suportado) return null; // ambiente sem getUserMedia (SSR/navegador muito antigo) — nunca mostra controle quebrado

  const escutando = ESTADOS_ESCUTANDO.includes(voz.state);
  const ligada = voz.state !== "disabled";
  const overlayAtivo = ESTADOS_COM_OVERLAY.includes(voz.state);

  return (
    <div className="space-y-2 border-t border-areia/10 pt-3">
      <VetorVoiceOverlay
        ativo={overlayAtivo}
        estado={ESTADO_CORE_POR_VOZ[voz.state]}
        amplitude={voz.amplitude || undefined}
        transcricaoParcial={voz.state === "thinking" ? "Processando sua solicitação..." : undefined}
        onParar={voz.pararTurnoAtual}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VetorCore estado={ESTADO_CORE_POR_VOZ[voz.state]} compact amplitude={voz.amplitude || undefined} />
        </div>
        {escutando && (
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="relative flex size-2 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-menta animate-core-pulse" />
              <span className="relative size-1.5 rounded-full bg-menta" />
            </span>
          </span>
        )}
      </div>

      {voz.state === "permission_denied" && (
        <p className="text-xs text-coral">Permissão de microfone negada — habilite nas configurações do navegador.</p>
      )}
      {voz.state === "unsupported" && <p className="text-xs text-coral">Ativação por voz indisponível neste navegador.</p>}
      {voz.error && <p className="text-xs text-coral">{voz.error}</p>}

      <div className="flex flex-wrap gap-2">
        {!ligada ? (
          <button
            onClick={() => void voz.ligar()}
            className="mono-label rounded-lg border border-menta/30 px-3 py-1.5 text-menta transition hover:bg-menta/10"
          >
            Ativar “diga vetor”
          </button>
        ) : (
          <>
            {voz.state === "paused_by_browser" ? (
              <button onClick={voz.retomar} className="mono-label rounded-lg border border-areia/15 px-3 py-1.5 hover:bg-areia/5">
                Retomar
              </button>
            ) : (
              <button onClick={voz.pausar} className="mono-label rounded-lg border border-areia/15 px-3 py-1.5 hover:bg-areia/5">
                Pausar
              </button>
            )}
            <button
              onClick={voz.alternarMudo}
              aria-pressed={voz.muted}
              className={`mono-label rounded-lg border px-3 py-1.5 transition ${
                voz.muted ? "border-ambar/40 text-ambar" : "border-areia/15 hover:bg-areia/5"
              }`}
            >
              {voz.muted ? "Sem áudio" : "Silenciar"}
            </button>
            <button onClick={voz.pararTurnoAtual} className="mono-label rounded-lg border border-areia/15 px-3 py-1.5 hover:bg-areia/5">
              Parar
            </button>
            <button onClick={voz.desligar} className="mono-label rounded-lg border border-coral/30 px-3 py-1.5 text-coral hover:bg-coral/10">
              Desligar
            </button>
          </>
        )}
      </div>

      {voz.lastResponseText && (
        <div className="mt-2 rounded-xl border border-areia/10 bg-petroleo/70 p-3">
          <p className="text-xs text-areia/80">{voz.lastResponseText}</p>
          {voz.lastIntent && <VetorIntentCard intent={voz.lastIntent} solicitacaoId={voz.lastSolicitacaoId ?? undefined} />}
          <button onClick={voz.limparResposta} className="mt-2 text-[11px] text-areia/40 underline underline-offset-2">
            fechar
          </button>
        </div>
      )}
    </div>
  );
}
