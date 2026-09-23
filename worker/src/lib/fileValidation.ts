// Trip document uploads (fuel/toll receipts, invoices) are the one place a
// Driver can put attacker-controlled bytes in front of Office/Manager, who
// then open them. mimeType alone is a client-supplied claim — matching it
// against the file's actual magic bytes is what stops someone uploading an
// HTML/SVG payload labelled as a JPEG to get it served (and rendered) as
// something else entirely.

function bytesStartWith(bytes: Uint8Array, offset: number, ascii: string): boolean {
  if (bytes.length < offset + ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis', 'hevm', 'hevs'];

function isHeicLike(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || !bytesStartWith(bytes, 4, 'ftyp')) return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return HEIC_BRANDS.includes(brand);
}

const SIGNATURE_CHECKS: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length >= 8 && b[0] === 0x89 && bytesStartWith(b, 1, 'PNG\r\n\x1a\n'),
  'image/webp': (b) => bytesStartWith(b, 0, 'RIFF') && bytesStartWith(b, 8, 'WEBP'),
  'application/pdf': (b) => bytesStartWith(b, 0, '%PDF'),
  'image/heic': isHeicLike,
  'image/heif': isHeicLike
};

// The only content types a document is ever allowed to declare or be served
// as. Anything else — text/html, image/svg+xml, application/javascript, ...
// — is rejected outright rather than merely sniffed, since those are exactly
// the types a browser will execute as script when opened.
export const ALLOWED_DOCUMENT_MIME_TYPES = Object.keys(SIGNATURE_CHECKS) as [string, ...string[]];

export function matchesDeclaredType(mimeType: string, bytes: Uint8Array): boolean {
  const check = SIGNATURE_CHECKS[mimeType];
  return !!check && check(bytes);
}

// Strips characters that would let a filename break out of the
// Content-Disposition header value (quotes, CR/LF).
export function sanitizeFilenameForHeader(filename: string): string {
  return filename.replace(/["\r\n]/g, '_');
}
