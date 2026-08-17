import { linkWhatsapp } from "@/lib/whatsapp";
import { VetorMark } from "./system";

export function Footer() {
  return (
    <footer className="bg-void border-t border-border px-5 py-12 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-8 sm:grid-cols-3">
        <div>
          <VetorMark />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A agência de marketing que nunca dorme, nunca erra o funil e nunca cobra como agência
            grande.
          </p>
        </div>

        <nav aria-label="Institucional">
          <p className="text-sm font-semibold">Vetor</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="#verticais" className="hover:text-foreground">
                Para o seu negócio
              </a>
            </li>
            <li>
              <a href="#planos" className="hover:text-foreground">
                Planos
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-foreground">
                Perguntas frequentes
              </a>
            </li>
            <li>
              <a href="#ativar" className="hover:text-foreground">
                Falar com a gente
              </a>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold">Legal e redes</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href="/privacidade" className="hover:text-foreground">
                Política de privacidade
              </a>
            </li>
            <li>
              <a href="/termos" className="hover:text-foreground">
                Termos de uso
              </a>
            </li>
            <li>
              <a
                href={linkWhatsapp("Oi! Quero conhecer o Vetor.")}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-6xl border-t border-border pt-6 text-xs text-muted-foreground">
        <p>CNPJ a definir. Vetor é uma marca em fase de lançamento.</p>
        <p className="mt-1">© {new Date().getFullYear()} Vetor. Feito para negócio pequeno crescer.</p>
      </div>
    </footer>
  );
}
