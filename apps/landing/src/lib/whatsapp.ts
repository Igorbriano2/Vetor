const NUMERO_WHATSAPP = "5511999999999";

export function linkWhatsapp(mensagem: string) {
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
}
