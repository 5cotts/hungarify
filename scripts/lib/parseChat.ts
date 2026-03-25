import { normalizeKey, stripNoise } from './normalize';

export type ParsedVocab = {
  hu: string;
  en: string;
  sourceFile: string;
  lineIndex: number;
  lesson: number | null;
};

export type ParsedPhrase = {
  hu: string;
  en: string | null;
  sourceFile: string;
  lineIndex: number;
  lesson: number | null;
};

export type ParsedRule = {
  ruleText: string;
  sourceFile: string;
  lineIndex: number;
  lesson: number | null;
};

const LINE_RE =
  /^(\d{1,2}:\d{2}:\d{2})\s+From\s+[^:]+:\s*(.*)$/;

function hasHungarianChars(s: string): boolean {
  return /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(s);
}

/** Heuristic: single hyphen pair vocabulary gloss */
export function parseHyphenPair(raw: string): { hu: string; en: string } | null {
  const text = raw.trim();
  if (!text.includes('-') || text.includes(' - ')) return null;
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const a = parts[0]!.trim();
  const b = parts[1]!.trim();
  if (a.length < 2 || b.length < 2) return null;
  if (a.length > 90 || b.length > 120) return null;

  const aHu = hasHungarianChars(a);
  const bHu = hasHungarianChars(b);
  const aLatinOnly = /^[a-zA-Z\s,;.0-9'"/]+$/.test(a);
  const bLatinOnly = /^[a-zA-Z\s,;.0-9'"/]+$/.test(b);

  if (aHu && bLatinOnly && !bHu) return { hu: a, en: b };
  if (bHu && aLatinOnly && !aHu) return { hu: b, en: a };
  if (aHu && !bHu) return { hu: a, en: b };
  if (!aHu && bHu) return { hu: b, en: a };
  return { hu: a, en: b };
}

function isHungarianSentence(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  if (!/[.!?]$/.test(t)) return false;
  if (!hasHungarianChars(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 3 && words.length <= 24;
}

function tokenizeForWordOrder(sentence: string): string[] {
  const inner = sentence.replace(/[.!?]+$/g, '').trim();
  return inner.split(/\s+/).filter((w) => w.length > 0);
}

export function parseChatFile(
  content: string,
  sourceFile: string,
  lesson: number | null
): { vocab: ParsedVocab[]; phrases: ParsedPhrase[]; rules: ParsedRule[]; skippedLines: number } {
  const vocab: ParsedVocab[] = [];
  const phrases: ParsedPhrase[] = [];
  const rules: ParsedRule[] = [];
  let skippedLines = 0;

  const lines = content.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = line.match(LINE_RE);
    const body = m ? m[2]!.trim() : line.trim();
    if (!body || stripNoise(body)) {
      skippedLines++;
      continue;
    }

    const pair = parseHyphenPair(body);
    if (pair) {
      vocab.push({
        hu: pair.hu,
        en: pair.en,
        sourceFile,
        lineIndex: i + 1,
        lesson,
      });
      continue;
    }

    if (isHungarianSentence(body)) {
      const tokens = tokenizeForWordOrder(body);
      if (tokens.length >= 3) {
        phrases.push({
          hu: body,
          en: null,
          sourceFile,
          lineIndex: i + 1,
          lesson,
        });
      } else skippedLines++;
      continue;
    }

    const low = body.toLowerCase();
    if (
      low.includes('verb stem') ||
      low.includes('conjugat') ||
      (low.includes('suffix') && body.length < 200)
    ) {
      rules.push({ ruleText: body, sourceFile, lineIndex: i + 1, lesson });
      continue;
    }

    skippedLines++;
  }

  return { vocab, phrases, rules, skippedLines };
}

export function dedupeVocab(items: ParsedVocab[]): ParsedVocab[] {
  const seen = new Set<string>();
  const out: ParsedVocab[] = [];
  for (const v of items) {
    const k = `${normalizeKey(v.hu)}|${normalizeKey(v.en)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}
