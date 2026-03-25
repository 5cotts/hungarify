import { normalizeKey, stripNoise } from './normalize';

export type ParsedVocab = {
  hu: string;
  en: string;
  sourceFile: string;
  lineIndex: number;
  lesson: number | null;
  /** Set when ingested from PDF OCR */
  pageNumber?: number;
  ocrConfidence?: number;
};

export type ParsedPhrase = {
  hu: string;
  en: string | null;
  sourceFile: string;
  lineIndex: number;
  lesson: number | null;
  pageNumber?: number;
  ocrConfidence?: number;
};

export type ParsedRule = {
  ruleText: string;
  sourceFile: string;
  lineIndex: number;
  lesson: number | null;
  pageNumber?: number;
  ocrConfidence?: number;
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

export type LineClassification =
  | { kind: 'vocab'; hu: string; en: string }
  | { kind: 'phrase'; hu: string; en: null }
  | { kind: 'rule'; ruleText: string }
  | { kind: 'skip' };

/** Shared chat + OCR line heuristics (body text only, no timestamp prefix). */
export function classifyLessonLineBody(raw: string): LineClassification {
  const body = raw.trim();
  if (!body || stripNoise(body)) return { kind: 'skip' };

  const pair = parseHyphenPair(body);
  if (pair) return { kind: 'vocab', hu: pair.hu, en: pair.en };

  if (isHungarianSentence(body)) {
    const tokens = tokenizeForWordOrder(body);
    if (tokens.length >= 3) return { kind: 'phrase', hu: body, en: null };
    return { kind: 'skip' };
  }

  const low = body.toLowerCase();
  if (
    low.includes('verb stem') ||
    low.includes('conjugat') ||
    (low.includes('suffix') && body.length < 200)
  ) {
    return { kind: 'rule', ruleText: body };
  }

  return { kind: 'skip' };
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

    const c = classifyLessonLineBody(body);
    if (c.kind === 'vocab') {
      vocab.push({
        hu: c.hu,
        en: c.en,
        sourceFile,
        lineIndex: i + 1,
        lesson,
      });
      continue;
    }
    if (c.kind === 'phrase') {
      phrases.push({
        hu: c.hu,
        en: c.en,
        sourceFile,
        lineIndex: i + 1,
        lesson,
      });
      continue;
    }
    if (c.kind === 'rule') {
      rules.push({ ruleText: c.ruleText, sourceFile, lineIndex: i + 1, lesson });
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
