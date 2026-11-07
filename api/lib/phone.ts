// Validação de telefone brasileiro. Identificadores internos do WhatsApp (@lid) têm 13 a 15 dígitos
// e parecem telefone; sem esta checagem o agente poderia tentar enviar para um número aleatório.
//   Celular: 55 + DDD (2 dígitos, sem zero) + 9 + 8 dígitos  = 13 dígitos
//   Fixo:    55 + DDD + [2-5] + 7 dígitos                      = 12 dígitos
const BR_PHONE = /^55[1-9][1-9](9\d{8}|[2-5]\d{7})$/;

export function isRealBrPhone(phone: string): boolean {
  return BR_PHONE.test(String(phone || '').replace(/\D/g, ''));
}

// Últimos 8 dígitos: iguais com ou sem o 9 do celular. Serve para achar o mesmo número em outro formato.
export function last8(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-8);
}
