/**
 * Web build: avoid importing expo-sqlite (its worker expects wa-sqlite.wasm, which is not
 * shipped in the npm package in a Metro-resolvable way). Use localStorage instead.
 */
import type { ModuleId } from '@/src/engine/types';

const STORAGE_KEY = 'hungarify_attempts_v1';

type AttemptRow = {
  id: number;
  module: ModuleId;
  exercise_key: string;
  correct: number;
  timestamp: string;
};

function readAttempts(): AttemptRow[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AttemptRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAttempts(rows: AttemptRow[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* quota or private mode */
  }
}

export async function recordAttempt(
  module: ModuleId,
  exerciseKey: string,
  correct: boolean
): Promise<void> {
  const rows = readAttempts();
  const nextId = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.id), 0) + 1;
  rows.push({
    id: nextId,
    module,
    exercise_key: exerciseKey,
    correct: correct ? 1 : 0,
    timestamp: new Date().toISOString(),
  });
  writeAttempts(rows);
}

export interface ModuleStats {
  module: ModuleId;
  total: number;
  correct: number;
  accuracy: number;
}

export async function getModuleStats(module: ModuleId): Promise<ModuleStats> {
  const rows = readAttempts().filter((r) => r.module === module);
  const total = rows.length;
  const correct = rows.reduce((s, r) => s + r.correct, 0);
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { module, total, correct, accuracy };
}

export async function getAllModuleStats(modules: ModuleId[]): Promise<Record<ModuleId, ModuleStats>> {
  const out = {} as Record<ModuleId, ModuleStats>;
  for (const m of modules) {
    out[m] = await getModuleStats(m);
  }
  return out;
}

export async function getStreak(): Promise<number> {
  const rows = readAttempts()
    .sort((a, b) => b.id - a.id)
    .slice(0, 500);
  let streak = 0;
  for (const r of rows) {
    if (r.correct) streak += 1;
    else break;
  }
  return streak;
}
