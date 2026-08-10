"use client";

import { useEffect, useState } from "react";

interface Mensagem {
  autor: "cliente" | "vetor";
  texto: string;
}

const CONVERSA: Mensagem[] = [
  { autor: "cliente", texto: "Boa noite! Preciso de 5 posts pro feed dessa semana 🙏" },
  { autor: "vetor", texto: "Boa noite! Já anotei aqui. É sobre o cardápio novo ou outro tema?" },
  { autor: "cliente", texto: "Isso, o rodízio de sexta" },
  {
    autor: "vetor",
    texto: "Perfeito, já passei pro time de Design e Social Media. Peças prontas até terça 👍",
  },
];

export default function WhatsappDemo() {
  const [visiveis, setVisiveis] = useState(1);

  useEffect(() => {
    if (visiveis >= CONVERSA.length) return;
    const timer = setTimeout(() => setVisiveis((v) => v + 1), 1400);
    return () => clearTimeout(timer);
  }, [visiveis]);

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl bg-areia p-4 text-petroleo shadow-2xl">
      <div className="mb-3 flex items-center gap-2 border-b border-petroleo/10 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-petroleo text-sm font-bold text-menta">
          V
        </div>
        <div>
          <p className="text-sm font-semibold">Vetor</p>
          <p className="text-xs text-petroleo/50">online agora</p>
        </div>
      </div>
      <div className="flex min-h-64 flex-col gap-2">
        {CONVERSA.slice(0, visiveis).map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              msg.autor === "cliente"
                ? "self-end bg-menta/90 text-petroleo"
                : "self-start bg-white text-petroleo"
            }`}
          >
            {msg.texto}
          </div>
        ))}
      </div>
    </div>
  );
}
