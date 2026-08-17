export const metadata = { title: "Exclusão de Dados — Vetor" };

// Exigida pela Meta pro app "Vetor-App" — ainda nem cadastrada lá. Meta
// aceita duas formas: uma "Data Deletion Callback URL" (endpoint que recebe
// signed_request e devolve confirmation_code) ou uma "Data Deletion
// Instructions URL" simples como esta — mais rápida de colocar no ar
// corretamente agora; migrar pro callback automatizado é trabalho futuro se
// o volume de pedidos justificar.
export default function ExclusaoDadosPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-void px-6 py-16 text-foreground/90">
      <p className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">Vetor</p>
      <h1 className="mt-2 text-3xl font-bold text-foreground">Exclusão de dados</h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/75">
        <p>
          Se você conectou uma conta Meta (Facebook, Instagram ou WhatsApp Business) ao Vetor e quer que
          removamos os dados associados a essa conexão, siga um dos caminhos abaixo.
        </p>

        <section>
          <h2 className="text-base font-semibold text-foreground">Pelo painel do Vetor</h2>
          <p className="mt-1.5">
            Acesse Negócio → Conexões e clique em &ldquo;Desconectar&rdquo; na conta desejada. Isso revoga o acesso e marca
            a conexão como removida — o token de acesso é invalidado imediatamente.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">Por e-mail</h2>
          <p className="mt-1.5">
            Envie um e-mail para{" "}
            <a href="mailto:contato@vetormkt.online?subject=Exclus%C3%A3o%20de%20dados" className="text-cyan underline underline-offset-2">
              contato@vetormkt.online
            </a>{" "}
            com o assunto &ldquo;Exclusão de dados&rdquo;, informando o nome da empresa cadastrada. Processamos o pedido em
            até 15 dias úteis e confirmamos por e-mail quando concluído.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground">O que é removido</h2>
          <p className="mt-1.5">
            Tokens de acesso das contas conectadas, dados sincronizados a partir delas (métricas, conteúdo
            importado) e o vínculo da conexão. Dados de missões e conteúdo já gerado pelo Vetor para o cliente
            seguem a retenção normal descrita na{" "}
            <a href="/policy" className="text-cyan underline underline-offset-2">
              Política de Privacidade
            </a>
            , salvo pedido explícito de exclusão total da conta.
          </p>
        </section>
      </div>
    </main>
  );
}
