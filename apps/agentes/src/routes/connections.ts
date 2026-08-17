import { Router } from "express";
import { exigirAuthInterna } from "../middleware/internalAuth.js";
import {
  iniciarConexao,
  concluirConexao,
  concluirWhatsappEmbeddedSignup,
  listarConexoes,
  revogarConexao,
  EstadoOAuthInvalidoError,
} from "../connections/connectionsService.js";
import { ConfiguracaoProvedorAusenteError, type ConnectionProvider } from "../connections/providers.js";

export const connectionsRouter = Router();
connectionsRouter.use(exigirAuthInterna);

const PROVIDERS_VALIDOS: ConnectionProvider[] = ["instagram", "whatsapp", "meta_ads", "meta_business", "facebook"];

function providerValido(valor: string): valor is ConnectionProvider {
  return (PROVIDERS_VALIDOS as string[]).includes(valor);
}

connectionsRouter.get("/", async (req, res) => {
  const cliente_id = req.query.cliente_id;
  if (typeof cliente_id !== "string") {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }
  try {
    res.json({ connections: await listarConexoes(cliente_id) });
  } catch (err) {
    console.error("Erro ao listar conexões:", err);
    res.status(500).json({ error: "Falha ao listar conexões" });
  }
});

connectionsRouter.post("/:provider/state", async (req, res) => {
  const { provider } = req.params;
  const { cliente_id, usuario_id } = req.body ?? {};
  if (!provider || !providerValido(provider)) {
    res.status(400).json({ error: "provider inválido" });
    return;
  }
  if (!cliente_id || !usuario_id) {
    res.status(400).json({ error: "cliente_id e usuario_id são obrigatórios" });
    return;
  }

  try {
    const resultado = await iniciarConexao(cliente_id, usuario_id, provider);
    res.json(resultado);
  } catch (err) {
    if (err instanceof ConfiguracaoProvedorAusenteError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error(`Erro ao iniciar conexão "${provider}":`, err);
    res.status(500).json({ error: "Falha ao iniciar conexão" });
  }
});

connectionsRouter.post("/:provider/exchange", async (req, res) => {
  const { provider } = req.params;
  const { code, state } = req.body ?? {};
  if (!provider || !providerValido(provider)) {
    res.status(400).json({ error: "provider inválido" });
    return;
  }
  if (typeof code !== "string" || typeof state !== "string") {
    res.status(400).json({ error: "code e state são obrigatórios" });
    return;
  }

  try {
    const resultado = await concluirConexao(provider, code, state);
    res.json(resultado);
  } catch (err) {
    if (err instanceof EstadoOAuthInvalidoError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ConfiguracaoProvedorAusenteError) {
      res.status(503).json({ error: err.message });
      return;
    }
    // Nunca logar req.body inteiro aqui — pode conter o code — só a causa.
    console.error(`Erro ao concluir conexão "${provider}":`, err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Falha ao concluir conexão" });
  }
});

connectionsRouter.post("/whatsapp/embedded", async (req, res) => {
  const { cliente_id, code, waba_id, phone_number_id } = req.body ?? {};
  if (!cliente_id || !code || !waba_id || !phone_number_id) {
    res.status(400).json({ error: "cliente_id, code, waba_id e phone_number_id são obrigatórios" });
    return;
  }
  try {
    const resultado = await concluirWhatsappEmbeddedSignup(cliente_id, code, waba_id, phone_number_id);
    res.json(resultado);
  } catch (err) {
    if (err instanceof ConfiguracaoProvedorAusenteError) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error("Erro ao concluir Embedded Signup do WhatsApp:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Falha ao concluir conexão do WhatsApp" });
  }
});

connectionsRouter.post("/:provider/disconnect", async (req, res) => {
  const { provider } = req.params;
  const { cliente_id } = req.body ?? {};
  if (!provider || !providerValido(provider)) {
    res.status(400).json({ error: "provider inválido" });
    return;
  }
  if (!cliente_id) {
    res.status(400).json({ error: "cliente_id é obrigatório" });
    return;
  }
  try {
    await revogarConexao(cliente_id, provider);
    res.json({ status: "revoked" });
  } catch (err) {
    console.error(`Erro ao revogar conexão "${provider}":`, err);
    res.status(500).json({ error: "Falha ao revogar conexão" });
  }
});
