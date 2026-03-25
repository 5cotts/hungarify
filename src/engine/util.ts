import type { Difficulty } from './types';

const tierOrder: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

export function matchesDifficulty(itemDifficulty: string, requested: Difficulty): boolean {
  const cap = tierOrder.indexOf(requested);
  const item = tierOrder.indexOf(itemDifficulty as Difficulty);
  if (item < 0 || cap < 0) return false;
  return item <= cap;
}

export function pickRandom<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('pickRandom: empty array');
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase();
}
