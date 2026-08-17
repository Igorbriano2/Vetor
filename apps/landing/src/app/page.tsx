import { AgentNetwork } from "@/components/vetor/AgentNetwork";
import { AutonomyPlans } from "@/components/vetor/AutonomyPlans";
import { BootSequence } from "@/components/vetor/BootSequence";
import { CicloInteligencia } from "@/components/vetor/CicloInteligencia";
import { Comparativo } from "@/components/vetor/Comparativo";
import { CustoAgencia } from "@/components/vetor/CustoAgencia";
import { Faq } from "@/components/vetor/Faq";
import { FinalActivation } from "@/components/vetor/FinalActivation";
import { FloatingWhats } from "@/components/vetor/FloatingWhats";
import { Footer } from "@/components/vetor/Footer";
import { Fragmentacao } from "@/components/vetor/Fragmentacao";
import { Hero } from "@/components/vetor/Hero";
import { MissionTimeline } from "@/components/vetor/MissionTimeline";
import { SignalCards } from "@/components/vetor/SignalCards";
import { SystemNav } from "@/components/vetor/SystemNav";
import { Toaster } from "@/components/vetor/Toaster";
import { VerticalSelector } from "@/components/vetor/VerticalSelector";
import { VetorActivationController } from "@/components/vetor/activation/VetorActivationController";

export default function Home() {
  return (
    <VetorActivationController>
      <main className="scroll-smooth bg-background">
        <BootSequence />
        <SystemNav />
        <Hero />
        <Fragmentacao />
        <Comparativo />
        <AgentNetwork />
        <MissionTimeline />
        <CicloInteligencia />
        <VerticalSelector />
        <SignalCards />
        <CustoAgencia />
        <AutonomyPlans />
        <Faq />
        <FinalActivation />
        <Footer />
        <FloatingWhats />
        <Toaster position="top-center" />
      </main>
    </VetorActivationController>
  );
}
