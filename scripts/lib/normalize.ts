/** Unicode NFC + trim + lowercase for dedup keys */
export function normalizeKey(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

/** Remove soft hyphens and zero-width chars common in OCR output */
export function stripOcrInvisible(s: string): string {
  return s.replace(/\u00AD/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
}

export function stripNoise(line: string): boolean {
  const l = line.toLowerCase();
  if (l.includes('http://') || l.includes('https://')) return true;
  if (l.includes('zoom.us') || l.includes('meeting id') || l.includes('passcode')) return true;
  if (l.includes('proton mail') && l.includes('inbox')) return true;
  return false;
}
