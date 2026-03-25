/**
 * Discover PDFs under knowledge-source, render each page, OCR, normalize lines,
 * and extract vocab / phrases / rules using the same heuristics as chat ingest.
 */
import { createCanvas } from '@napi-rs/canvas';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ocrPngBuffer } from './ocr';
import { splitOcrTextToLines } from './pdfNormalize';
import { classifyLessonLineBody, type ParsedPhrase, type ParsedRule, type ParsedVocab } from './parseChat';
import type { PdfSourceExtract } from './sourceCache';

export type PdfTextChunk = {
  sourceFile: string;
  pageNumber: number;
  text: string;
  confidence: number;
  lessonNumber: number | null;
};

export type PdfOcrStats = {
  pdfFilesScanned: number;
  pdfPagesOcrd: number;
  pdfItemsExtracted: number;
  pdfItemsKept: number;
  pdfItemsDroppedLowConfidence: number;
};

function lessonFromDirName(name: string): { num: number; title: string } | null {
  const m = name.match(/^(\d+)\.\s*(.+)$/);
  if (!m) return null;
  return { num: parseInt(m[1]!, 10), title: m[2]!.trim() };
}

let pdfWorkerConfigured = false;

async function getPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfWorkerConfigured) {
    const workerPath = path.join(
      process.cwd(),
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    pdfWorkerConfigured = true;
  }
  return pdfjs;
}

async function renderPageToPngBuffer(
  page: { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: unknown) => { promise: Promise<void> } },
  scale: number
): Promise<Buffer> {
  const viewport = page.getViewport({ scale });
  const w = Math.max(1, Math.floor(viewport.width));
  const h = Math.max(1, Math.floor(viewport.height));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const task = page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvas,
  });
  await task.promise;
  return canvas.toBuffer('image/png');
}

function parsePageTextToItems(
  text: string,
  sourceFile: string,
  pageNumber: number,
  lesson: number | null,
  confidence: number
): { vocab: ParsedVocab[]; phrases: ParsedPhrase[]; rules: ParsedRule[]; extracted: number } {
  const lines = splitOcrTextToLines(text);
  const vocab: ParsedVocab[] = [];
  const phrases: ParsedPhrase[] = [];
  const rules: ParsedRule[] = [];
  let extracted = 0;

  for (let i = 0; i < lines.length; i++) {
    const body = lines[i]!;
    const c = classifyLessonLineBody(body);
    if (c.kind === 'skip') continue;
    extracted++;
    const lineIndex = i + 1;
    const base = { sourceFile, lineIndex, lesson, pageNumber, ocrConfidence: confidence };
    if (c.kind === 'vocab') {
      vocab.push({ hu: c.hu, en: c.en, ...base });
    } else if (c.kind === 'phrase') {
      phrases.push({ hu: c.hu, en: c.en, ...base });
    } else {
      rules.push({ ruleText: c.ruleText, ...base });
    }
  }

  return { vocab, phrases, rules, extracted };
}

const DEFAULT_MIN_PAGE_CONFIDENCE = 58;
const DEFAULT_RENDER_SCALE = 2;

export async function runPdfOcrIngest(options: {
  sourceRoot: string;
  relFiles: string[];
  maxTotalPages?: number;
  includeRegex?: RegExp;
  targetPdfRels?: string[];
  minPageConfidence?: number;
  renderScale?: number;
}): Promise<{
  vocab: ParsedVocab[];
  phrases: ParsedPhrase[];
  rules: ParsedRule[];
  chunks: PdfTextChunk[];
  bySourceFile: Record<string, PdfSourceExtract>;
  stats: PdfOcrStats;
}> {
  const minConf = options.minPageConfidence ?? DEFAULT_MIN_PAGE_CONFIDENCE;
  const scale = options.renderScale ?? DEFAULT_RENDER_SCALE;
  const maxPages = options.maxTotalPages;

  const pdfRels = (options.targetPdfRels
    ? [...options.targetPdfRels]
    : options.relFiles
        .filter((rel) => path.extname(rel).toLowerCase() === '.pdf')
        .filter((rel) => (options.includeRegex ? options.includeRegex.test(rel) : true))
  ).sort();

  const stats: PdfOcrStats = {
    pdfFilesScanned: pdfRels.length,
    pdfPagesOcrd: 0,
    pdfItemsExtracted: 0,
    pdfItemsKept: 0,
    pdfItemsDroppedLowConfidence: 0,
  };

  const vocab: ParsedVocab[] = [];
  const phrases: ParsedPhrase[] = [];
  const rules: ParsedRule[] = [];
  const chunks: PdfTextChunk[] = [];
  const bySourceFile: Record<string, PdfSourceExtract> = {};

  let pagesLeft = maxPages === undefined ? Number.POSITIVE_INFINITY : maxPages;
  const { getDocument } = await getPdfJs();

  for (const rel of pdfRels) {
    if (pagesLeft <= 0) break;

    const fullPath = path.join(options.sourceRoot, rel);
    const parts = rel.split(path.sep);
    const first = parts[0]!;
    const lessonInfo = lessonFromDirName(first);
    const lessonNum = lessonInfo?.num ?? null;

    let data: Uint8Array;
    try {
      data = new Uint8Array(fs.readFileSync(fullPath));
    } catch (e) {
      console.warn(`PDF OCR: could not read ${rel}:`, e);
      continue;
    }

    let pdf: { numPages: number; getPage: (n: number) => Promise<unknown> };
    try {
      const loadingTask = getDocument({ data, disableFontFace: true });
      pdf = (await loadingTask.promise) as typeof pdf;
    } catch (e) {
      console.warn(`PDF OCR: could not open ${rel}:`, e);
      continue;
    }

    const numPages = pdf.numPages;
    for (let p = 1; p <= numPages && pagesLeft > 0; p++) {
      try {
        const page = (await pdf.getPage(p)) as Parameters<typeof renderPageToPngBuffer>[0];
        const png = await renderPageToPngBuffer(page, scale);
        const { text, confidence } = await ocrPngBuffer(png);
        stats.pdfPagesOcrd++;
        pagesLeft--;

        chunks.push({
          sourceFile: rel,
          pageNumber: p,
          text,
          confidence,
          lessonNumber: lessonNum,
        });

        const parsed = parsePageTextToItems(text, rel, p, lessonNum, confidence);
        stats.pdfItemsExtracted += parsed.extracted;

        if (confidence < minConf) {
          stats.pdfItemsDroppedLowConfidence += parsed.extracted;
          continue;
        }

        stats.pdfItemsKept += parsed.extracted;
        vocab.push(...parsed.vocab);
        phrases.push(...parsed.phrases);
        rules.push(...parsed.rules);

        if (!bySourceFile[rel]) {
          bySourceFile[rel] = {
            sourceFile: rel,
            // Fingerprint is set by cache layer.
            fingerprint: '',
            vocab: [],
            phrases: [],
            rules: [],
          };
        }
        bySourceFile[rel]!.vocab.push(...parsed.vocab);
        bySourceFile[rel]!.phrases.push(...parsed.phrases);
        bySourceFile[rel]!.rules.push(...parsed.rules);
      } catch (e) {
        console.warn(`PDF OCR: page ${p} of ${rel} failed:`, e);
      }
    }
  }

  return { vocab, phrases, rules, chunks, bySourceFile, stats };
}
