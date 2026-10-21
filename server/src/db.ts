import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface CardRow {
  char: string;
  skill: string;
  box: number;
  due: number;
  correct: number;
  wrong: number;
  updated: number;
}

export interface ReviewIn {
  id: string;
  char: string;
  skill: string;
  correct: boolean;
  mode: string;
  at: number;
  day: string;
}

export interface TestIn {
  score: number;
  total: number;
  at: number;
  details?: unknown;
}

export interface SyncIn {
  reviews?: ReviewIn[];
  cards?: CardRow[];
  learned?: Record<string, number>;
  tests?: Record<string, TestIn>;
  settings?: { value: unknown; updated: number };
}

export type Db = ReturnType<typeof openDb>;

export function openDb(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'kana.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      char TEXT NOT NULL, skill TEXT NOT NULL, box INTEGER NOT NULL, due INTEGER NOT NULL,
      correct INTEGER NOT NULL, wrong INTEGER NOT NULL, updated INTEGER NOT NULL,
      PRIMARY KEY (char, skill)
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY, char TEXT NOT NULL, skill TEXT NOT NULL, correct INTEGER NOT NULL,
      mode TEXT NOT NULL, at INTEGER NOT NULL, day TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reviews_day ON reviews(day);
    CREATE TABLE IF NOT EXISTS learned (char TEXT PRIMARY KEY, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_tests (
      day TEXT PRIMARY KEY, score INTEGER NOT NULL, total INTEGER NOT NULL, at INTEGER NOT NULL, details TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  const q = {
    insertReview: db.prepare(`INSERT OR IGNORE INTO reviews (id, char, skill, correct, mode, at, day)
      VALUES (@id, @char, @skill, @correct, @mode, @at, @day)`),
    upsertCard: db.prepare(`INSERT INTO cards (char, skill, box, due, correct, wrong, updated)
      VALUES (@char, @skill, @box, @due, @correct, @wrong, @updated)
      ON CONFLICT (char, skill) DO UPDATE SET box = excluded.box, due = excluded.due, correct = excluded.correct,
        wrong = excluded.wrong, updated = excluded.updated
      WHERE excluded.updated > cards.updated`),
    insertLearned: db.prepare(`INSERT INTO learned (char, at) VALUES (?, ?)
      ON CONFLICT (char) DO UPDATE SET at = MIN(at, excluded.at)`),
    insertTest: db.prepare(`INSERT OR IGNORE INTO daily_tests (day, score, total, at, details) VALUES (?, ?, ?, ?, ?)`),
    upsertSettings: db.prepare(`INSERT INTO settings (id, json, updated) VALUES (1, ?, ?)
      ON CONFLICT (id) DO UPDATE SET json = excluded.json, updated = excluded.updated WHERE excluded.updated > settings.updated`),
    cards: db.prepare(`SELECT char, skill, box, due, correct, wrong, updated FROM cards`),
    learned: db.prepare(`SELECT char, at FROM learned`),
    tests: db.prepare(`SELECT day, score, total, at FROM daily_tests`),
    settings: db.prepare(`SELECT json, updated FROM settings WHERE id = 1`),
    activity: db.prepare(`SELECT day, COUNT(*) AS n, SUM(correct) AS correct FROM reviews GROUP BY day ORDER BY day DESC LIMIT 400`),
    skillStats: db.prepare(`SELECT skill, COUNT(*) AS n, SUM(correct) AS correct FROM reviews GROUP BY skill`),
    hasTest: db.prepare(`SELECT 1 FROM daily_tests WHERE day = ?`),
    getMeta: db.prepare(`SELECT value FROM meta WHERE key = ?`),
    setMeta: db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`),
    subs: db.prepare(`SELECT endpoint, json FROM push_subs`),
    addSub: db.prepare(`INSERT INTO push_subs (endpoint, json) VALUES (?, ?) ON CONFLICT (endpoint) DO UPDATE SET json = excluded.json`),
    delSub: db.prepare(`DELETE FROM push_subs WHERE endpoint = ?`),
  };

  const sync = db.transaction((input: SyncIn) => {
    for (const r of input.reviews ?? []) {
      q.insertReview.run({ ...r, correct: r.correct ? 1 : 0 });
    }
    for (const c of input.cards ?? []) q.upsertCard.run(c);
    for (const [char, at] of Object.entries(input.learned ?? {})) q.insertLearned.run(char, at);
    for (const [day, t] of Object.entries(input.tests ?? {})) {
      q.insertTest.run(day, t.score, t.total, t.at, t.details ? JSON.stringify(t.details) : null);
    }
    if (input.settings) q.upsertSettings.run(JSON.stringify(input.settings.value), input.settings.updated);
  });

  function state() {
    const settingsRow = q.settings.get() as { json: string; updated: number } | undefined;
    const activity: Record<string, { n: number; correct: number }> = {};
    for (const r of q.activity.all() as { day: string; n: number; correct: number }[]) {
      activity[r.day] = { n: r.n, correct: r.correct };
    }
    const skillStats: Record<string, { n: number; correct: number }> = {};
    for (const r of q.skillStats.all() as { skill: string; n: number; correct: number }[]) {
      skillStats[r.skill] = { n: r.n, correct: r.correct };
    }
    return {
      cards: q.cards.all() as CardRow[],
      learned: Object.fromEntries((q.learned.all() as { char: string; at: number }[]).map((r) => [r.char, r.at])),
      tests: Object.fromEntries((q.tests.all() as { day: string; score: number; total: number; at: number }[])
        .map((r) => [r.day, { score: r.score, total: r.total, at: r.at }])),
      settings: settingsRow ? { value: JSON.parse(settingsRow.json), updated: settingsRow.updated } : null,
      activity,
      skillStats,
      serverTime: Date.now(),
    };
  }

  const reset = db.transaction(() => {
    db.exec('DELETE FROM cards; DELETE FROM reviews; DELETE FROM learned; DELETE FROM daily_tests;');
  });

  return {
    sync,
    state,
    reset,
    hasTest: (day: string) => !!q.hasTest.get(day),
    settingsValue: () => {
      const row = q.settings.get() as { json: string } | undefined;
      return row ? JSON.parse(row.json) : null;
    },
    getMeta: (key: string) => (q.getMeta.get(key) as { value: string } | undefined)?.value,
    setMeta: (key: string, value: string) => q.setMeta.run(key, value),
    subscriptions: () => q.subs.all() as { endpoint: string; json: string }[],
    addSubscription: (endpoint: string, json: string) => q.addSub.run(endpoint, json),
    removeSubscription: (endpoint: string) => q.delSub.run(endpoint),
    close: () => db.close(),
  };
}
