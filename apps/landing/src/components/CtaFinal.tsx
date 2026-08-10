"use client";

import { useState, type FormEvent } from "react";

export default function CtaFinal() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      nome: String(form.get("nome") ?? ""),
      whatsapp: String(form.get("whatsapp") ?? ""),
      tipo_negocio: String(form.get("tipo_negocio") ?? ""),
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao enviar");
      setEnviado(true);
    } catch {
      setErro("Não conseguimos enviar agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section id="lead" className="bg-areia py-20">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h2 className="text-2xl font-bold text-petroleo md:text-3xl">
          Sua agência de marketing que nunca dorme está a um passo
        </h2>
        <p className="mt-3 text-petroleo/70">
          Deixe seu contato e a gente te chama no WhatsApp para configurar o Vetor no seu negócio.
        </p>

        {enviado ? (
          <p className="mt-8 rounded-2xl bg-white p-6 font-medium text-petroleo shadow-sm">
            Recebemos seu contato! Alguém do time vai falar com você em breve.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-3 text-left">
            <input
              name="nome"
              required
              placeholder="Seu nome"
              className="w-full rounded-xl border border-petroleo/15 bg-white px-4 py-3 text-petroleo placeholder:text-petroleo/40 focus:border-menta focus:outline-none"
            />
            <input
              name="whatsapp"
              required
              placeholder="Seu WhatsApp"
              className="w-full rounded-xl border border-petroleo/15 bg-white px-4 py-3 text-petroleo placeholder:text-petroleo/40 focus:border-menta focus:outline-none"
            />
            <input
              name="tipo_negocio"
              required
              placeholder="Tipo de negócio (ex: restaurante, clínica...)"
              className="w-full rounded-xl border border-petroleo/15 bg-white px-4 py-3 text-petroleo placeholder:text-petroleo/40 focus:border-menta focus:outline-none"
            />
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-full bg-menta px-6 py-3 font-semibold text-petroleo transition hover:bg-menta-forte hover:text-white disabled:opacity-60"
            >
              {enviando ? "Enviando..." : "Quero conhecer o Vetor"}
            </button>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
