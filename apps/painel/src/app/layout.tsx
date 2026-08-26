import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

// Design V2 Fase F (docs/AUDITORIA-E-PROMPT-RECONSTRUCAO-2026-08.md) —
// Inter era a fonte mais citada em auditorias de design como "genérica
// demais pra IA"; Geist (self-hosted via next/font/local por baixo do
// pacote, licença OFL, sem CDN — mesmo requisito que já valia pras fontes
// de marca acima) tem mais caráter e é a referência real de "premium/tech"
// que a Vercel usa. A variável CSS que o pacote gera é fixa
// (--font-geist-sans, ver node_modules/geist/dist/sans.js) — globals.css
// aponta --font-sans pra ela.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Painel Vetor",
  description: "Acompanhe suas demandas, entregas e relatórios da Vetor.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${GeistSans.variable} ${jetbrainsMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
