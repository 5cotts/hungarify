import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

import {
  classifyLessonLineBody,
  type ParsedPhrase,
  type ParsedRule,
  type ParsedVocab,
} from './parseChat';

async function extractDocxText(absPath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: absPath });
  return result.value ?? '';
}

async function extractDocText(absPath: string): Promise<string> {
  const extractor = new WordExtractor();
  const extracted = await extractor.extract(absPath);
  const body = extracted.getBody();
  return typeof body === 'string' ? body : '';
}

export async function parseWordFile(options: {
  absPath: string;
  sourceFile: string;
  lesson: number | null;
  ext: '.doc' | '.docx';
}): Promise<{ vocab: ParsedVocab[]; phrases: ParsedPhrase[]; rules: ParsedRule[]; skippedLines: number }> {
  const text =
    options.ext === '.docx'
      ? await extractDocxText(options.absPath)
      : await extractDocText(options.absPath);

  const vocab: ParsedVocab[] = [];
  const phrases: ParsedPhrase[] = [];
  const rules: ParsedRule[] = [];
  let skippedLines = 0;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const body = lines[i]!.trim();
    if (!body) {
      skippedLines++;
      continue;
    }
    const c = classifyLessonLineBody(body);
    if (c.kind === 'vocab') {
      vocab.push({
        hu: c.hu,
        en: c.en,
        sourceFile: options.sourceFile,
        lineIndex: i + 1,
        lesson: options.lesson,
      });
      continue;
    }
    if (c.kind === 'phrase') {
      phrases.push({
        hu: c.hu,
        en: c.en,
        sourceFile: options.sourceFile,
        lineIndex: i + 1,
        lesson: options.lesson,
      });
      continue;
    }
    if (c.kind === 'rule') {
      rules.push({
        ruleText: c.ruleText,
        sourceFile: options.sourceFile,
        lineIndex: i + 1,
        lesson: options.lesson,
      });
      continue;
    }
    skippedLines++;
  }

  return { vocab, phrases, rules, skippedLines };
}
