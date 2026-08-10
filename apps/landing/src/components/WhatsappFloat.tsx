import { linkWhatsapp } from "@/lib/whatsapp";

export default function WhatsappFloat() {
  return (
    <a
      href={linkWhatsapp("Oi! Quero conhecer o Vetor.")}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-menta px-4 py-3 text-sm font-semibold text-petroleo shadow-lg shadow-black/20 transition hover:bg-menta-forte hover:text-white"
      aria-label="Falar no WhatsApp"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.34a9.87 9.87 0 0 0 4.62 1.15h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2Zm5.79 14.05c-.24.68-1.4 1.31-1.93 1.36-.5.05-1.03.27-3.42-.71-2.9-1.2-4.75-4.15-4.9-4.34-.14-.19-1.17-1.56-1.17-2.98 0-1.42.74-2.11 1-2.4.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12.99 2.06 1.3 2.35 1.45.29.15.46.13.63-.08.17-.21.72-.84.92-1.13.19-.29.39-.24.65-.14.27.1 1.68.79 1.97.94.29.14.48.21.55.33.07.12.07.68-.17 1.36Z" />
      </svg>
      WhatsApp
    </a>
  );
}
