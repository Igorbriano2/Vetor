function baseUrl() {
  return (process.env.ASAAS_ENV ?? "sandbox") === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

function headers() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");
  return {
    "Content-Type": "application/json",
    access_token: apiKey,
  };
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Asaas ${path} falhou (${res.status}): ${JSON.stringify(body)}`);
  }
  return body as T;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
}

export async function criarClienteAsaas(params: {
  nome: string;
  cpfCnpj: string;
  email?: string;
  telefone?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.nome,
      cpfCnpj: params.cpfCnpj,
      email: params.email,
      mobilePhone: params.telefone,
    }),
  });
}

export interface AsaasSubscription {
  id: string;
  status: string;
  value: number;
  nextDueDate: string;
}

export type FormaPagamento = "PIX" | "BOLETO" | "CREDIT_CARD";

export async function criarAssinaturaAsaas(params: {
  asaasCustomerId: string;
  valorCentavos: number;
  formaPagamento: FormaPagamento;
  descricao: string;
  diaVencimento: string; // formato AAAA-MM-DD do primeiro vencimento
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: params.asaasCustomerId,
      billingType: params.formaPagamento,
      cycle: "MONTHLY",
      value: params.valorCentavos / 100,
      nextDueDate: params.diaVencimento,
      description: params.descricao,
    }),
  });
}

export async function cancelarAssinaturaAsaas(asaasSubscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${asaasSubscriptionId}`, { method: "DELETE" });
}
