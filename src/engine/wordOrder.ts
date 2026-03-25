import data from '../data/wordOrder.json';
import type { Difficulty, Exercise } from './types';
import { matchesDifficulty, pickRandom, shuffle } from './util';

export function generateWordOrder(difficulty: Difficulty): Exercise {
  const pool = data.items.filter((i) => matchesDifficulty(i.difficulty, difficulty));
  const item = pickRandom(pool);
  const correctOrder = [...item.correctOrder];
  const scrambled = shuffle([...correctOrder]);
  return {
    id: item.id,
    module: 'wordOrder',
    type: 'wordOrder',
    difficulty: item.difficulty as Difficulty,
    prompt: `${item.prompt}\n\n“${item.promptEnglish}”`,
    words: scrambled,
    correctWords: correctOrder,
    correctAnswer: correctOrder.join('|'),
    explanation: item.explanation,
  };
}
