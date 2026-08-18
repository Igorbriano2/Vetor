// Modelo de timeline de vídeo — tipos puros (sem I/O), espelham a spec.
// Referência arquitetural (nunca código copiado): estrutura de "documento
// portátil com tracks/clips/keyframes" inspirada no formato .timeline do
// projeto Timeline Studio (MIT, ex-ai-video-editor) e no par
// TimelineDocument/track do @twick/timeline (SUL — licença compatível com
// bundle comercial, ver relatório de auditoria). Nenhuma linha destes dois
// projetos foi copiada; só o VOCABULÁRIO do modelo (track/clip/keyframe/
// transição) é comum porque é o vocabulário padrão do domínio de edição não
// destrutiva, não uma cópia de implementação.

export type TrackKind = "video" | "image" | "audio" | "captions" | "voiceover" | "effects";

export interface Keyframe {
  atMs: number;
  properties: Record<string, number | string>;
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut";
}

export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
}

export interface ClipTransition {
  type: "cut" | "fade" | "wipe" | "slide" | "dissolve";
  durationMs: number;
}

export interface Clip {
  // Estável entre versões da timeline — nunca regenerado ao editar (é a
  // âncora de "o cliente selecionou ESTE clip", inclusive quando o Vetor
  // aplica uma edição pedida em linguagem natural sobre um clip específico).
  id: string;
  sourceAssetId: string;
  startMs: number;
  durationMs: number;
  trimInMs: number;
  trimOutMs: number;
  speed: number;
  volume: number;
  transform: ClipTransform;
  transitionIn?: ClipTransition;
  transitionOut?: ClipTransition;
  effects: string[];
  keyframes: Keyframe[];
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  clips: Clip[];
}

export interface Marker {
  id: string;
  atMs: number;
  label: string;
  // Preenchido quando o marcador veio de uma decisão derivada de um
  // ReferenceVideoProfile (Parte 3) — nunca omitido silenciosamente, é
  // exatamente o "mostrar quais decisões vieram da referência" da spec.
  derivedFromReferenceVideoId?: string;
}

export interface CaptionCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  style?: { position?: "top" | "center" | "bottom"; fontSize?: number; color?: string };
}

export interface CaptionTrack {
  cues: CaptionCue[];
  language: "pt-BR";
}

export interface AudioMix {
  musicAssetId?: string;
  musicVolume: number;
  duckingEnabled: boolean;
  duckingThresholdDb: number;
  voiceoverVolume: number;
  sfxVolume: number;
}

export interface TimelineSettings {
  fps: number;
  width: number;
  height: number;
  background?: string;
}

export interface TimelineDocument {
  tracks: Track[];
  markers: Marker[];
  settings: TimelineSettings;
  captions?: CaptionTrack;
  audioMix?: AudioMix;
}

export type VideoProjectStatus =
  | "draft"
  | "analyzing"
  | "editing"
  | "awaiting_approval"
  | "rendering"
  | "completed"
  | "failed";

export interface VideoProject {
  id: string;
  tenantId: string;
  missionId?: string;
  requestId?: string;
  title: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  timelineVersion: number;
  timelineJson: TimelineDocument;
  referenceVideoId?: string;
  status: VideoProjectStatus;
  proxyUrl?: string;
  previewUrl?: string;
  outputUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Perfil derivado de um vídeo de referência anexado pelo cliente (Parte 3)
// — orienta decisões de edição, nunca é copiado/reutilizado como asset.
export interface ReferenceVideoProfile {
  id: string;
  tenantId: string;
  sourceAssetId: string;
  durationMs: number;
  aspectRatio: string;
  cutDensityPerMinute: number;
  averageShotDurationMs: number;
  hookStructure: string;
  pacing: "slow" | "medium" | "fast";
  captionStyle: { position: "top" | "center" | "bottom"; typicalDurationMs: number };
  transitionsUsed: ClipTransition["type"][];
  musicEnergy: "low" | "medium" | "high";
  relativeVolumeDb: number;
  soundEffectsUsed: string[];
  colorProfile: string;
  compositionNotes: string;
  createdAt: string;
}

// Cria uma timeline vazia mas estruturalmente válida — usado tanto pelo
// editor (novo projeto em branco) quanto por testes de round-trip.
export function criarTimelineVazia(settings: TimelineSettings): TimelineDocument {
  return { tracks: [], markers: [], settings };
}
