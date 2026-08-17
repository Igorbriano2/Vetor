// Espelha as colunas adicionadas em supabase/migrations/0013_onboarding_brandkit_connections.sql
// (business_profiles/brand_kits estendidos) — nomes em snake_case pra bater
// 1:1 com o que sai do Supabase, sem camada de mapeamento no meio.

export type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "profile_ready"
  | "brand_ready"
  | "channels_pending"
  | "ready_for_first_mission"
  | "completed";

export interface EnderecoNegocio {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  pais?: string;
}

export interface HorarioFuncionamento {
  dia: "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo";
  abre?: string;
  fecha?: string;
  fechado: boolean;
}

export type ModalidadeAtendimento = "presencial" | "delivery" | "online" | "agendamento";

export interface RedesSociais {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  googleBusiness?: string;
}

export interface ProdutoOuOferta {
  nome: string;
  descricao?: string;
  preco?: string;
}

export interface BusinessProfileForm {
  nome_exibicao: string;
  nome_legal: string;
  categoria: string;
  descricao: string;
  site_url: string;
  telefone_principal: string;
  whatsapp_telefone: string;
  email: string;
  endereco: EnderecoNegocio;
  areas_atendimento: string[];
  timezone: string;
  horario_funcionamento: HorarioFuncionamento[];
  modalidades_atendimento: ModalidadeAtendimento[];
  redes_sociais: RedesSociais;
  produtos_ofertas: ProdutoOuOferta[];
  publico: { resumo?: string; regiao?: string; diferenciais?: string };
  objetivos: string[];
  concorrentes: string[];
  ofertas: string[];
  tom: string;
  restricoes: string[];
  onboarding_status: OnboardingStatus;
  onboarding_etapa_atual: string | null;
}

export interface BrandKitForm {
  cores: Array<{ nome: string; hex: string; uso?: string }>;
  fontes: { titulo?: string; corpo?: string };
  logo_principal_ref: string | null;
  logo_clara_ref: string | null;
  logo_escura_ref: string | null;
  icone_ref: string | null;
  estilo_visual: { descricao?: string };
  estilos_proibidos: string[];
  exemplos_aprovados: string[];
  regras: { descricao?: string };
  voz_marca: { tom?: string; exemplos?: string[] };
  palavras_permitidas: string[];
  palavras_proibidas: string[];
  status: "draft" | "approved" | "archived";
}

export const DIAS_SEMANA: HorarioFuncionamento["dia"][] = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

export const LABEL_DIA: Record<HorarioFuncionamento["dia"], string> = {
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
  domingo: "Domingo",
};

export function perfilVazio(): BusinessProfileForm {
  return {
    nome_exibicao: "",
    nome_legal: "",
    categoria: "",
    descricao: "",
    site_url: "",
    telefone_principal: "",
    whatsapp_telefone: "",
    email: "",
    endereco: {},
    areas_atendimento: [],
    timezone: "America/Sao_Paulo",
    horario_funcionamento: DIAS_SEMANA.map((dia) => ({ dia, fechado: dia === "domingo" })),
    modalidades_atendimento: [],
    redes_sociais: {},
    produtos_ofertas: [],
    publico: {},
    objetivos: [],
    concorrentes: [],
    ofertas: [],
    tom: "",
    restricoes: [],
    onboarding_status: "not_started",
    onboarding_etapa_atual: null,
  };
}

export function brandKitVazio(): BrandKitForm {
  return {
    cores: [],
    fontes: {},
    logo_principal_ref: null,
    logo_clara_ref: null,
    logo_escura_ref: null,
    icone_ref: null,
    estilo_visual: {},
    estilos_proibidos: [],
    exemplos_aprovados: [],
    regras: {},
    voz_marca: {},
    palavras_permitidas: [],
    palavras_proibidas: [],
    status: "draft",
  };
}

export const ETAPAS_ONBOARDING = [
  "identidade",
  "contato",
  "operacao",
  "produtos",
  "publico",
  "visual",
  "voz",
  "canais",
  "conexoes",
  "revisao",
] as const;

export type EtapaOnboarding = (typeof ETAPAS_ONBOARDING)[number];

export const LABEL_ETAPA: Record<EtapaOnboarding, string> = {
  identidade: "Identidade da empresa",
  contato: "Contato e localização",
  operacao: "Operação",
  produtos: "Produtos e ofertas",
  publico: "Público e objetivos",
  visual: "Identidade visual",
  voz: "Voz da marca",
  canais: "Site e redes sociais",
  conexoes: "Conexões oficiais",
  revisao: "Revisão",
};

// Mínimo pra sair de "not_started"/"in_progress" e liberar a primeira
// missão guiada — o resto pode ficar pendente e aparecer no checklist.
export function perfilTemMinimoObrigatorio(perfil: BusinessProfileForm): boolean {
  return !!(perfil.nome_exibicao.trim() && perfil.categoria.trim() && perfil.descricao.trim() && perfil.objetivos.length > 0);
}
