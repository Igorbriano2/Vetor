export const metadata = { title: "Termos de Serviço — Vetor" };

// Exigida pela Meta pro app "Vetor-App" — hoje https://vetormkt.online/terms
// aponta incorretamente pro facebook.com (ver comando de conexões oficiais).
// Conteúdo inicial cobre o essencial; revisar com jurídico antes do review.
export default function TermosServicoPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-void px-6 py-16 text-foreground/90">
      <p className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">Vetor</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">Termos de Serviço</h1>
      <p className="mt-2 text-sm text-foreground/50">Última atualização: 17 de agosto de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/75">
        <Secao titulo="1. Aceite">
          Ao usar o Vetor, o cliente concorda com estes termos. O serviço é fornecido para empresas que contratam
          a gestão de marketing via plataforma Vetor.
        </Secao>
        <Secao titulo="2. O que o Vetor faz">
          Coordena agentes de IA especialistas (design, tráfego, conteúdo, estratégia) para planejar e executar
          ações de marketing em nome do cliente, sempre com aprovação humana nas ações de risco médio/alto/crítico.
        </Secao>
        <Secao titulo="3. Conexões com contas externas">
          Ao conectar contas Meta (Facebook, Instagram, WhatsApp Business), o cliente autoriza o Vetor a agir
          dentro do escopo concedido no login oficial da Meta. O cliente pode revogar essa autorização a
          qualquer momento.
        </Secao>
        <Secao titulo="4. Limitação de responsabilidade">
          O Vetor não garante resultados de vendas, leads ou retorno sobre investimento — apresenta cenários e
          hipóteses baseados em dados disponíveis.
        </Secao>
        <Secao titulo="5. Cancelamento">
          O cliente pode cancelar a assinatura a qualquer momento; dados são tratados conforme nossa{" "}
          <a href="/policy" className="text-cyan underline underline-offset-2">
            Política de Privacidade
          </a>
          .
        </Secao>
        <Secao titulo="6. Contato">contato@vetormkt.online</Secao>
      </div>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
      <p className="mt-1.5">{children}</p>
    </section>
  );
}
