export function parseGameSharkCode(raw: string): { valid: boolean; normalized: string } {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  const isHex16 = /^[0-9A-F]{16}$/.test(compact);
  if (!isHex16) {
    return { valid: false, normalized: '' };
  }
  const normalized = `${compact.slice(0, 8)} ${compact.slice(8, 16)}`;
  return { valid: true, normalized };
}
