export const VAT_RATE = 0.15;

export const round = (n: number) => Math.round(n * 100) / 100;
export const toCents = (rands: number) => Math.round(rands * 100);

/**
 * Medicine is priced VAT-inclusive on the shelf in South Africa, so VAT is
 * backed out of the total rather than added to it. What the customer pays
 * matches the shelf label.
 */
export function vatFromInclusive(total: number) {
  return round(total - total / (1 + VAT_RATE));
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1

/** Reference safe to read aloud over a phone: RX-8K4M2P-2609 */
export function reference(prefix: 'APT' | 'RX' | 'ORD' | 'PAY' | 'POS') {
  let body = '';
  for (let i = 0; i < 6; i += 1) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${body}-${stamp}`;
}
