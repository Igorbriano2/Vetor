import { linkWhatsapp } from "@/lib/whatsapp";

export function FloatingWhats() {
  return (
    <a
      href={linkWhatsapp("Oi! Quero conhecer o Vetor.")}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com o Vetor no WhatsApp"
      className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.52 3.76 1.42 5.32L2 22l4.98-1.58a9.8 9.8 0 0 0 5.06 1.4h.01c5.43 0 9.83-4.4 9.83-9.84C21.88 6.4 17.48 2 12.04 2Zm5.72 13.9c-.24.68-1.4 1.3-1.94 1.34-.5.05-1.12.24-3.66-.77-3.08-1.22-5.03-4.36-5.18-4.56-.15-.2-1.24-1.65-1.24-3.15 0-1.5.78-2.24 1.06-2.54.28-.3.6-.38.8-.38h.58c.18 0 .44-.07.68.52.24.6.84 2.06.9 2.2.07.15.11.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.3.75 1.24 1.62 2.01 1.11 1 2.05 1.3 2.35 1.45.3.15.47.13.64-.08.17-.2.74-.86.94-1.16.2-.3.4-.25.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.35.07.13.07.75-.17 1.43Z" />
      </svg>
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </a>
  );
}
