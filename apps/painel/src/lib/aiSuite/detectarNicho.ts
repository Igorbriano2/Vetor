// Deriva o nicho (restaurante/advocacia/clinica/geral) a partir da
// categoria livre que o cliente escreveu no onboarding (business_profiles.
// categoria, ex: "Lanchonete / Hamburgueria") — heurística simples por
// palavra-chave, nunca um enum fechado no formulário de onboarding (que já
// existe e não deve mudar por causa desta suíte). "geral" é sempre o
// fallback honesto quando nada bate, nunca um chute.
const PALAVRAS_POR_NICHO: Record<"restaurante" | "advocacia" | "clinica", string[]> = {
  restaurante: ["restaurante", "lanchonete", "hamburgu", "pizzaria", "comida", "delivery", "bar", "café", "cafeteria", "padaria", "confeitaria", "food"],
  advocacia: ["advoc", "jurídic", "juridic", "direito", "escritório de", "advogad"],
  clinica: ["clínic", "clinic", "estétic", "estetic", "saúde", "saude", "odont", "dermat", "médic", "medic", "fisioterap"],
};

export function detectarNicho(categoria: string | null | undefined): "restaurante" | "advocacia" | "clinica" | "geral" {
  if (!categoria) return "geral";
  const normalizado = categoria.toLowerCase();
  for (const [nicho, palavras] of Object.entries(PALAVRAS_POR_NICHO) as Array<[keyof typeof PALAVRAS_POR_NICHO, string[]]>) {
    if (palavras.some((p) => normalizado.includes(p))) return nicho;
  }
  return "geral";
}
