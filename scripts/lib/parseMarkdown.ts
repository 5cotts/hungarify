import { normalizeKey } from './normalize';

export type MdVocab = {
  hu: string;
  en: string;
  topic: string;
  sourceFile: string;
  lineIndex: number;
};

export type MdRule = {
  topic: string;
  ruleText: string;
  sourceFile: string;
  lineIndex: number;
};

function parseTableRow(line: string): [string, string] | null {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  const cells = t
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (cells.length < 2) return null;
  if (/^[-:]+$/.test(cells[0]!)) return null;
  const h0 = cells[0]!.toLowerCase();
  if (h0 === 'person' || h0 === 'case' || h0 === 'hungarian' || h0 === 'english') return null;

  if (cells.length >= 3) {
    const hu = cells[1]!;
    const en = cells[2]!;
    if (hu.length < 1 || en.length < 1) return null;
    return [hu, en];
  }

  const a = cells[0]!;
  const b = cells[1]!;
  if (a.length < 1 || b.length < 1) return null;
  return [a, b];
}

export function parseMarkdownFile(content: string, sourceFile: string): {
  vocab: MdVocab[];
  rules: MdRule[];
} {
  const vocab: MdVocab[] = [];
  const rules: MdRule[] = [];
  let currentTopic = sourceFile.replace(/\.md$/i, '');

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const h = line.match(/^#{1,3}\s+(.+)/);
    if (h) {
      currentTopic = h[1]!.trim();
      continue;
    }

    const row = parseTableRow(line);
    if (row) {
      const [a, b] = row;
      const aHu = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(a);
      const bHu = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(b);
      let hu = a;
      let en = b;
      if (!aHu && bHu) {
        hu = b;
        en = a;
      }
      vocab.push({
        hu,
        en,
        topic: currentTopic,
        sourceFile,
        lineIndex: i + 1,
      });
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet && bullet[1]!.length > 15) {
      rules.push({
        topic: currentTopic,
        ruleText: bullet[1]!.trim(),
        sourceFile,
        lineIndex: i + 1,
      });
    }
  }

  return { vocab, rules };
}

export function dedupeMdVocab(items: MdVocab[]): MdVocab[] {
  const seen = new Set<string>();
  const out: MdVocab[] = [];
  for (const v of items) {
    const k = `${normalizeKey(v.hu)}|${normalizeKey(v.en)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}
