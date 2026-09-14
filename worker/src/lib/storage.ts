// A trip document's storage key embeds the filename after a `__` separator
// (a uuid receipt id never contains one) so the original filename survives
// without needing its own database column.
export function storageKeyFor(orgId: string, tripId: string, receiptId: string, filename: string): string {
  return `${orgId}/${tripId}/${receiptId}__${filename}`;
}

export function filenameFromKey(key: string): string {
  const last = key.split('/').pop() ?? key;
  const sepIdx = last.lastIndexOf('__');
  return sepIdx >= 0 ? last.slice(sepIdx + 2) : last;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
