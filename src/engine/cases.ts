import casesData from '../data/cases.json';
import type { Difficulty, Exercise } from './types';
import { matchesDifficulty, pickRandom, shuffle } from './util';

export function generateCases(difficulty: Difficulty): Exercise {
  const pool = casesData.items.filter((i) => matchesDifficulty(i.difficulty, difficulty));
  const item = pickRandom(pool);
  const useMc = Math.random() < 0.55;
  const options = shuffle([item.correctAnswer, ...item.distractors]).slice(0, 4);
  if (useMc) {
    return {
      id: item.id,
      module: 'cases',
      type: 'multipleChoice',
      difficulty: item.difficulty as Difficulty,
      prompt: item.prompt,
      options,
      correctAnswer: item.correctAnswer,
      explanation: item.explanation,
    };
  }
  return {
    id: item.id,
    module: 'cases',
    type: 'fillInBlank',
    difficulty: item.difficulty as Difficulty,
    prompt: item.prompt,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
  };
}
