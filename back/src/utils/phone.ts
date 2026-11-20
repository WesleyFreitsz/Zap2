export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = `55${digits}`;
  }
  return digits;
}

export function withBrazilianNinthDigit(digits: string): string {
  return digits.replace(/^55(\d{2})([6-9]\d{7})$/, "55$19$2");
}
