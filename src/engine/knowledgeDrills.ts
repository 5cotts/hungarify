import drillData from '../data/knowledge/drillSeeds.json';
import type { Difficulty, Exercise, ModuleId } from './types';
import { matchesDifficulty, pickRandom, shuffle } from './util';

type VocabMcSeed = {
  id: string;
  kind: 'vocab_en_hu_mc';
  module: 'cases';
  difficulty: Difficulty;
  lesson: number | null;
  prompt: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
};

type WordOrderSeed = {
  id: string;
  kind: 'word_order';
  module: 'wordOrder';
  difficulty: Difficulty;
  lesson: number | null;
  prompt: string;
  promptEnglish: string;
  words: string[];
  correctOrder: string[];
  explanation: string;
};

type DrillSeed = VocabMcSeed | WordOrderSeed;

const seeds = (drillData as { seeds: DrillSeed[] }).seeds ?? [];

export function knowledgeDrillCount(): number {
  return seeds.length;
}

export function tryKnowledgeExercise(
  module: ModuleId,
  difficulty: Difficulty,
  lessonNumber?: number | null
): Exercise | null {
  let pool = seeds.filter((s) => s.module === module && matchesDifficulty(s.difficulty, difficulty));

  if (lessonNumber != null && lessonNumber > 0) {
    pool = pool.filter((s) => s.lesson === lessonNumber);
  }

  if (pool.length === 0) return null;

  const s = pickRandom(pool);

  if (s.kind === 'vocab_en_hu_mc') {
    const options = shuffle([s.correctAnswer, ...s.distractors]).slice(0, 4);
    return {
      id: s.id,
      module: s.module,
      type: 'multipleChoice',
      difficulty: s.difficulty,
      prompt: s.prompt,
      options,
      correctAnswer: s.correctAnswer,
      explanation: s.explanation,
    };
  }

  const scrambled = shuffle([...s.correctOrder]);
  return {
    id: s.id,
    module: 'wordOrder',
    type: 'wordOrder',
    difficulty: s.difficulty,
    prompt: `${s.prompt}\n\n“${s.promptEnglish}”`,
    words: scrambled,
    correctWords: [...s.correctOrder],
    correctAnswer: s.correctOrder.join('|'),
    explanation: s.explanation,
  };
}
