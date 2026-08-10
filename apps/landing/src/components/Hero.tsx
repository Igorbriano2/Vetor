import Link from "next/link";
import { linkWhatsapp } from "@/lib/whatsapp";
import WhatsappDemo from "@/components/WhatsappDemo";

export default function Hero() {
  return (
    <section className="bg-petroleo text-areia">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            Sua agência atual demora 3 dias para responder.
            <span className="text-menta"> A sua nova agência responde em 3 segundos</span> — e
            nunca dorme.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-areia/80">
            Vetor é um time de agentes de IA especializados — tráfego, design, social media e
            estratégia — atendendo pelo WhatsApp e supervisionado por gente que entende do seu
            negócio.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="#planos"
              className="rounded-full bg-menta px-7 py-3 text-center font-semibold text-petroleo transition hover:bg-menta-forte hover:text-white"
            >
              Quero conhecer o Vetor
            </Link>
            <a
              href={linkWhatsapp("Oi! Vim pelo site e quero falar com o Vetor.")}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-areia/30 px-7 py-3 text-center font-semibold transition hover:border-areia/60"
            >
              Falar no WhatsApp
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-areia/60">
            <span>✓ Sem fidelidade</span>
            <span>✓ Setup em minutos</span>
            <span>✓ Cancele quando quiser</span>
          </div>
        </div>
        <WhatsappDemo />
      </div>
    </section>
  );
}
