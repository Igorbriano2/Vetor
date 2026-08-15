import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const MISSION_QUEUE_NAME = "missions";

// Só os 2 tipos de job desta rodada (docs/manus-jarvis-spec/docs/07-api-e-eventos.md
// lista 10 no total — os outros 8, ex: transcribe-audio, sync-integration, ficam
// para depois: STT/TTS já funcionam síncronos hoje e integrações externas ainda
// não estão conectadas).
export type MissionJobName = "plan-mission" | "run-agent-step";

export interface PlanMissionJobData {
  missionId: string;
}

export interface RunAgentStepJobData {
  missionStepId: string;
}

let queue: Queue | null = null;

// Lazy: instanciar a Queue só no primeiro enqueue, não na importação do módulo —
// mantém o server HTTP de pé sem REDIS_URL configurado (mesmo raciocínio de
// db/supabase.ts e queue/connection.ts).
function getQueue(): Queue {
  if (queue) return queue;
  queue = new Queue(MISSION_QUEUE_NAME, { connection: getRedisConnection() });
  return queue;
}

export async function enfileirarPlanMission(data: PlanMissionJobData): Promise<void> {
  await getQueue().add("plan-mission", data, { removeOnComplete: 100, removeOnFail: 500 });
}

export async function enfileirarRunAgentStep(data: RunAgentStepJobData): Promise<void> {
  await getQueue().add("run-agent-step", data, { removeOnComplete: 100, removeOnFail: 500 });
}
