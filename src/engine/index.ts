import type { Difficulty, Exercise, ModuleId } from './types';
import { generateConjugation } from './conjugation';
import { generateCases } from './cases';
import { generateVowelHarmony } from './vowelHarmony';
import { generateWordOrder } from './wordOrder';
import { generateNumbers } from './numbers';
import { tryKnowledgeExercise } from './knowledgeDrills';
import { normalizeAnswer } from './util';

const generators: Record<ModuleId, (d: Difficulty) => Exercise> = {
  conjugation: generateConjugation,
  cases: generateCases,
  vowelHarmony: generateVowelHarmony,
  wordOrder: generateWordOrder,
  numbers: generateNumbers,
};

export type GenerateOptions = {
  /** When set, only knowledge drills tagged with this lesson number are used (if any). */
  lessonNumber?: number | null;
};

const KNOWLEDGE_MIX = 0.38;

export function generateExercise(
  module: ModuleId,
  difficulty: Difficulty,
  options?: GenerateOptions
): Exercise {
  if (Math.random() < KNOWLEDGE_MIX) {
    const k = tryKnowledgeExercise(module, difficulty, options?.lessonNumber);
    if (k) return k;
  }
  return generators[module](difficulty);
}

export function checkAnswer(exercise: Exercise, userAnswer: string | string[]): boolean {
  if (exercise.type === 'wordOrder' && Array.isArray(userAnswer)) {
    const expected = exercise.correctWords ?? exercise.correctAnswer.split('|');
    if (userAnswer.length !== expected.length) return false;
    return userAnswer.every((w, i) => normalizeAnswer(w) === normalizeAnswer(expected[i]!));
  }
  if (typeof userAnswer === 'string') {
    return normalizeAnswer(userAnswer) === normalizeAnswer(exercise.correctAnswer);
  }
  return false;
}

export type { ModuleId, Difficulty, Exercise } from './types';

export const MODULE_IDS: ModuleId[] = [
  'conjugation',
  'cases',
  'vowelHarmony',
  'wordOrder',
  'numbers',
];

export const MODULE_LABELS: Record<ModuleId, string> = {
  conjugation: 'Verb conjugation',
  cases: 'Noun cases',
  vowelHarmony: 'Vowel harmony',
  wordOrder: 'Word order',
  numbers: 'Numbers & time',
};

export function isModuleId(s: string): s is ModuleId {
  return MODULE_IDS.includes(s as ModuleId);
}
