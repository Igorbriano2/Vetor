import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import WhatsappFloat from "@/components/WhatsappFloat";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vetor — a agência de marketing que nunca dorme",
  description:
    "Vetor é a agência de marketing operada por agentes de IA especializados: atendimento, tráfego, design e social media, disponível 24 horas, supervisionada por gente que entende do seu negócio.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} antialiased`}>
        {children}
        <WhatsappFloat />
      </body>
    </html>
  );
}
