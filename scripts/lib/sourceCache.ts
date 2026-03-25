import * as fs from 'node:fs';
import * as path from 'node:path';

import type { MdRule, MdVocab } from './parseMarkdown';
import type { ParsedPhrase, ParsedRule, ParsedVocab } from './parseChat';

export type PdfSourceExtract = {
  sourceFile: string;
  fingerprint: string;
  vocab: ParsedVocab[];
  phrases: ParsedPhrase[];
  rules: ParsedRule[];
};

export type NonPdfSourceExtract =
  | {
      sourceFile: string;
      sourceType: 'markdown';
      fingerprint: string;
      vocab: MdVocab[];
      rules: MdRule[];
    }
  | {
      sourceFile: string;
      sourceType: 'chat';
      fingerprint: string;
      vocab: ParsedVocab[];
      phrases: ParsedPhrase[];
      rules: ParsedRule[];
      skippedLines: number;
    }
  | {
      sourceFile: string;
      sourceType: 'word';
      fingerprint: string;
      vocab: ParsedVocab[];
      phrases: ParsedPhrase[];
      rules: ParsedRule[];
      skippedLines: number;
    };

export type SourceCacheFile = {
  version: 1;
  updatedAt: string;
  pdfEntries: Record<string, PdfSourceExtract>;
  nonPdfEntries: Record<string, NonPdfSourceExtract>;
};

const CACHE_VERSION = 1 as const;

function emptyCache(): SourceCacheFile {
  return {
    version: CACHE_VERSION,
    updatedAt: new Date(0).toISOString(),
    pdfEntries: {},
    nonPdfEntries: {},
  };
}

export function defaultSourceCacheDir(rootDir: string): string {
  return path.join(rootDir, 'scripts', '.cache', 'knowledge-ingest');
}

export function defaultSourceCachePath(cacheDir: string): string {
  return path.join(cacheDir, 'source-cache.json');
}

export function sourceFingerprintForFile(absPath: string): string {
  const st = fs.statSync(absPath);
  return `${st.size}:${Math.trunc(st.mtimeMs)}`;
}

export function loadSourceCache(cachePath: string): SourceCacheFile {
  if (!fs.existsSync(cachePath)) return emptyCache();
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    const parsed = JSON.parse(raw) as SourceCacheFile;
    if (
      !parsed ||
      parsed.version !== CACHE_VERSION ||
      typeof parsed.pdfEntries !== 'object' ||
      typeof parsed.nonPdfEntries !== 'object'
    ) {
      return emptyCache();
    }
    return parsed;
  } catch {
    return emptyCache();
  }
}

export function saveSourceCache(cachePath: string, cache: SourceCacheFile): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const out: SourceCacheFile = {
    version: CACHE_VERSION,
    updatedAt: new Date().toISOString(),
    pdfEntries: cache.pdfEntries,
    nonPdfEntries: cache.nonPdfEntries,
  };
  fs.writeFileSync(cachePath, JSON.stringify(out, null, 2));
}

export function upsertPdfCacheEntry(cache: SourceCacheFile, entry: PdfSourceExtract): void {
  cache.pdfEntries[entry.sourceFile] = entry;
}

export function upsertNonPdfCacheEntry(cache: SourceCacheFile, entry: NonPdfSourceExtract): void {
  cache.nonPdfEntries[entry.sourceFile] = entry;
}

export function removePdfCacheEntries(cache: SourceCacheFile, sourceFiles: string[]): number {
  let removed = 0;
  for (const src of sourceFiles) {
    if (cache.pdfEntries[src]) {
      delete cache.pdfEntries[src];
      removed++;
    }
  }
  return removed;
}

export function removeNonPdfCacheEntries(cache: SourceCacheFile, sourceFiles: string[]): number {
  let removed = 0;
  for (const src of sourceFiles) {
    if (cache.nonPdfEntries[src]) {
      delete cache.nonPdfEntries[src];
      removed++;
    }
  }
  return removed;
}

export function getAllCachedPdfItems(cache: SourceCacheFile): {
  vocab: ParsedVocab[];
  phrases: ParsedPhrase[];
  rules: ParsedRule[];
} {
  const keys = Object.keys(cache.pdfEntries).sort();
  const vocab: ParsedVocab[] = [];
  const phrases: ParsedPhrase[] = [];
  const rules: ParsedRule[] = [];
  for (const k of keys) {
    const e = cache.pdfEntries[k]!;
    vocab.push(...e.vocab);
    phrases.push(...e.phrases);
    rules.push(...e.rules);
  }
  return { vocab, phrases, rules };
}
