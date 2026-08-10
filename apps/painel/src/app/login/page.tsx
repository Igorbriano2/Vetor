"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
    <main className="flex min-h-screen items-center justify-center bg-areia px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-petroleo">Entrar no painel Vetor</h1>
        <p className="mt-1 text-sm text-petroleo/60">
          Acompanhe suas demandas, entregas e relatórios.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-petroleo/15 px-4 py-3 text-petroleo placeholder:text-petroleo/40 focus:border-menta focus:outline-none"
          />
          <input
            type="password"
            required
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-xl border border-petroleo/15 px-4 py-3 text-petroleo placeholder:text-petroleo/40 focus:border-menta focus:outline-none"
          />
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-full bg-menta px-6 py-3 font-semibold text-petroleo transition hover:bg-menta-forte hover:text-white disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </form>
      </div>
    </main>
  );
}
