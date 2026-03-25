import data from '../data/vowelHarmony.json';
import type { Difficulty, Exercise } from './types';
import { matchesDifficulty, pickRandom, shuffle } from './util';

export function generateVowelHarmony(difficulty: Difficulty): Exercise {
  const pool = data.items.filter((i) => matchesDifficulty(i.difficulty, difficulty));
  const item = pickRandom(pool);
  const options = shuffle([item.correctAnswer, ...item.distractors]).slice(0, 4);
  const type = item.kind === 'classify' ? 'classify' : 'multipleChoice';
  return {
    id: item.id,
    module: 'vowelHarmony',
    type,
    difficulty: item.difficulty as Difficulty,
    prompt: item.prompt,
    options,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
  };
}
