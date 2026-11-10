import { randomInt } from 'crypto';

// Crockford base32: digits and uppercase letters without I, L, O and U, so an
// ID read off a hanko cannot be mistyped as a look-alike character
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
// 55 random bits. The approval ID is encoded in the web hanko's QR code
// (qrcode-svg, byte mode, ECL M), and 11 characters is the most that still
// fits the smallest 21x21 code; a UUID needs 29x29.
const LENGTH = 11;

// Short IDs for approvals and rejections
export const generate_short_id = (): string => {
  let id = '';
  for (let i = 0; i < LENGTH; i++) id += ALPHABET[randomInt(ALPHABET.length)];
  // An all-digit ID could match a legacy integer ID in query_with_hanko_id
  return /[A-Z]/.test(id) ? id : generate_short_id();
};
