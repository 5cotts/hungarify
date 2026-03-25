import * as SQLite from 'expo-sqlite';

import type { ModuleId } from '@/src/engine/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('progress.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS attempts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module TEXT NOT NULL,
          exercise_key TEXT NOT NULL,
          correct INTEGER NOT NULL,
          timestamp TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function recordAttempt(
  module: ModuleId,
  exerciseKey: string,
  correct: boolean
): Promise<void> {
  const db = await getDatabase();
  const ts = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO attempts (module, exercise_key, correct, timestamp) VALUES (?, ?, ?, ?)',
    [module, exerciseKey, correct ? 1 : 0, ts]
  );
}

export interface ModuleStats {
  module: ModuleId;
  total: number;
  correct: number;
  accuracy: number;
}

export async function getModuleStats(module: ModuleId): Promise<ModuleStats> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number; correct: number }>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(correct), 0) AS correct
     FROM attempts WHERE module = ?`,
    [module]
  );
  const total = row?.total ?? 0;
  const correct = row?.correct ?? 0;
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

/** Consecutive correct answers (most recent first), ends at first wrong. */
export async function getStreak(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ correct: number }>(
    'SELECT correct FROM attempts ORDER BY id DESC LIMIT 500'
  );
  let streak = 0;
  for (const r of rows) {
    if (r.correct) streak += 1;
    else break;
  }
  return streak;
}
