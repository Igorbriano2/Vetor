import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { whatsappRouter } from "./routes/whatsapp.js";
import { asaasRouter } from "./routes/asaas.js";
import { plataformaRouter } from "./routes/plataforma.js";
import { missoesRouter } from "./routes/missoes.js";
import { connectionsRouter } from "./routes/connections.js";
import { perfilRouter } from "./routes/perfil.js";
import { metaWebhookRouter } from "./routes/metaWebhook.js";
import { trafegoRouter } from "./routes/trafego.js";
import { referenciasRouter } from "./routes/referencias.js";
import { videoChatRouter } from "./routes/videoChat.js";
import { aiSuiteRouter } from "./routes/aiSuite.js";

const app = express();

app.use(helmet());
app.use(cors());
// Limite maior que o padrao (100kb) porque /plataforma/audio manda audio em base64.
// `verify` guarda o corpo bruto em req.rawBody — /webhooks/meta precisa dele
// pra validar a assinatura HMAC (X-Hub-Signature-256) antes do JSON parse.
app.use(
  express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/whatsapp", whatsappRouter);
app.use("/asaas", asaasRouter);
app.use("/plataforma", plataformaRouter);
app.use("/plataforma/missoes", missoesRouter);
app.use("/connections", connectionsRouter);
app.use("/perfil", perfilRouter);
app.use("/webhooks/meta", metaWebhookRouter);
app.use("/trafego", trafegoRouter);
app.use("/referencias", referenciasRouter);
app.use("/video-chat", videoChatRouter);
app.use("/ai-suite", aiSuiteRouter);

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => {
  console.log(`apps/agentes ouvindo na porta ${port} (modo WhatsApp: ${process.env.WHATSAPP_MODE ?? "sandbox"})`);
});
