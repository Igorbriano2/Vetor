// landing (vetormkt.online) e painel (painel.vetormkt.online) são dois apps
// DigitalOcean/deploys separados — um href="/login" dentro da landing manda o
// visitante pra vetormkt.online/login, que nunca existiu aqui por design (login
// é responsabilidade do painel). PAINEL_URL como variável server-only já existe
// (usada pelo callback do Facebook em app/auth/facebook/callback/route.ts); esta
// versão NEXT_PUBLIC_ é só pros componentes client (nav, footer) que também
// precisam linkar pro painel.
export const PAINEL_URL = process.env.NEXT_PUBLIC_PAINEL_URL ?? "https://painel.vetormkt.online";
export const PAINEL_LOGIN_URL = `${PAINEL_URL}/login`;
