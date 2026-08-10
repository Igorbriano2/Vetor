import { Router } from "express";
import { supabase } from "../db/supabase.js";
import { criarClienteAsaas, criarAssinaturaAsaas, type FormaPagamento } from "../integrations/asaas.js";
import { VALOR_CENTAVOS_POR_PLANO, planoValidoParaAssinatura } from "../billing/planos.js";

export const asaasRouter = Router();

// Cria cliente + assinatura recorrente no Asaas para um cliente já cadastrado no Supabase.
// Fluxo completo (docs/05, secao 4): normalmente chamado logo apos o cliente escolher um
// plano na landing page ou fechar por WhatsApp.
asaasRouter.post("/assinaturas", async (req, res) => {
  const { cliente_id, plano_id, cpf_cnpj, email, telefone, forma_pagamento } = req.body ?? {};

  if (!cliente_id || !plano_id || !cpf_cnpj) {
    res.status(400).json({ error: "cliente_id, plano_id e cpf_cnpj são obrigatórios" });
    return;
  }

  if (!planoValidoParaAssinatura(plano_id)) {
    res.status(400).json({
      error: `Plano "${plano_id}" ainda não tem cobrança automática — apenas design, social_media e duplo por enquanto (Fase 1).`,
    });
    return;
  }

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("id, nome_empresa")
    .eq("id", cliente_id)
    .single();

  if (clienteError || !cliente) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }

  try {
    const asaasCustomer = await criarClienteAsaas({
      nome: cliente.nome_empresa,
      cpfCnpj: cpf_cnpj,
      email,
      telefone,
    });

    const valorCentavos = VALOR_CENTAVOS_POR_PLANO[plano_id];
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const assinaturaAsaas = await criarAssinaturaAsaas({
      asaasCustomerId: asaasCustomer.id,
      valorCentavos,
      formaPagamento: (forma_pagamento as FormaPagamento) ?? "PIX",
      descricao: `Vetor — plano ${plano_id}`,
      diaVencimento: amanha,
    });

    await supabase.from("assinaturas").upsert(
      {
        cliente_id,
        plano_id,
        asaas_customer_id: asaasCustomer.id,
        asaas_subscription_id: assinaturaAsaas.id,
        status: "em_teste",
        valor_mensal_centavos: valorCentavos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cliente_id" },
    );

    res.status(201).json({ asaas_customer_id: asaasCustomer.id, asaas_subscription_id: assinaturaAsaas.id });
  } catch (err) {
    console.error("Erro ao criar assinatura Asaas:", err);
    res.status(502).json({ error: "Falha ao criar assinatura no Asaas" });
  }
});

const STATUS_POR_EVENTO: Record<string, "ativa" | "atrasada" | "cancelada"> = {
  PAYMENT_CONFIRMED: "ativa",
  PAYMENT_RECEIVED: "ativa",
  PAYMENT_OVERDUE: "atrasada",
  SUBSCRIPTION_CANCELED: "cancelada",
  SUBSCRIPTION_DELETED: "cancelada",
};

asaasRouter.post("/webhook", async (req, res) => {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  const tokenRecebido = req.header("asaas-access-token");

  if (tokenEsperado && tokenRecebido !== tokenEsperado) {
    res.sendStatus(401);
    return;
  }

  // Responde rápido — o Asaas espera 200 e reenvia em caso de timeout/erro.
  res.sendStatus(200);

  const evento = req.body?.event as string | undefined;
  const novoStatus = evento ? STATUS_POR_EVENTO[evento] : undefined;
  if (!novoStatus) return;

  const subscriptionId: string | undefined =
    req.body?.payment?.subscription ?? req.body?.subscription?.id;

  if (!subscriptionId) return;

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .eq("asaas_subscription_id", subscriptionId)
    .select("cliente_id")
    .maybeSingle();

  if (assinatura?.cliente_id) {
    await supabase
      .from("clientes")
      .update({ status_assinatura: novoStatus })
      .eq("id", assinatura.cliente_id);

    await supabase.from("log_agentes").insert({
      agente: "asaas_webhook",
      cliente_id: assinatura.cliente_id,
      acao: evento,
      justificativa: `Webhook Asaas: ${evento} -> status ${novoStatus}`,
    });
  }
});
