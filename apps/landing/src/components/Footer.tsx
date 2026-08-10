export default function Footer() {
  return (
    <footer className="bg-petroleo py-10 text-sm text-areia/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Vetor. Todos os direitos reservados.</p>
        <div className="flex flex-wrap gap-4">
          <a href="/privacidade" className="hover:text-areia">
            Política de privacidade
          </a>
          <a href="/termos" className="hover:text-areia">
            Termos de uso
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-areia">
            Instagram
          </a>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-6xl px-6 text-xs text-areia/40">
        CNPJ a definir. Vetor é uma marca em fase de lançamento — dados de contato oficiais serão
        publicados aqui antes da abertura comercial.
      </p>
    </footer>
  );
}
