/** Unicode NFC + trim + lowercase for dedup keys */
export function normalizeKey(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

export function stripNoise(line: string): boolean {
  const l = line.toLowerCase();
  if (l.includes('http://') || l.includes('https://')) return true;
  if (l.includes('zoom.us') || l.includes('meeting id') || l.includes('passcode')) return true;
  if (l.includes('proton mail') && l.includes('inbox')) return true;
  return false;
}
