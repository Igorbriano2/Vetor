import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "../queue/connection.js";
import { MISSION_QUEUE_NAME, type PlanMissionJobData, type RunAgentStepJobData } from "../queue/missionQueue.js";
import { processarPlanMission, processarRunAgentStep } from "../missions/orchestrator.js";

// Entrypoint separado do server HTTP (src/server.ts) — processo próprio na DO
// (start:worker), porque BullMQ Worker é um consumidor de longa duração, não
// um handler de requisição. REDIS_URL é obrigatório aqui: ao contrário do
// server HTTP (que sobe sem Supabase/WhatsApp configurados em modo sandbox),
// o worker não tem função sem fila — falha alto na inicialização de propósito.
const connection = getRedisConnection();

const worker = new Worker(
  MISSION_QUEUE_NAME,
  async (job: Job) => {
    if (job.name === "plan-mission") {
      const data = job.data as PlanMissionJobData;
      await processarPlanMission(data.missionId);
      return;
    }
    if (job.name === "run-agent-step") {
      const data = job.data as RunAgentStepJobData;
      await processarRunAgentStep(data.missionStepId);
      return;
    }
    console.warn(`missionWorker: job desconhecido "${job.name}", ignorando`);
  },
  { connection },
);

worker.on("completed", (job) => {
  console.log(`missionWorker: job ${job.id} (${job.name}) concluído`);
});

worker.on("failed", (job, err) => {
  console.error(`missionWorker: job ${job?.id} (${job?.name}) falhou:`, err);
});

console.log("missionWorker ouvindo a fila de missões");
