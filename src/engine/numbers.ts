import data from '../data/numbers.json';
import type { Difficulty, Exercise } from './types';
import { matchesDifficulty, pickRandom, shuffle } from './util';

export function generateNumbers(difficulty: Difficulty): Exercise {
  const pool = data.items.filter((i) => matchesDifficulty(i.difficulty, difficulty));
  const item = pickRandom(pool);
  if (item.kind === 'fillIn') {
    return {
      id: item.id,
      module: 'numbers',
      type: 'fillInBlank',
      difficulty: item.difficulty as Difficulty,
      prompt: item.prompt,
      correctAnswer: item.correctAnswer,
      explanation: item.explanation,
    };
  }
  const options = shuffle([item.correctAnswer, ...item.distractors]).slice(0, 4);
  return {
    id: item.id,
    module: 'numbers',
    type: 'multipleChoice',
    difficulty: item.difficulty as Difficulty,
    prompt: item.prompt,
    options,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
  };
}
