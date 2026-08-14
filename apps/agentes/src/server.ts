import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { whatsappRouter } from "./routes/whatsapp.js";
import { asaasRouter } from "./routes/asaas.js";
import { plataformaRouter } from "./routes/plataforma.js";

const app = express();

app.use(helmet());
app.use(cors());
// Limite maior que o padrao (100kb) porque /plataforma/audio manda audio em base64.
app.use(express.json({ limit: "15mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/whatsapp", whatsappRouter);
app.use("/asaas", asaasRouter);
app.use("/plataforma", plataformaRouter);

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => {
  console.log(`apps/agentes ouvindo na porta ${port} (modo WhatsApp: ${process.env.WHATSAPP_MODE ?? "sandbox"})`);
});
