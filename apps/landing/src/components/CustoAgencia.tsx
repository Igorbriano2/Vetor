const EQUIPE = [
  { papel: "Designer", custo: 1800 },
  { papel: "Estrategista de marketing", custo: 2000 },
  { papel: "Social Media", custo: 1500 },
  { papel: "Editor de vídeo", custo: 1500 },
  { papel: "Copywriter / Redator", custo: 1200 },
  { papel: "Gestor de tráfego (fee de gestão)", custo: 1800 },
  { papel: "Atendente", custo: 2200 },
  { papel: "Ferramentas (design, agendamento, CRM, dashboard)", custo: 400 },
];

const TOTAL_EQUIPE = EQUIPE.reduce((soma, item) => soma + item.custo, 0);
const PRECO_VETOR = 1997;
const ECONOMIA = TOTAL_EQUIPE - PRECO_VETOR;
const ECONOMIA_PERCENTUAL = Math.round((ECONOMIA / TOTAL_EQUIPE) * 100);

function formatarReais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function CustoAgencia() {
  return (
    <section className="bg-areia py-20">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-2xl font-bold text-petroleo md:text-3xl">
          Quanto custa montar essa equipe sozinho
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-petroleo/70">
          Uma agência de marketing de verdade tem 7 especialistas por trás. No Vetor, os 7 são
          agentes de IA — sem contratar, treinar ou gerenciar ninguém. Valores abaixo são médias de
          mercado para contratação parcial no Brasil, não um preço fechado.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-2 md:items-start">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-petroleo">Montando a equipe por conta própria</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {EQUIPE.map((item) => (
                <li key={item.papel} className="flex items-center justify-between border-b border-petroleo/5 py-2 last:border-0">
                  <span className="text-petroleo/70">{item.papel}</span>
                  <span className="font-medium text-petroleo">{formatarReais(item.custo)}/mês</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-petroleo/10 pt-4">
              <span className="font-semibold text-petroleo">Total estimado</span>
              <span className="text-xl font-bold text-petroleo">{formatarReais(TOTAL_EQUIPE)}/mês</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl bg-petroleo p-6 text-areia shadow-lg">
            <div>
              <h3 className="font-semibold text-menta">Com o Vetor Completo</h3>
              <p className="mt-4 text-4xl font-bold">{formatarReais(PRECO_VETOR)}<span className="text-base font-normal text-areia/60">/mês</span></p>
              <p className="mt-2 text-sm text-areia/70">
                Os 7 especialistas, o painel de solicitação e o dashboard, tudo em uma ferramenta só.
              </p>
            </div>
            <div className="mt-6 rounded-xl bg-menta/10 p-4">
              <p className="text-sm text-areia/70">Você economiza</p>
              <p className="text-2xl font-bold text-menta">
                {formatarReais(ECONOMIA)}/mês <span className="text-base font-normal">({ECONOMIA_PERCENTUAL}%)</span>
              </p>
              <p className="mt-1 text-xs text-areia/50">
                Sem contar tempo de contratação, treinamento, turnover, férias e 13º de uma equipe própria.
              </p>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-petroleo/40">
          A verba investida em anúncios (Meta/Google) é sempre paga direto à plataforma de anúncios,
          em qualquer cenário — isso não entra nesta comparação de custo de operação.
        </p>
      </div>
    </section>
  );
}
