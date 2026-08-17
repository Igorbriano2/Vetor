export const metadata = { title: "Política de Privacidade — Vetor" };

// Exigida pela Meta pro app "Vetor-App" (developers.facebook.com) — precisa
// estar no ar em https://vetormkt.online/policy antes de submeter o app pra
// App Review. Conteúdo inicial cobre o essencial (dados coletados, uso,
// integrações Meta, retenção, contato) — revisar com jurídico antes do
// review formal.
export default function PoliticaPrivacidadePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-void px-6 py-16 text-foreground/90">
      <p className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">Vetor</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-foreground/50">Última atualização: 17 de agosto de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/75">
        <Secao titulo="1. Quem somos">
          O Vetor é uma plataforma de gestão de marketing que atua em nome de empresas clientes, coordenando
          agentes de IA para planejar e executar ações de marketing digital.
        </Secao>
        <Secao titulo="2. Dados que coletamos">
          Dados cadastrais da empresa cliente (nome, contato, endereço), conteúdo enviado para operação (textos,
          imagens, marca), e — quando o cliente autoriza — dados de contas conectadas via login oficial da Meta
          (Facebook, Instagram, WhatsApp Business): identificadores de página/conta, métricas de campanhas e
          conteúdo publicado.
        </Secao>
        <Secao titulo="3. Como usamos os dados">
          Exclusivamente para operar a conta do cliente que autorizou a conexão: planejar e executar campanhas,
          gerar conteúdo, ler métricas de desempenho e reportar resultados. Nunca vendemos dados a terceiros.
        </Secao>
        <Secao titulo="4. Integrações com a Meta">
          Ao conectar uma conta Meta (Facebook/Instagram/WhatsApp Business), o Vetor recebe um token de acesso
          armazenado de forma criptografada, usado somente para as ações autorizadas pelo escopo concedido. O
          cliente pode revogar o acesso a qualquer momento, tanto pelo painel do Vetor quanto diretamente nas
          configurações de app conectados da Meta.
        </Secao>
        <Secao titulo="5. Retenção e exclusão">
          Dados são mantidos enquanto a conta estiver ativa. Para solicitar exclusão, veja nossa{" "}
          <a href="/data-deletion" className="text-cyan underline underline-offset-2">
            página de exclusão de dados
          </a>
          .
        </Secao>
        <Secao titulo="6. Contato">
          Dúvidas sobre esta política: contato@vetormkt.online
        </Secao>
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
