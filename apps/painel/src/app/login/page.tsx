"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import VetorCore from "@/components/VetorCore";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setCarregando(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);

    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-petroleo px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_theme(colors.menta/12%),_transparent_60%)]"
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-areia/10 bg-petroleo-2/70 p-8 shadow-2xl backdrop-blur">
        <VetorCore estado="idle" />
        <h1 className="mt-6 text-xl font-bold text-areia">Entrar no Vetor</h1>
        <p className="mt-1 text-sm text-areia/50">
          Acompanhe demandas, entregas e aprovações em tempo real.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-areia/15 bg-petroleo px-4 py-3 text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
          />
          <input
            type="password"
            required
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-xl border border-areia/15 bg-petroleo px-4 py-3 text-areia placeholder:text-areia/30 focus:border-menta focus:outline-none"
          />
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-full bg-ambar px-6 py-3 font-semibold text-petroleo transition hover:bg-ambar-forte disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
          {erro && <p className="text-sm text-coral">{erro}</p>}
        </form>
      </div>
    </main>
  );
}
