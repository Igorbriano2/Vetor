"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AreaIconBadge } from "@/components/ui/areaIcons";
import {
  type BusinessProfileForm,
  type BrandKitForm,
  type EtapaOnboarding,
  ETAPAS_ONBOARDING,
  LABEL_ETAPA,
  DIAS_SEMANA,
  LABEL_DIA,
  perfilTemMinimoObrigatorio,
} from "@/lib/onboarding/types";

// Fase 2 — onboarding progressivo. Mesma identidade visual da tela anterior
// de "Sobre o seu negócio" (inputs/textareas com a mesma classe), só que em
// etapas com progresso, salvamento automático e retomada — nunca um
// formulário gigante de uma vez só.

const textoParaLista = (texto: string) =>
  texto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

interface Props {
  clienteId: string;
  perfilInicial: BusinessProfileForm;
  brandKitInicial: BrandKitForm;
  conexoes: Array<{ provider: string; status: string; display_name: string | null }>;
}

export default function OnboardingWizard({ clienteId, perfilInicial, brandKitInicial, conexoes }: Props) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<EtapaOnboarding>(
    (perfilInicial.onboarding_etapa_atual as EtapaOnboarding) || ETAPAS_ONBOARDING[0],
  );
  const [perfil, setPerfil] = useState<BusinessProfileForm>(perfilInicial);
  const [brandKit, setBrandKit] = useState<BrandKitForm>(brandKitInicial);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoParaVetor, setEnviandoParaVetor] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const salvarTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvarBrandKitTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandKitVersaoRef = useRef<number>(1);

  const indiceEtapa = ETAPAS_ONBOARDING.indexOf(etapa);

  // Salvamento automático com debounce — cada alteração de campo agenda um
  // save; nunca perde dado ao trocar de etapa ou dar refresh.
  useEffect(() => {
    if (salvarTimeout.current) clearTimeout(salvarTimeout.current);
    salvarTimeout.current = setTimeout(() => {
      void salvarPerfil();
    }, 900);
    return () => {
      if (salvarTimeout.current) clearTimeout(salvarTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  useEffect(() => {
    if (salvarBrandKitTimeout.current) clearTimeout(salvarBrandKitTimeout.current);
    salvarBrandKitTimeout.current = setTimeout(() => {
      void salvarBrandKit();
    }, 900);
    return () => {
      if (salvarBrandKitTimeout.current) clearTimeout(salvarBrandKitTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandKit]);

  async function salvarBrandKit() {
    const cores = Object.fromEntries(brandKit.cores.map((c) => [c.nome, c.hex]));
    await supabase.from("brand_kits").upsert(
      {
        cliente_id: clienteId,
        versao: brandKitVersaoRef.current,
        cores,
        fontes: brandKit.fontes,
        logo_refs: [brandKit.logo_principal_ref, brandKit.logo_clara_ref, brandKit.logo_escura_ref, brandKit.icone_ref].filter(
          Boolean,
        ),
        logo_principal_ref: brandKit.logo_principal_ref,
        logo_clara_ref: brandKit.logo_clara_ref,
        logo_escura_ref: brandKit.logo_escura_ref,
        icone_ref: brandKit.icone_ref,
        estilo_visual: brandKit.estilo_visual,
        estilos_proibidos: brandKit.estilos_proibidos,
        exemplos_aprovados: brandKit.exemplos_aprovados,
        regras: brandKit.regras,
        voz_marca: brandKit.voz_marca,
        palavras_permitidas: brandKit.palavras_permitidas,
        palavras_proibidas: brandKit.palavras_proibidas,
        status: brandKit.status,
        is_atual: true,
      },
      { onConflict: "cliente_id,versao" },
    );
  }

  async function salvarPerfil(etapaParaGravar: EtapaOnboarding = etapa) {
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("business_profiles").upsert(
      {
        cliente_id: clienteId,
        nome_exibicao: perfil.nome_exibicao || null,
        nome_legal: perfil.nome_legal || null,
        categoria: perfil.categoria || null,
        descricao: perfil.descricao || null,
        site_url: perfil.site_url || null,
        telefone_principal: perfil.telefone_principal || null,
        whatsapp_telefone: perfil.whatsapp_telefone || null,
        email: perfil.email || null,
        endereco: perfil.endereco,
        areas_atendimento: perfil.areas_atendimento,
        timezone: perfil.timezone,
        horario_funcionamento: perfil.horario_funcionamento,
        modalidades_atendimento: perfil.modalidades_atendimento,
        redes_sociais: perfil.redes_sociais,
        produtos_ofertas: perfil.produtos_ofertas,
        publico: perfil.publico,
        objetivos: perfil.objetivos,
        concorrentes: perfil.concorrentes,
        ofertas: perfil.ofertas,
        tom: perfil.tom,
        restricoes: perfil.restricoes,
        onboarding_status: perfil.onboarding_status,
        onboarding_etapa_atual: etapaParaGravar,
      },
      { onConflict: "cliente_id" },
    );
    setSalvando(false);
    if (error) {
      setErro("Não consegui salvar agora — o que você digitou continua na tela, tenta de novo em instantes.");
      return;
    }
    setUltimoSalvamento(new Date());
  }

  function irPara(proxima: EtapaOnboarding) {
    void salvarPerfil(proxima);
    setEtapa(proxima);
  }

  function avancar() {
    const proxima = ETAPAS_ONBOARDING[indiceEtapa + 1];
    if (proxima) irPara(proxima);
  }

  function voltar() {
    const anterior = ETAPAS_ONBOARDING[indiceEtapa - 1];
    if (anterior) irPara(anterior);
  }

  async function finalizarOnboarding() {
    const pronta = perfilTemMinimoObrigatorio(perfil);
    const novoStatus = pronta ? "ready_for_first_mission" : "in_progress";
    setPerfil((p) => ({ ...p, onboarding_status: novoStatus }));

    await supabase
      .from("business_profiles")
      .update({
        onboarding_status: novoStatus,
        onboarding_completo_em: pronta ? new Date().toISOString() : null,
        onboarding_etapa_atual: "revisao",
      })
      .eq("cliente_id", clienteId);

    if (!pronta) return;

    // Fase 5 — primeira missão guiada: reaproveita o mesmo caminho que
    // qualquer mensagem de texto usa (propor_missao via chat), não um
    // atalho paralelo de criação de missão.
    setEnviandoParaVetor(true);
    try {
      await fetch("/api/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto:
            "Acabei de completar meu cadastro inicial. Pode propor um diagnóstico inicial do meu negócio como primeira missão?",
          responder_em_voz: false,
        }),
      });
      await supabase
        .from("business_profiles")
        .update({ primeira_missao_proposta_em: new Date().toISOString() })
        .eq("cliente_id", clienteId);
    } catch {
      // Best-effort — o cliente ainda pode pedir isso puxando conversa normal.
    } finally {
      setEnviandoParaVetor(false);
      router.push("/vetor");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <AreaIconBadge href="/configuracoes/negocio" />
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
          <h1 className="text-2xl font-bold text-areia">Conhecendo o seu negócio</h1>
        </div>
      </div>
      <p className="mt-2 text-sm text-areia/60">
        Antes de executar sua primeira missão, preciso conhecer sua empresa. Vou fazer algumas perguntas rápidas
        e organizar tudo para que minhas decisões sejam mais precisas.
      </p>

      {/* Progresso */}
      <div className="mt-6 flex items-center gap-1.5">
        {ETAPAS_ONBOARDING.map((e, i) => (
          <button
            key={e}
            onClick={() => irPara(e)}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= indiceEtapa ? "bg-ambar" : "bg-areia/10"
            }`}
            aria-label={LABEL_ETAPA[e]}
            title={LABEL_ETAPA[e]}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-areia/40">
        <span>
          Etapa {indiceEtapa + 1} de {ETAPAS_ONBOARDING.length} — {LABEL_ETAPA[etapa]}
        </span>
        <span>{salvando ? "salvando..." : ultimoSalvamento ? "salvo" : ""}</span>
      </div>

      <div className="mt-8 space-y-5 rounded-2xl panel p-6">
        {etapa === "identidade" && <EtapaIdentidade perfil={perfil} setPerfil={setPerfil} />}
        {etapa === "contato" && <EtapaContato perfil={perfil} setPerfil={setPerfil} />}
        {etapa === "operacao" && <EtapaOperacao perfil={perfil} setPerfil={setPerfil} />}
        {etapa === "produtos" && <EtapaProdutos perfil={perfil} setPerfil={setPerfil} />}
        {etapa === "publico" && <EtapaPublico perfil={perfil} setPerfil={setPerfil} />}
        {etapa === "visual" && (
          <EtapaVisual clienteId={clienteId} brandKit={brandKit} setBrandKit={setBrandKit} supabase={supabase} />
        )}
        {etapa === "voz" && <EtapaVoz perfil={perfil} setPerfil={setPerfil} brandKit={brandKit} setBrandKit={setBrandKit} />}
        {etapa === "canais" && <EtapaCanais perfil={perfil} setPerfil={setPerfil} />}
        {etapa === "conexoes" && <EtapaConexoes conexoes={conexoes} />}
        {etapa === "revisao" && <EtapaRevisao perfil={perfil} brandKit={brandKit} conexoes={conexoes} />}

        {erro && <p className="text-sm text-coral">{erro}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={voltar}
          disabled={indiceEtapa === 0}
          className="rounded-full border border-areia/15 px-5 py-2.5 text-sm text-areia/70 transition hover:border-menta disabled:opacity-30"
        >
          Voltar
        </button>
        {etapa === "revisao" ? (
          <button
            onClick={finalizarOnboarding}
            disabled={enviandoParaVetor}
            className="btn-tactile rounded-full bg-ambar px-6 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
          >
            {enviandoParaVetor ? "Enviando pro Vetor..." : "Concluir e pedir diagnóstico inicial"}
          </button>
        ) : (
          <button
            onClick={avancar}
            className="btn-tactile rounded-full bg-ambar px-6 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte"
          >
            Salvar e continuar
          </button>
        )}
      </div>
    </div>
  );
}

function Campo({ label, ajuda, children }: { label: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-xs uppercase tracking-wide text-areia/40">{label}</span>
      {ajuda && <span className="ml-2 text-[11px] text-areia/30">({ajuda})</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const campoClasse =
  "w-full rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none";

// Campo de lista separada por vírgula (objetivos, restrições, etc.). Guarda
// o texto bruto localmente e só reparte/limpa em vírgulas no blur — um
// campo controlado que reserializava a lista a cada tecla (value =
// lista.join(", ")) apagava espaço no fim da palavra assim que digitado,
// porque trim() rodava antes do usuário terminar de escrever a próxima
// palavra. Digitar livre (inclusive espaço) funciona até sair do campo.
function CampoListaTexto({
  valor,
  onCommit,
  placeholder,
}: {
  valor: string[];
  onCommit: (lista: string[]) => void;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(() => valor.join(", "));
  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => onCommit(textoParaLista(texto))}
      placeholder={placeholder}
      className={campoClasse}
    />
  );
}

// Mesmo problema do CampoListaTexto, só que cada item é "nome:hex" — texto
// bruto local, parse só no blur.
function CampoCores({
  valor,
  onCommit,
}: {
  valor: Array<{ nome: string; hex: string }>;
  onCommit: (cores: Array<{ nome: string; hex: string }>) => void;
}) {
  const [texto, setTexto] = useState(() => valor.map((c) => `${c.nome}:${c.hex}`).join(", "));
  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() =>
        onCommit(
          textoParaLista(texto).map((par) => {
            const [nome, hex] = par.split(":").map((s) => s.trim());
            return { nome: nome || par, hex: hex || "" };
          }),
        )
      }
      placeholder="Ex: primária:#F5B84B, secundária:#101923"
      className={campoClasse}
    />
  );
}

function EtapaIdentidade({
  perfil,
  setPerfil,
}: {
  perfil: BusinessProfileForm;
  setPerfil: React.Dispatch<React.SetStateAction<BusinessProfileForm>>;
}) {
  return (
    <>
      <p className="text-sm text-areia/60">Como sua empresa se chama e o que ela faz, em poucas palavras.</p>
      <Campo label="Nome da empresa">
        <input
          value={perfil.nome_exibicao}
          onChange={(e) => setPerfil((p) => ({ ...p, nome_exibicao: e.target.value }))}
          placeholder="Ex: Cantina da Vila"
          className={campoClasse}
        />
      </Campo>
      <Campo label="Categoria" ajuda="o tipo de negócio">
        <input
          value={perfil.categoria}
          onChange={(e) => setPerfil((p) => ({ ...p, categoria: e.target.value }))}
          placeholder="Ex: restaurante delivery, clínica de estética, escritório de advocacia..."
          className={campoClasse}
        />
      </Campo>
      <Campo label="Descrição do negócio">
        <textarea
          value={perfil.descricao}
          onChange={(e) => setPerfil((p) => ({ ...p, descricao: e.target.value }))}
          rows={3}
          placeholder="O que sua empresa vende, como funciona no dia a dia..."
          className={campoClasse}
        />
      </Campo>
    </>
  );
}

function EtapaContato({
  perfil,
  setPerfil,
}: {
  perfil: BusinessProfileForm;
  setPerfil: React.Dispatch<React.SetStateAction<BusinessProfileForm>>;
}) {
  return (
    <>
      <p className="text-sm text-areia/60">Como clientes e o Vetor podem confirmar onde e como falar com você.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Telefone principal">
          <input
            value={perfil.telefone_principal}
            onChange={(e) => setPerfil((p) => ({ ...p, telefone_principal: e.target.value }))}
            className={campoClasse}
          />
        </Campo>
        <Campo label="WhatsApp">
          <input
            value={perfil.whatsapp_telefone}
            onChange={(e) => setPerfil((p) => ({ ...p, whatsapp_telefone: e.target.value }))}
            className={campoClasse}
          />
        </Campo>
      </div>
      <Campo label="E-mail">
        <input
          value={perfil.email}
          onChange={(e) => setPerfil((p) => ({ ...p, email: e.target.value }))}
          className={campoClasse}
        />
      </Campo>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Endereço">
          <input
            value={perfil.endereco.logradouro ?? ""}
            onChange={(e) => setPerfil((p) => ({ ...p, endereco: { ...p.endereco, logradouro: e.target.value } }))}
            placeholder="Rua, número, bairro"
            className={campoClasse}
          />
        </Campo>
        <Campo label="Cidade / UF">
          <input
            value={perfil.endereco.cidade ?? ""}
            onChange={(e) => setPerfil((p) => ({ ...p, endereco: { ...p.endereco, cidade: e.target.value } }))}
            className={campoClasse}
          />
        </Campo>
      </div>
    </>
  );
}

function EtapaOperacao({
  perfil,
  setPerfil,
}: {
  perfil: BusinessProfileForm;
  setPerfil: React.Dispatch<React.SetStateAction<BusinessProfileForm>>;
}) {
  const modalidades: Array<{ valor: BusinessProfileForm["modalidades_atendimento"][number]; label: string }> = [
    { valor: "presencial", label: "Presencial" },
    { valor: "delivery", label: "Delivery" },
    { valor: "online", label: "Online" },
    { valor: "agendamento", label: "Agendamento" },
  ];

  return (
    <>
      <p className="text-sm text-areia/60">Horários e como o atendimento acontece — isso evita o Vetor prometer algo fora do seu horário.</p>
      <Campo label="Modalidades de atendimento">
        <div className="flex flex-wrap gap-2">
          {modalidades.map((m) => {
            const ativo = perfil.modalidades_atendimento.includes(m.valor);
            return (
              <button
                key={m.valor}
                type="button"
                onClick={() =>
                  setPerfil((p) => ({
                    ...p,
                    modalidades_atendimento: ativo
                      ? p.modalidades_atendimento.filter((x) => x !== m.valor)
                      : [...p.modalidades_atendimento, m.valor],
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  ativo ? "border-menta text-menta bg-menta/10" : "border-areia/15 text-areia/60"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </Campo>
      <Campo label="Áreas atendidas" ajuda="separadas por vírgula, se fizer sentido">
        <CampoListaTexto
          valor={perfil.areas_atendimento}
          onCommit={(lista) => setPerfil((p) => ({ ...p, areas_atendimento: lista }))}
          placeholder="Ex: Centro, Zona Sul, toda a cidade"
        />
      </Campo>
      <Campo label="Horário de funcionamento">
        <div className="space-y-2">
          {DIAS_SEMANA.map((dia) => {
            const linha = perfil.horario_funcionamento.find((h) => h.dia === dia) ?? { dia, fechado: true };
            return (
              <div key={dia} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-areia/60">{LABEL_DIA[dia]}</span>
                <label className="flex items-center gap-1.5 text-xs text-areia/50">
                  <input
                    type="checkbox"
                    checked={!linha.fechado}
                    onChange={(e) =>
                      setPerfil((p) => ({
                        ...p,
                        horario_funcionamento: DIAS_SEMANA.map((d) =>
                          d === dia
                            ? { ...linha, dia, fechado: !e.target.checked }
                            : p.horario_funcionamento.find((h) => h.dia === d) ?? { dia: d, fechado: true },
                        ),
                      }))
                    }
                  />
                  aberto
                </label>
                {!linha.fechado && (
                  <>
                    <input
                      type="time"
                      value={linha.abre ?? ""}
                      onChange={(e) =>
                        setPerfil((p) => ({
                          ...p,
                          horario_funcionamento: DIAS_SEMANA.map((d) =>
                            d === dia ? { ...linha, abre: e.target.value } : p.horario_funcionamento.find((h) => h.dia === d) ?? { dia: d, fechado: true },
                          ),
                        }))
                      }
                      className="rounded-lg border border-areia/15 bg-petroleo-2/60 px-2 py-1 text-xs text-areia"
                    />
                    <span className="text-areia/30">até</span>
                    <input
                      type="time"
                      value={linha.fecha ?? ""}
                      onChange={(e) =>
                        setPerfil((p) => ({
                          ...p,
                          horario_funcionamento: DIAS_SEMANA.map((d) =>
                            d === dia ? { ...linha, fecha: e.target.value } : p.horario_funcionamento.find((h) => h.dia === d) ?? { dia: d, fechado: true },
                          ),
                        }))
                      }
                      className="rounded-lg border border-areia/15 bg-petroleo-2/60 px-2 py-1 text-xs text-areia"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Campo>
    </>
  );
}

function EtapaProdutos({
  perfil,
  setPerfil,
}: {
  perfil: BusinessProfileForm;
  setPerfil: React.Dispatch<React.SetStateAction<BusinessProfileForm>>;
}) {
  const textoProdutos = perfil.produtos_ofertas.map((p) => [p.nome, p.descricao ?? "", p.preco ?? ""].join(" | ")).join("\n");

  return (
    <>
      <p className="text-sm text-areia/60">
        Produtos, serviços, combos e promoções — um por linha, no formato <code className="text-areia/40">nome | descrição | preço</code>.
      </p>
      <Campo label="Produtos e ofertas">
        <textarea
          defaultValue={textoProdutos}
          onBlur={(e) => {
            const linhas = e.target.value
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((linha) => {
                const [nome, descricao, preco] = linha.split("|").map((s) => s.trim());
                return { nome: nome || linha, descricao: descricao || undefined, preco: preco || undefined };
              });
            setPerfil((p) => ({ ...p, produtos_ofertas: linhas }));
          }}
          rows={5}
          placeholder={"Feijoada completa | serve 2 pessoas | R$ 68\nCombo delivery | 2 pratos + 2 bebidas | R$ 89"}
          className={campoClasse}
        />
      </Campo>
      <Campo label="Ofertas principais em uma frase" ajuda="separadas por vírgula — usado como resumo rápido pelo Vetor">
        <CampoListaTexto valor={perfil.ofertas} onCommit={(lista) => setPerfil((p) => ({ ...p, ofertas: lista }))} />
      </Campo>
    </>
  );
}

function EtapaPublico({
  perfil,
  setPerfil,
}: {
  perfil: BusinessProfileForm;
  setPerfil: React.Dispatch<React.SetStateAction<BusinessProfileForm>>;
}) {
  return (
    <>
      <p className="text-sm text-areia/60">Quem é o cliente ideal e o que você quer alcançar — isso guia toda decisão do Vetor.</p>
      <Campo label="Público-alvo">
        <textarea
          value={perfil.publico.resumo ?? ""}
          onChange={(e) => setPerfil((p) => ({ ...p, publico: { ...p.publico, resumo: e.target.value } }))}
          rows={2}
          placeholder="Quem são seus clientes ideais?"
          className={campoClasse}
        />
      </Campo>
      <Campo label="Diferenciais">
        <input
          value={perfil.publico.diferenciais ?? ""}
          onChange={(e) => setPerfil((p) => ({ ...p, publico: { ...p.publico, diferenciais: e.target.value } }))}
          placeholder="O que te destaca da concorrência?"
          className={campoClasse}
        />
      </Campo>
      <Campo label="Objetivos" ajuda="separados por vírgula — pelo menos um é obrigatório">
        <CampoListaTexto
          valor={perfil.objetivos}
          onCommit={(lista) => setPerfil((p) => ({ ...p, objetivos: lista }))}
          placeholder="Ex: aumentar pedidos delivery, ganhar seguidores, gerar leads"
        />
      </Campo>
      <Campo label="Concorrentes" ajuda="separados por vírgula, opcional">
        <CampoListaTexto valor={perfil.concorrentes} onCommit={(lista) => setPerfil((p) => ({ ...p, concorrentes: lista }))} />
      </Campo>
    </>
  );
}

function EtapaVisual({
  clienteId,
  brandKit,
  setBrandKit,
  supabase,
}: {
  clienteId: string;
  brandKit: BrandKitForm;
  setBrandKit: React.Dispatch<React.SetStateAction<BrandKitForm>>;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
}) {
  const [enviando, setEnviando] = useState<string | null>(null);

  async function upload(campo: "logo_principal_ref" | "logo_clara_ref" | "logo_escura_ref" | "icone_ref", file: File) {
    setEnviando(campo);
    const path = `${clienteId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false });
    setEnviando(null);
    if (error) return;
    setBrandKit((b) => ({ ...b, [campo]: path }));
  }

  const campos: Array<{ campo: "logo_principal_ref" | "logo_clara_ref" | "logo_escura_ref" | "icone_ref"; label: string }> = [
    { campo: "logo_principal_ref", label: "Logo principal" },
    { campo: "logo_clara_ref", label: "Logo clara (fundo escuro)" },
    { campo: "logo_escura_ref", label: "Logo escura (fundo claro)" },
    { campo: "icone_ref", label: "Ícone" },
  ];

  return (
    <>
      <p className="text-sm text-areia/60">
        Envie os arquivos da sua marca — só a referência fica salva, o arquivo vai pro storage seguro. Pra um banco
        de imagens completo (pastas, tags, busca), veja{" "}
        <a href="/configuracoes/negocio/banco-de-imagens" target="_blank" rel="noreferrer" className="text-menta underline underline-offset-2">
          Banco de imagens
        </a>
        .
      </p>
      <div className="grid grid-cols-2 gap-4">
        {campos.map(({ campo, label }) => (
          <label key={campo} className="block">
            <span className="font-mono text-xs uppercase tracking-wide text-areia/40">{label}</span>
            <div className="mt-1.5 rounded-xl border border-dashed border-areia/20 p-3 text-center text-xs text-areia/50">
              {brandKit[campo] ? (
                <span className="text-menta">arquivo enviado ✓</span>
              ) : enviando === campo ? (
                "enviando..."
              ) : (
                <label className="cursor-pointer">
                  escolher arquivo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && upload(campo, e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </label>
        ))}
      </div>
      <Campo label="Cores da marca" ajuda="nome:hex separados por vírgula">
        <CampoCores
          valor={brandKit.cores}
          onCommit={(cores) => setBrandKit((b) => ({ ...b, cores }))}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Fonte de título">
          <input
            value={brandKit.fontes.titulo ?? ""}
            onChange={(e) => setBrandKit((b) => ({ ...b, fontes: { ...b.fontes, titulo: e.target.value } }))}
            className={campoClasse}
          />
        </Campo>
        <Campo label="Fonte de corpo">
          <input
            value={brandKit.fontes.corpo ?? ""}
            onChange={(e) => setBrandKit((b) => ({ ...b, fontes: { ...b.fontes, corpo: e.target.value } }))}
            className={campoClasse}
          />
        </Campo>
      </div>
      <Campo label="Estilos proibidos" ajuda="separados por vírgula — o que os agentes nunca devem usar visualmente">
        <CampoListaTexto
          valor={brandKit.estilos_proibidos}
          onCommit={(lista) => setBrandKit((b) => ({ ...b, estilos_proibidos: lista }))}
        />
      </Campo>
    </>
  );
}

function EtapaVoz({
  perfil,
  setPerfil,
  brandKit,
  setBrandKit,
}: {
  perfil: BusinessProfileForm;
  setPerfil: React.Dispatch<React.SetStateAction<BusinessProfileForm>>;
  brandKit: BrandKitForm;
  setBrandKit: React.Dispatch<React.SetStateAction<BrandKitForm>>;
}) {
  return (
    <>
      <p className="text-sm text-areia/60">Como sua marca fala — isso vai direto pro prompt de cada especialista de conteúdo.</p>
      <Campo label="Tom de voz">
        <input
          value={perfil.tom}
          onChange={(e) => setPerfil((p) => ({ ...p, tom: e.target.value }))}
          placeholder="Ex: descontraído e direto, formal e técnico..."
          className={campoClasse}
        />
      </Campo>
      <Campo label="Palavras permitidas" ajuda="separadas por vírgula">
        <CampoListaTexto
          valor={brandKit.palavras_permitidas}
          onCommit={(lista) => setBrandKit((b) => ({ ...b, palavras_permitidas: lista }))}
        />
      </Campo>
      <Campo label="Palavras proibidas" ajuda="separadas por vírgula">
        <CampoListaTexto
          valor={brandKit.palavras_proibidas}
          onCommit={(lista) => setBrandKit((b) => ({ ...b, palavras_proibidas: lista }))}
        />
      </Campo>
      <Campo label="Restrições" ajuda="separadas por vírgula — o que os agentes nunca devem fazer/dizer">
        <CampoListaTexto
          valor={perfil.restricoes}
          onCommit={(lista) => setPerfil((p) => ({ ...p, restricoes: lista }))}
          placeholder="Ex: não prometer prazo de entrega, não citar concorrentes"
        />
      </Campo>
    </>
  );
}

function EtapaCanais({
  perfil,
  setPerfil,
}: {
  perfil: BusinessProfileForm;
  setPerfil: React.Dispatch<React.SetStateAction<BusinessProfileForm>>;
}) {
  const campos: Array<{ campo: keyof BusinessProfileForm["redes_sociais"]; label: string }> = [
    { campo: "instagram", label: "Instagram" },
    { campo: "facebook", label: "Facebook" },
    { campo: "tiktok", label: "TikTok" },
    { campo: "youtube", label: "YouTube" },
    { campo: "linkedin", label: "LinkedIn" },
    { campo: "googleBusiness", label: "Google Business" },
  ];
  return (
    <>
      <p className="text-sm text-areia/60">Seu site e onde sua marca já está presente.</p>
      <Campo label="Site">
        <input
          value={perfil.site_url}
          onChange={(e) => setPerfil((p) => ({ ...p, site_url: e.target.value }))}
          placeholder="https://..."
          className={campoClasse}
        />
      </Campo>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {campos.map(({ campo, label }) => (
          <Campo key={campo} label={label}>
            <input
              value={perfil.redes_sociais[campo] ?? ""}
              onChange={(e) => setPerfil((p) => ({ ...p, redes_sociais: { ...p.redes_sociais, [campo]: e.target.value } }))}
              placeholder="@usuario ou URL"
              className={campoClasse}
            />
          </Campo>
        ))}
      </div>
    </>
  );
}

function EtapaConexoes({ conexoes }: { conexoes: Array<{ provider: string; status: string; display_name: string | null }> }) {
  // Login do Facebook para Empresas é um único diálogo cobrindo Ads/Páginas/
  // Instagram/WhatsApp de uma vez (ver apps/agentes/src/connections) — um só
  // botão, não um por serviço; o que aparece abaixo é o que a Meta devolveu
  // depois de descobrir os ativos reais da conta.
  const providersConectados: Array<{ id: string; label: string }> = [
    { id: "meta_ads", label: "Conta de anúncios" },
    { id: "meta_business", label: "Página do Facebook" },
    { id: "instagram", label: "Instagram" },
    { id: "whatsapp", label: "WhatsApp Business" },
  ];

  return (
    <>
      <p className="text-sm text-areia/60">
        Conecte sua conta Meta pra o Vetor conseguir publicar e ler métricas de verdade — nunca pedimos sua senha,
        é sempre a tela oficial da Meta. Um único login já cobre anúncios, página, Instagram e WhatsApp Business.
      </p>
      <a
        href="/api/connections/facebook/start"
        className="block rounded-xl border border-ambar/30 bg-ambar/10 p-4 text-center text-sm font-semibold text-ambar transition hover:bg-ambar/20"
      >
        Conectar com a Meta
      </a>
      <div className="space-y-2">
        {providersConectados.map(({ id, label }) => {
          const conexao = conexoes.find((c) => c.provider === id && c.status === "connected");
          return (
            <div key={id} className="flex items-center justify-between rounded-xl border border-areia/10 bg-petroleo/50 px-4 py-2.5">
              <div>
                <p className="text-sm text-areia">{label}</p>
                {conexao?.display_name && <p className="text-xs text-areia/40">{conexao.display_name}</p>}
              </div>
              <span className={`font-mono text-[11px] ${conexao ? "text-menta" : "text-areia/30"}`}>
                {conexao ? "conectado" : "não conectado"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-areia/30">
        Pode pular esta etapa e conectar depois em Negócio → Conexões — não bloqueia o resto do onboarding.
      </p>
    </>
  );
}

function EtapaRevisao({
  perfil,
  brandKit,
  conexoes,
}: {
  perfil: BusinessProfileForm;
  brandKit: BrandKitForm;
  conexoes: Array<{ provider: string; status: string }>;
}) {
  const itens = [
    { label: "Perfil da empresa", pronto: perfilTemMinimoObrigatorio(perfil) },
    { label: "Identidade visual", pronto: brandKit.cores.length > 0 || !!brandKit.logo_principal_ref },
    { label: "Instagram", pronto: conexoes.some((c) => c.provider === "instagram" && c.status === "connected") },
    { label: "WhatsApp", pronto: conexoes.some((c) => c.provider === "whatsapp" && c.status === "connected") },
    { label: "Meta Ads", pronto: conexoes.some((c) => c.provider === "meta_ads" && c.status === "connected") },
  ];

  return (
    <>
      <p className="text-sm text-areia/60">Confira o que já está pronto — o que faltar pode ser completado depois, sem bloquear o Vetor.</p>
      <div className="space-y-2">
        {itens.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl border border-areia/10 bg-petroleo/50 px-4 py-2.5 text-sm">
            <span className="text-areia/80">{item.label}</span>
            <span className={item.pronto ? "text-menta" : "text-areia/30"}>{item.pronto ? "pronto" : "pendente"}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-areia/60">
        {perfilTemMinimoObrigatorio(perfil)
          ? "Ao concluir, o Vetor já vai propor um diagnóstico inicial do seu negócio."
          : "Preencha ao menos nome, categoria, descrição e um objetivo pra liberar a primeira missão."}
      </p>
    </>
  );
}
