"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// CRUD simples, sem lógica de negócio/LLM — por isso fala direto com o
// Supabase (RLS já permite insert/update do próprio cliente_id), sem passar
// por apps/agentes, igual ao login/page.tsx.
export default function ConfiguracoesNegocioPage() {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [descricao, setDescricao] = useState("");
  const [tom, setTom] = useState("");
  const [ofertas, setOfertas] = useState("");
  const [publico, setPublico] = useState("");
  const [restricoes, setRestricoes] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErro("Não autenticado.");
        setCarregando(false);
        return;
      }

      const { data: usuario } = await supabase.from("usuarios").select("cliente_id").eq("id", user.id).maybeSingle();
      if (!usuario?.cliente_id) {
        setErro("Seu usuário ainda não está vinculado a um cliente.");
        setCarregando(false);
        return;
      }
      setClienteId(usuario.cliente_id);

      const { data: perfil } = await supabase
        .from("business_profiles")
        .select("descricao, tom, ofertas, publico, restricoes")
        .eq("cliente_id", usuario.cliente_id)
        .maybeSingle();

      if (perfil) {
        setDescricao(perfil.descricao ?? "");
        setTom(perfil.tom ?? "");
        setOfertas(Array.isArray(perfil.ofertas) ? perfil.ofertas.join(", ") : "");
        setPublico(typeof perfil.publico?.resumo === "string" ? perfil.publico.resumo : "");
        setRestricoes(Array.isArray(perfil.restricoes) ? perfil.restricoes.join(", ") : "");
      }
      setCarregando(false);
    })();
  }, []);

  async function salvar() {
    if (!clienteId) return;
    setSalvando(true);
    setErro(null);
    setMensagem(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("business_profiles").upsert(
      {
        cliente_id: clienteId,
        descricao: descricao.trim() || null,
        tom: tom.trim() || null,
        ofertas: ofertas
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        publico: publico.trim() ? { resumo: publico.trim() } : {},
        restricoes: restricoes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      { onConflict: "cliente_id" },
    );

    setSalvando(false);
    if (error) {
      setErro("Não consegui salvar agora. Tenta de novo em instantes.");
      return;
    }
    setMensagem("Salvo!");
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-petroleo px-6 py-10 text-areia">
        <p className="text-sm text-areia/50">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-petroleo px-6 py-10 text-areia">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-wide text-areia/40">Vetor</p>
        <h1 className="mt-1 text-2xl font-bold text-areia">Sobre o seu negócio</h1>
        <p className="mt-2 text-sm text-areia/60">
          Essas informações ajudam o Vetor e os especialistas a proporem trabalho alinhado com o seu negócio,
          sem precisar perguntar toda vez.
        </p>

        {erro && !clienteId ? (
          <p className="mt-6 text-sm text-coral">{erro}</p>
        ) : (
          <div className="mt-8 space-y-5">
            <Campo label="Descrição do negócio">
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                placeholder="O que sua empresa vende, como funciona no dia a dia..."
                className="w-full rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
              />
            </Campo>

            <Campo label="Tom de voz">
              <input
                value={tom}
                onChange={(e) => setTom(e.target.value)}
                placeholder="Ex: descontraído e direto, formal e técnico..."
                className="w-full rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
              />
            </Campo>

            <Campo label="Ofertas principais" ajuda="separadas por vírgula">
              <input
                value={ofertas}
                onChange={(e) => setOfertas(e.target.value)}
                placeholder="Ex: cardápio delivery, reservas de mesa, eventos"
                className="w-full rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
              />
            </Campo>

            <Campo label="Público-alvo">
              <textarea
                value={publico}
                onChange={(e) => setPublico(e.target.value)}
                rows={2}
                placeholder="Quem são seus clientes ideais?"
                className="w-full rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
              />
            </Campo>

            <Campo label="Restrições" ajuda="separadas por vírgula — o que os agentes nunca devem fazer/dizer">
              <input
                value={restricoes}
                onChange={(e) => setRestricoes(e.target.value)}
                placeholder="Ex: não prometer prazo de entrega, não citar concorrentes"
                className="w-full rounded-xl border border-areia/15 bg-petroleo-2/60 px-4 py-3 text-sm text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
              />
            </Campo>

            <button
              onClick={salvar}
              disabled={salvando}
              className="rounded-full bg-ambar px-6 py-2.5 text-sm font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>

            {mensagem && <p className="text-sm text-menta">{mensagem}</p>}
            {erro && <p className="text-sm text-coral">{erro}</p>}
          </div>
        )}
      </div>
    </main>
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
