const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 });

export const money = (amount: number | string) => zar.format(Number(amount));

export const shortDate = (date: Date | string) =>
  new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export const time = (date: Date | string) =>
  new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date));

export const VAT_RATE = 0.15;

/** Normalises 073…, 073 123 4567 and +27 73… to E.164. */
export function toE164(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return `+${digits}`;
}

export function age(dateOfBirth: string | Date | null) {
  if (!dateOfBirth) return null;
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / 31_557_600_000);
}
