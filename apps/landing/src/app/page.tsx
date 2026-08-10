import Hero from "@/components/Hero";
import NichoSelector from "@/components/NichoSelector";
import Jornada from "@/components/Jornada";
import PorTras from "@/components/PorTras";
import Comparativo from "@/components/Comparativo";
import Planos from "@/components/Planos";
import Faq from "@/components/Faq";
import CtaFinal from "@/components/CtaFinal";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <NichoSelector />
      <Jornada />
      <PorTras />
      <Comparativo />
      <Planos />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
