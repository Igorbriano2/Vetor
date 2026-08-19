import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { renderRouter } from "./routes/render.js";
import { exigirAuthInterna } from "./middleware/internalAuth.js";

const app = express();

app.use(helmet());
app.use(cors());
// Payload maior que o padrão de fábrica (100kb): a resposta de /render/*
// não carrega vídeo em base64 (isso viveria numa fila/stream numa próxima
// rodada), mas mantém folga pro corpo da requisição não travar em vazio.
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/render", exigirAuthInterna, renderRouter);

const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => {
  console.log(`apps/render ouvindo na porta ${port}`);
});
