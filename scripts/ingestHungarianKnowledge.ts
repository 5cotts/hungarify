/**
 * Build src/data/knowledge/*.json from knowledge-source/ (or KNOWLEDGE_SOURCE).
 * Run: npm run ingest:knowledge
 * PDF OCR: npm run ingest:knowledge -- --pdf [--pdf-max-pages=N] [--include=regex]
 * Incremental cache: --pdf-incremental --pdf-rebuild --pdf-cache-dir=<path>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  defaultSourceCacheDir,
  defaultSourceCachePath,
  getAllCachedPdfItems,
  loadSourceCache,
  removeNonPdfCacheEntries,
  removePdfCacheEntries,
  saveSourceCache,
  sourceFingerprintForFile,
  upsertNonPdfCacheEntry,
  upsertPdfCacheEntry,
} from './lib/sourceCache';
import { normalizeKey } from './lib/normalize';
import type { ParsedPhrase, ParsedRule, ParsedVocab } from './lib/parseChat';
import { dedupeVocab, parseChatFile } from './lib/parseChat';
import { dedupeMdVocab, parseMarkdownFile } from './lib/parseMarkdown';
import { parseWordFile } from './lib/parseWord';

const ROOT = process.cwd();
const DEFAULT_SOURCE = path.join(ROOT, 'knowledge-source');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'knowledge');

type LessonMeta = {
  id: string;
  lessonNumber: number;
  title: string;
  relativePath: string;
};

type SourceType = 'markdown' | 'chat' | 'pdf_ocr';

type VocabOut = {
  id: string;
  hu: string;
  en: string;
  lesson: number | null;
  tags: string[];
  sourceFile: string;
  lineIndex?: number;
  sourceType?: SourceType;
  pageNumber?: number;
  ocrConfidence?: number;
};

type RuleOut = {
  id: string;
  topic: string;
  ruleText: string;
  lesson: number | null;
  sourceFile: string;
  lineIndex?: number;
  sourceType?: SourceType;
  pageNumber?: number;
  ocrConfidence?: number;
};

type PhraseOut = {
  id: string;
  hu: string;
  en: string | null;
  lesson: number | null;
  sourceFile: string;
  lineIndex: number;
  sourceType?: SourceType;
  pageNumber?: number;
  ocrConfidence?: number;
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

type IngestCli = {
  pdf: boolean;
  pdfMaxPages?: number;
  include?: RegExp;
  pdfIncremental: boolean;
  pdfRebuild: boolean;
  sourceCacheDir?: string;
};

function parseIngestCli(argv: string[]): IngestCli {
  const pdf = argv.includes('--pdf');
  const pdfRebuild = argv.includes('--pdf-rebuild');
  let pdfIncremental = pdf;
  let pdfMaxPages: number | undefined;
  let include: RegExp | undefined;
  let sourceCacheDir: string | undefined;
  for (const a of argv) {
    if (a === '--pdf-incremental') {
      pdfIncremental = true;
    }
    if (a.startsWith('--pdf-max-pages=')) {
      const raw = a.slice('--pdf-max-pages='.length).trim();
      if (raw === '') continue;
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n >= 0) pdfMaxPages = n;
    }
    if (a.startsWith('--include=')) {
      const pat = a.slice('--include='.length);
      try {
        include = new RegExp(pat);
      } catch {
        console.warn('Invalid --include regex, ignoring:', pat);
      }
    }
    if (a.startsWith('--pdf-include=')) {
      const pat = a.slice('--pdf-include='.length);
      try {
        include = new RegExp(pat);
      } catch {
        console.warn('Invalid --pdf-include regex, ignoring:', pat);
      }
    }
    if (a.startsWith('--source-cache-dir=')) {
      const p = a.slice('--source-cache-dir='.length).trim();
      if (p) sourceCacheDir = path.resolve(p);
    }
    if (a.startsWith('--pdf-cache-dir=')) {
      const p = a.slice('--pdf-cache-dir='.length).trim();
      if (p) sourceCacheDir = path.resolve(p);
    }
  }
  return { pdf, pdfMaxPages, include, pdfIncremental, pdfRebuild, sourceCacheDir };
}

function vocabExplanation(v: VocabOut): string {
  const loc =
    v.pageNumber != null ? `${v.sourceFile} (p.${v.pageNumber})` : v.sourceFile;
  return `${v.en} → ${v.hu} (${loc})`;
}

async function main() {
  const cli = parseIngestCli(process.argv.slice(2));

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
  const cacheDir = cli.sourceCacheDir ?? defaultSourceCacheDir(ROOT);
  const cachePath = defaultSourceCachePath(cacheDir);
  const cache = loadSourceCache(cachePath);

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

  const knownNonPdf = relFiles.filter((rel) => {
    const ext = path.extname(rel).toLowerCase();
    if (ext === '.md') {
      const parts = rel.split(path.sep);
      return parts.length === 1;
    }
    if (ext === '.txt') {
      const base = path.basename(rel).toLowerCase();
      return base === 'chat.txt' || base.startsWith('chat');
    }
    if (ext === '.doc' || ext === '.docx') return true;
    return false;
  });
  const nonPdfRemoved = removeNonPdfCacheEntries(
    cache,
    Object.keys(cache.nonPdfEntries).filter((src) => !knownNonPdf.includes(src))
  );

  const nonPdfReport = {
    filesScanned: 0,
    cacheHits: 0,
    cacheMisses: 0,
    filesReprocessed: 0,
    filesRemoved: nonPdfRemoved,
  };

  for (const rel of relFiles) {
    if (cli.include && !cli.include.test(rel)) continue;
    const ext = path.extname(rel).toLowerCase();
    const fullPath = path.join(sourceRoot, rel);
    const parts = rel.split(path.sep);
    const first = parts[0]!;
    const lessonInfo = lessonFromDirName(first);
    const lessonNum = lessonInfo?.num ?? null;

    if (parts.length === 1 && ext === '.md') {
      nonPdfReport.filesScanned++;
      const fp = sourceFingerprintForFile(fullPath);
      const cached = cache.nonPdfEntries[rel];
      let mdV: ReturnType<typeof dedupeMdVocab>;
      let mr: ReturnType<typeof parseMarkdownFile>['rules'];
      if (cached && cached.sourceType === 'markdown' && cached.fingerprint === fp) {
        nonPdfReport.cacheHits++;
        mdV = dedupeMdVocab(cached.vocab);
        mr = cached.rules;
      } else {
        nonPdfReport.cacheMisses++;
        nonPdfReport.filesReprocessed++;
        const raw = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseMarkdownFile(raw, rel);
        mdV = dedupeMdVocab(parsed.vocab);
        mr = parsed.rules;
        upsertNonPdfCacheEntry(cache, {
          sourceFile: rel,
          sourceType: 'markdown',
          fingerprint: fp,
          vocab: mdV,
          rules: mr,
        });
      }
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
      nonPdfReport.filesScanned++;
      const fp = sourceFingerprintForFile(fullPath);
      const cached = cache.nonPdfEntries[rel];
      let vocab: ParsedVocab[];
      let phrases: ParsedPhrase[];
      let rules: ParsedRule[];
      let skippedLines: number;
      if (cached && cached.sourceType === 'chat' && cached.fingerprint === fp) {
        nonPdfReport.cacheHits++;
        vocab = cached.vocab;
        phrases = cached.phrases;
        rules = cached.rules;
        skippedLines = cached.skippedLines;
      } else {
        nonPdfReport.cacheMisses++;
        nonPdfReport.filesReprocessed++;
        const raw = fs.readFileSync(fullPath, 'utf8');
        const parsed = parseChatFile(raw, rel, lessonNum);
        vocab = parsed.vocab;
        phrases = parsed.phrases;
        rules = parsed.rules;
        skippedLines = parsed.skippedLines;
        upsertNonPdfCacheEntry(cache, {
          sourceFile: rel,
          sourceType: 'chat',
          fingerprint: fp,
          vocab,
          phrases,
          rules,
          skippedLines,
        });
      }
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

    if (ext === '.doc' || ext === '.docx') {
      nonPdfReport.filesScanned++;
      const fp = sourceFingerprintForFile(fullPath);
      const cached = cache.nonPdfEntries[rel];
      let vocab: ParsedVocab[];
      let phrases: ParsedPhrase[];
      let rules: ParsedRule[];
      let skippedLines: number;
      if (cached && cached.sourceType === 'word' && cached.fingerprint === fp) {
        nonPdfReport.cacheHits++;
        vocab = cached.vocab;
        phrases = cached.phrases;
        rules = cached.rules;
        skippedLines = cached.skippedLines;
      } else {
        nonPdfReport.cacheMisses++;
        nonPdfReport.filesReprocessed++;
        const parsed = await parseWordFile({
          absPath: fullPath,
          sourceFile: rel,
          lesson: lessonNum,
          ext: ext as '.doc' | '.docx',
        });
        vocab = parsed.vocab;
        phrases = parsed.phrases;
        rules = parsed.rules;
        skippedLines = parsed.skippedLines;
        upsertNonPdfCacheEntry(cache, {
          sourceFile: rel,
          sourceType: 'word',
          fingerprint: fp,
          vocab,
          phrases,
          rules,
          skippedLines,
        });
      }

      skippedChatLines += skippedLines;
      const dv = dedupeVocab(vocab);
      for (const v of dv) {
        vocabAll.push({
          id: nextId('v'),
          hu: v.hu,
          en: v.en,
          lesson: v.lesson,
          tags: ['word'],
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
          topic: 'word',
          ruleText: r.ruleText,
          lesson: r.lesson,
          sourceFile: r.sourceFile,
          lineIndex: r.lineIndex,
        });
      }
    }
  }

  const pdfReport = {
    enabled: cli.pdf,
    pdfFilesScanned: 0,
    pdfPagesOcrd: 0,
    pdfItemsExtracted: 0,
    pdfItemsKept: 0,
    pdfItemsDroppedLowConfidence: 0,
    sourceCacheHits: 0,
    sourceCacheMisses: 0,
    sourceFilesReprocessed: 0,
    sourceFilesRemoved: 0,
  };

  if (cli.pdf) {
    const { runPdfOcrIngest } = await import('./lib/parsePdf');
    const { terminateOcrWorker } = await import('./lib/ocr');
    const pdfRels = relFiles.filter((rel) => path.extname(rel).toLowerCase() === '.pdf').sort();
    const removed = removePdfCacheEntries(
      cache,
      Object.keys(cache.pdfEntries).filter((src) => !pdfRels.includes(src))
    );
    pdfReport.sourceFilesRemoved = removed;

    const selected = cli.include ? pdfRels.filter((r) => cli.include!.test(r)) : pdfRels;
    const reprocess: string[] = [];
    for (const rel of selected) {
      const abs = path.join(sourceRoot, rel);
      let fp = '';
      try {
        fp = sourceFingerprintForFile(abs);
      } catch {
        // unreadable file will be skipped in OCR stage
      }
      const entry = cache.pdfEntries[rel];
      if (!entry || entry.fingerprint !== fp || cli.pdfRebuild || !cli.pdfIncremental) {
        reprocess.push(rel);
        pdfReport.sourceCacheMisses++;
      } else {
        pdfReport.sourceCacheHits++;
      }
    }

    try {
      let pv: ParsedVocab[] = [];
      let pp: ParsedPhrase[] = [];
      let pr: ParsedRule[] = [];
      let stats = {
        pdfFilesScanned: selected.length,
        pdfPagesOcrd: 0,
        pdfItemsExtracted: 0,
        pdfItemsKept: 0,
        pdfItemsDroppedLowConfidence: 0,
      };
      if (reprocess.length > 0) {
        const out = await runPdfOcrIngest({
          sourceRoot,
          relFiles,
          targetPdfRels: reprocess,
          maxTotalPages: cli.pdfMaxPages,
        });
        pv = out.vocab;
        pp = out.phrases;
        pr = out.rules;
        stats = out.stats;
        pdfReport.sourceFilesReprocessed = reprocess.length;

        for (const rel of reprocess) {
          const abs = path.join(sourceRoot, rel);
          let fp = '';
          try {
            fp = sourceFingerprintForFile(abs);
          } catch {
            continue;
          }
          const byFile = out.bySourceFile[rel];
          upsertPdfCacheEntry(cache, {
            sourceFile: rel,
            fingerprint: fp,
            vocab: byFile?.vocab ?? [],
            phrases: byFile?.phrases ?? [],
            rules: byFile?.rules ?? [],
          });
        }
      }
      const cached = getAllCachedPdfItems(cache);
      pv = cached.vocab;
      pp = cached.phrases;
      pr = cached.rules;

      pdfReport.pdfFilesScanned = selected.length;
      pdfReport.pdfPagesOcrd = stats.pdfPagesOcrd;
      pdfReport.pdfItemsExtracted = stats.pdfItemsExtracted;
      pdfReport.pdfItemsKept = stats.pdfItemsKept;
      pdfReport.pdfItemsDroppedLowConfidence = stats.pdfItemsDroppedLowConfidence;

      const pdfVocab = dedupeVocab(
        pv.sort(
          (a, b) =>
            a.sourceFile.localeCompare(b.sourceFile) ||
            (a.pageNumber ?? 0) - (b.pageNumber ?? 0) ||
            a.lineIndex - b.lineIndex
        )
      );
      pp.sort(
        (a, b) =>
          a.sourceFile.localeCompare(b.sourceFile) ||
          (a.pageNumber ?? 0) - (b.pageNumber ?? 0) ||
          a.lineIndex - b.lineIndex
      );
      pr.sort(
        (a, b) =>
          a.sourceFile.localeCompare(b.sourceFile) ||
          (a.pageNumber ?? 0) - (b.pageNumber ?? 0) ||
          a.lineIndex - b.lineIndex
      );
      for (const v of pdfVocab) {
        vocabAll.push({
          id: nextId('v'),
          hu: v.hu,
          en: v.en,
          lesson: v.lesson,
          tags: ['pdf_ocr'],
          sourceFile: v.sourceFile,
          lineIndex: v.lineIndex,
          sourceType: 'pdf_ocr',
          pageNumber: v.pageNumber,
          ocrConfidence: v.ocrConfidence,
        });
      }
      for (const p of pp) {
        phrasesAll.push({
          id: nextId('p'),
          hu: p.hu,
          en: p.en,
          lesson: p.lesson,
          sourceFile: p.sourceFile,
          lineIndex: p.lineIndex,
          sourceType: 'pdf_ocr',
          pageNumber: p.pageNumber,
          ocrConfidence: p.ocrConfidence,
        });
      }
      for (const r of pr) {
        rulesAll.push({
          id: nextId('r'),
          topic: 'pdf_ocr',
          ruleText: r.ruleText,
          lesson: r.lesson,
          sourceFile: r.sourceFile,
          lineIndex: r.lineIndex,
          sourceType: 'pdf_ocr',
          pageNumber: r.pageNumber,
          ocrConfidence: r.ocrConfidence,
        });
      }
    } finally {
      await terminateOcrWorker();
    }
  }

  saveSourceCache(cachePath, cache);

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
      explanation: vocabExplanation(v),
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
      promptEnglish: p.sourceType === 'pdf_ocr' ? '(From PDF OCR)' : '(From your lesson chat)',
      words: shuffle([...tokens]),
      correctOrder: tokens,
      explanation: `Source: ${p.sourceFile}${p.pageNumber != null ? ` p.${p.pageNumber}` : ''} (line ${p.lineIndex})`,
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
    ingest: {
      nonPdf: nonPdfReport,
      pdf: pdfReport,
    },
    // Backward-compatible location for existing tooling.
    pdf: pdfReport,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'lessons.json'), JSON.stringify({ lessons }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'vocab.json'), JSON.stringify({ items: vocabDedup }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'rules.json'), JSON.stringify({ items: rulesAll }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'phrases.json'), JSON.stringify({ items: phrasesAll }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'drillSeeds.json'), JSON.stringify({ seeds }, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'ingestion-report.json'), JSON.stringify(report, null, 2));

  console.log(
    'Ingest complete:',
    report.counts,
    cli.pdf ? report.ingest : { nonPdf: report.ingest.nonPdf }
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
