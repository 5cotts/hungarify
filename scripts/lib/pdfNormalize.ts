/**
 * OCR-specific cleanup: soft hyphens, odd whitespace, obvious page noise.
 */
import { stripOcrInvisible } from './normalize';

/** NFC trim + remove invisible chars OCR often inserts */
export function cleanOcrLine(line: string): string {
  let s = line.normalize('NFC');
  s = stripOcrInvisible(s);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Join "word-\nword" hyphenation breaks into one line before splitting */
export function unwrapHyphenLineBreaks(text: string): string {
  return text.replace(/([a-záéíóöőúüűÁÉÍÓÖŐÚÜŰ])-\s*\n\s*([a-záéíóöőúüűÁÉÍÓÖŐÚÜŰ])/gi, '$1$2');
}

/** Normalize block text then split into physical lines */
export function splitOcrTextToLines(text: string): string[] {
  const merged = unwrapHyphenLineBreaks(text);
  const raw = merged.split(/\r?\n/);
  const out: string[] = [];
  for (const r of raw) {
    const s = cleanOcrLine(r);
    if (!s) continue;
    if (isLikelyPageNoise(s)) continue;
    out.push(s);
  }
  return dedupeRepeatedRuns(out, 4);
}

/** Single-line page numbers, very short all-caps headers */
function isLikelyPageNoise(s: string): boolean {
  if (s.length <= 1) return true;
  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(s)) return true;
  if (/^\d{1,4}$/.test(s)) return true;
  if (s.length < 4 && /^[A-Z0-9\s.]+$/.test(s)) return true;
  return false;
}

/** Collapse long runs of identical lines (duplicate OCR artifacts) to one copy */
function dedupeRepeatedRuns(lines: string[], minRepeat: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    let run = 1;
    let j = i + 1;
    while (j < lines.length && lines[j] === line) {
      run++;
      j++;
    }
    if (run >= minRepeat) {
      out.push(line);
    } else {
      for (let k = i; k < j; k++) out.push(lines[k]!);
    }
    i = j;
  }
  return out;
}
