/**
 * Build src/data/knowledge/*.json from knowledge-source/ (or KNOWLEDGE_SOURCE).
 * Run: npm run ingest:knowledge
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { normalizeKey } from './lib/normalize';
import { dedupeVocab, parseChatFile } from './lib/parseChat';
import { dedupeMdVocab, parseMarkdownFile } from './lib/parseMarkdown';

const ROOT = process.cwd();
const DEFAULT_SOURCE = path.join(ROOT, 'knowledge-source');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'knowledge');

type LessonMeta = {
  id: string;
  lessonNumber: number;
  title: string;
  relativePath: string;
};

type VocabOut = {
  id: string;
  hu: string;
  en: string;
  lesson: number | null;
  tags: string[];
  sourceFile: string;
  lineIndex?: number;
};

type RuleOut = {
  id: string;
  topic: string;
  ruleText: string;
  lesson: number | null;
  sourceFile: string;
  lineIndex?: number;
};

type PhraseOut = {
  id: string;
  hu: string;
  en: string | null;
  lesson: number | null;
  sourceFile: string;
  lineIndex: number;
};

type DrillSeed =
  | {
      id: string;
      kind: 'vocab_en_hu_mc';
      module: 'cases';
      difficulty: 'beginner' | 'intermediate' | 'advanced';
      lesson: number | null;
      prompt: string;
      correctAnswer: string;
      distractors: string[];
      explanation: string;
    }
  | {
      id: string;
      kind: 'word_order';
      module: 'wordOrder';
      difficulty: 'beginner' | 'intermediate' | 'advanced';
      lesson: number | null;
      prompt: string;
      promptEnglish: string;
      words: string[];
      correctOrder: string[];
      explanation: string;
    };

function lessonFromDirName(name: string): { num: number; title: string } | null {
  const m = name.match(/^(\d+)\.\s*(.+)$/);
  if (!m) return null;
  return { num: parseInt(m[1]!, 10), title: m[2]!.trim() };
}

function walkFiles(dir: string, base: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(base, full);
    if (ent.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pickDistractors(
  correct: string,
  pool: string[],
  lesson: number | null,
  byLesson: Map<string, string[]>,
  count: number
): string[] {
  const none = byLesson.get('none') ?? [];
  const preferred =
    lesson != null
      ? [...(byLesson.get(String(lesson)) ?? []), ...none]
      : [...pool];
  const filtered = preferred.filter((h) => normalizeKey(h) !== normalizeKey(correct));
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const h of shuffle(filtered)) {
    const k = normalizeKey(h);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(h);
    if (uniq.length >= count) break;
  }
  return uniq;
}

function difficultyForVocab(hu: string): 'beginner' | 'intermediate' | 'advanced' {
  if (hu.length <= 12) return 'beginner';
  if (hu.length <= 22) return 'intermediate';
  return 'advanced';
}

function difficultyForWordOrder(n: number): 'beginner' | 'intermediate' | 'advanced' {
  if (n <= 5) return 'beginner';
  if (n <= 8) return 'intermediate';
  return 'advanced';
}

function main() {
  const sourceRoot = process.env.KNOWLEDGE_SOURCE
    ? path.resolve(process.env.KNOWLEDGE_SOURCE)
    : DEFAULT_SOURCE;

  if (!fs.existsSync(sourceRoot)) {
    console.error(
      `Ingest: knowledge source not found:\n  ${sourceRoot}\n` +
        `Create a directory or symlink at ./knowledge-source, or set KNOWLEDGE_SOURCE.`
    );
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const lessons: LessonMeta[] = [];
  const vocabAll: VocabOut[] = [];
  const rulesAll: RuleOut[] = [];
  const phrasesAll: PhraseOut[] = [];
  let skippedChatLines = 0;
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  const relFiles = walkFiles(sourceRoot, sourceRoot);

  for (const rel of relFiles) {
    const parts = rel.split(path.sep);
    const first = parts[0]!;
    const lessonInfo = lessonFromDirName(first);
    if (lessonInfo && parts.length >= 2) {
      const lessonPath = path.join(sourceRoot, first);
      if (!lessons.some((l) => l.lessonNumber === lessonInfo.num)) {
        lessons.push({
          id: `lesson-${lessonInfo.num}`,
          lessonNumber: lessonInfo.num,
          title: lessonInfo.title,
          relativePath: first,
        });
      }
    }
  }
  lessons.sort((a, b) => a.lessonNumber - b.lessonNumber);

  for (const rel of relFiles) {
    const ext = path.extname(rel).toLowerCase();
    const fullPath = path.join(sourceRoot, rel);
    const parts = rel.split(path.sep);
    const first = parts[0]!;
    const lessonInfo = lessonFromDirName(first);
    const lessonNum = lessonInfo?.num ?? null;

    if (parts.length === 1 && ext === '.md') {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const { vocab: mv, rules: mr } = parseMarkdownFile(raw, rel);
      const mdV = dedupeMdVocab(mv);
      for (const v of mdV) {
        vocabAll.push({
          id: nextId('v'),
          hu: v.hu,
          en: v.en,
          lesson: null,
          tags: ['markdown', v.topic.slice(0, 40)],
          sourceFile: v.sourceFile,
          lineIndex: v.lineIndex,
        });
      }
      for (const r of mr) {
        rulesAll.push({
          id: nextId('r'),
          topic: r.topic,
          ruleText: r.ruleText,
          lesson: null,
          sourceFile: r.sourceFile,
          lineIndex: r.lineIndex,
        });
      }
      continue;
    }

    const base = path.basename(rel).toLowerCase();
    if (ext === '.txt' && (base === 'chat.txt' || base.startsWith('chat'))) {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const { vocab, phrases, rules, skippedLines } = parseChatFile(raw, rel, lessonNum);
      skippedChatLines += skippedLines;
      const dv = dedupeVocab(vocab);
      for (const v of dv) {
        vocabAll.push({
          id: nextId('v'),
          hu: v.hu,
          en: v.en,
          lesson: v.lesson,
          tags: ['chat'],
          sourceFile: v.sourceFile,
          lineIndex: v.lineIndex,
        });
      }
      for (const p of phrases) {
        phrasesAll.push({
          id: nextId('p'),
          hu: p.hu,
          en: p.en,
          lesson: p.lesson,
          sourceFile: p.sourceFile,
          lineIndex: p.lineIndex,
        });
      }
      for (const r of rules) {
        rulesAll.push({
          id: nextId('r'),
          topic: 'chat',
          ruleText: r.ruleText,
          lesson: r.lesson,
          sourceFile: r.sourceFile,
          lineIndex: r.lineIndex,
        });
      }
    }
  }

  const vocabDedup: VocabOut[] = [];
  const vseen = new Set<string>();
  for (const v of vocabAll) {
    const k = `${normalizeKey(v.hu)}|${normalizeKey(v.en)}`;
    if (vseen.has(k)) continue;
    vseen.add(k);
    vocabDedup.push(v);
  }

  const huPool = vocabDedup.map((v) => v.hu);
  const byLesson = new Map<string, string[]>();
  for (const v of vocabDedup) {
    const key = v.lesson == null ? 'none' : String(v.lesson);
    if (!byLesson.has(key)) byLesson.set(key, []);
    byLesson.get(key)!.push(v.hu);
  }

  const seeds: DrillSeed[] = [];

  for (const v of vocabDedup) {
    const distractors = pickDistractors(v.hu, huPool, v.lesson, byLesson, 5).slice(0, 3);
    if (distractors.length < 3) continue;
    seeds.push({
      id: nextId('d'),
      kind: 'vocab_en_hu_mc',
      module: 'cases',
      difficulty: difficultyForVocab(v.hu),
      lesson: v.lesson,
      prompt: `Translate to Hungarian: “${v.en}”`,
      correctAnswer: v.hu,
      distractors: shuffle(distractors).slice(0, 3),
      explanation: `${v.en} → ${v.hu} (${v.sourceFile})`,
    });
  }

  for (const p of phrasesAll) {
    const inner = p.hu.replace(/[.!?]+$/g, '').trim();
    const tokens = inner.split(/\s+/).filter(Boolean);
    if (tokens.length < 3 || tokens.length > 14) continue;
    seeds.push({
      id: nextId('d'),
      kind: 'word_order',
      module: 'wordOrder',
      difficulty: difficultyForWordOrder(tokens.length),
      lesson: p.lesson,
      prompt: 'Arrange the words into a correct Hungarian sentence:',
      promptEnglish: '(From your lesson chat)',
      words: shuffle([...tokens]),
      correctOrder: tokens,
      explanation: `Source: ${p.sourceFile} (line ${p.lineIndex})`,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    counts: {
      lessons: lessons.length,
      vocab: vocabDedup.length,
      rules: rulesAll.length,
      phrases: phrasesAll.length,
      drillSeeds: seeds.length,
      skippedChatLines,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, 'lessons.json'), JSON.stringify({ lessons }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'vocab.json'), JSON.stringify({ items: vocabDedup }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'rules.json'), JSON.stringify({ items: rulesAll }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'phrases.json'), JSON.stringify({ items: phrasesAll }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'drillSeeds.json'), JSON.stringify({ seeds }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'ingestion-report.json'), JSON.stringify(report, null, 2));

  console.log('Ingest complete:', report.counts);
}

main();
