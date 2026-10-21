import { useSyncExternalStore } from 'react';
import { KANA_BY_CHAR } from '../data/kana';
import { cardKey, dayKey, newCard, review, skillsFor, type Card, type Skill } from './srs';

export interface Settings {
  voiceURI: string | null;
  rate: number;
  romaji: boolean;
  theme: 'auto' | 'light' | 'dark';
  haptics: boolean;
  unlockAll: boolean;
  reminder: { enabled: boolean; time: string; tz: string };
}

export interface Review {
  id: string;
  char: string;
  skill: Skill;
  correct: boolean;
  mode: string;
  at: number;
  day: string;
}

export interface TestResult {
  score: number;
  total: number;
  at: number;
  details?: { char: string; skill: Skill; correct: boolean }[];
}

type Tally = Record<string, { n: number; correct: number }>;
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'auth';

export interface State {
  cards: Record<string, Card>;
  learned: Record<string, number>;
  tests: Record<string, TestResult>;
  /** Reviews per local day, from the server plus anything not yet synced. */
  activity: Tally;
  skillStats: Tally;
  settings: Settings;
  settingsUpdated: number;
  pendingReviews: Review[];
  dirtyCards: string[];
  syncStatus: SyncStatus;
  lastSync: number;
}

const STORAGE_KEY = 'kana-dojo-state-v1';

export const DEFAULT_SETTINGS: Settings = {
  voiceURI: null,
  rate: 0.8,
  romaji: true,
  theme: 'auto',
  haptics: true,
  unlockAll: false,
  reminder: { enabled: false, time: '19:00', tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
};

const empty = (): State => ({
  cards: {}, learned: {}, tests: {}, activity: {}, skillStats: {},
  settings: DEFAULT_SETTINGS, settingsUpdated: 0,
  pendingReviews: [], dirtyCards: [], syncStatus: 'idle', lastSync: 0,
});

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const saved = JSON.parse(raw) as Partial<State>;
    return { ...empty(), ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings }, syncStatus: 'idle' };
  } catch {
    return empty();
  }
}

let state: State = typeof localStorage === 'undefined' ? empty() : load();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const { syncStatus: _s, ...rest } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch {
      // Storage can be full or blocked; the server copy still has everything synced so far.
    }
  }, 300);
}

function setState(update: (s: State) => Partial<State>, { sync = true } = {}) {
  state = { ...state, ...update(state) };
  persist();
  listeners.forEach((l) => l());
  if (sync) scheduleSync();
}

export const getState = () => state;

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function bump(t: Tally, key: string, correct: boolean): Tally {
  const cur = t[key] ?? { n: 0, correct: 0 };
  return { ...t, [key]: { n: cur.n + 1, correct: cur.correct + (correct ? 1 : 0) } };
}

export function recordAnswer(char: string, skill: Skill, correct: boolean, mode: string) {
  const now = Date.now();
  const key = cardKey(char, skill);
  const day = dayKey(now);
  setState((s) => ({
    cards: { ...s.cards, [key]: review(s.cards[key] ?? newCard(char, skill, now), correct, now) },
    dirtyCards: s.dirtyCards.includes(key) ? s.dirtyCards : [...s.dirtyCards, key],
    pendingReviews: [...s.pendingReviews, { id: uid(), char, skill, correct, mode, at: now, day }],
    activity: bump(s.activity, day, correct),
    skillStats: bump(s.skillStats, skill, correct),
  }));
}

export function markLearned(chars: string[]) {
  const now = Date.now();
  setState((s) => {
    const cards = { ...s.cards };
    const dirty = new Set(s.dirtyCards);
    const learned = { ...s.learned };
    for (const c of chars) {
      learned[c] ??= now;
      for (const skill of skillsFor(KANA_BY_CHAR[c])) {
        const key = cardKey(c, skill);
        if (!cards[key]) {
          cards[key] = newCard(c, skill, now);
          dirty.add(key);
        }
      }
    }
    return { cards, learned, dirtyCards: [...dirty] };
  });
}

export function saveTest(day: string, result: TestResult) {
  setState((s) => ({ tests: s.tests[day] ? s.tests : { ...s.tests, [day]: result } }));
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch }, settingsUpdated: Date.now() }));
}

// ---- Server sync -------------------------------------------------------

interface ServerState {
  cards: Card[];
  learned: Record<string, number>;
  tests: Record<string, TestResult>;
  settings: { value: Partial<Settings>; updated: number } | null;
  activity: Tally;
  skillStats: Tally;
}

let syncing: Promise<void> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSync(delay = 1500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void sync(), delay);
}

function applyServer(server: ServerState, startedAt: number, sentIds: Set<string>) {
  setState((s) => {
    const cards: Record<string, Card> = {};
    for (const c of server.cards) cards[cardKey(c.char, c.skill)] = c;
    // Anything changed locally while the request was in flight stays local and dirty.
    const stillDirty = s.dirtyCards.filter((k) => s.cards[k] && s.cards[k].updated > startedAt);
    for (const k of stillDirty) cards[k] = s.cards[k];
    const pendingReviews = s.pendingReviews.filter((r) => !sentIds.has(r.id));
    let activity = server.activity;
    let skillStats = server.skillStats;
    for (const r of pendingReviews) {
      activity = bump(activity, r.day, r.correct);
      skillStats = bump(skillStats, r.skill, r.correct);
    }
    const serverSettingsNewer = server.settings && server.settings.updated > s.settingsUpdated;
    return {
      cards,
      learned: { ...server.learned, ...Object.fromEntries(Object.entries(s.learned).filter(([c]) => !(c in server.learned))) },
      tests: { ...s.tests, ...server.tests },
      activity,
      skillStats,
      pendingReviews,
      dirtyCards: stillDirty,
      settings: serverSettingsNewer ? { ...DEFAULT_SETTINGS, ...server.settings!.value } : s.settings,
      settingsUpdated: serverSettingsNewer ? server.settings!.updated : s.settingsUpdated,
      syncStatus: 'synced',
      lastSync: Date.now(),
    };
  }, { sync: false });
}

export function sync(): Promise<void> {
  if (syncing) return syncing;
  const s = state;
  const startedAt = Date.now();
  const sentIds = new Set(s.pendingReviews.map((r) => r.id));
  const body = {
    reviews: s.pendingReviews,
    cards: s.dirtyCards.map((k) => s.cards[k]).filter(Boolean),
    learned: s.learned,
    tests: s.tests,
    settings: s.settingsUpdated ? { value: s.settings, updated: s.settingsUpdated } : undefined,
  };
  setState(() => ({ syncStatus: 'syncing' }), { sync: false });
  syncing = fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
    .then(async (res) => {
      if (res.status === 401) {
        setState(() => ({ syncStatus: 'auth' }), { sync: false });
        return;
      }
      if (!res.ok) throw new Error(`sync failed: ${res.status}`);
      applyServer((await res.json()) as ServerState, startedAt, sentIds);
    })
    .catch(() => setState(() => ({ syncStatus: 'offline' }), { sync: false }))
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

export async function login(pin: string): Promise<string | null> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (res.ok) {
    await sync();
    return null;
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? 'Could not log in';
}

/** Wipes progress here and on the server. Returns false if the server couldn't be reached. */
export async function resetProgress(): Promise<boolean> {
  const res = await fetch('/api/reset', { method: 'POST' }).catch(() => null);
  if (!res?.ok) return false;
  setState(() => ({
    cards: {}, learned: {}, tests: {}, activity: {}, skillStats: {}, pendingReviews: [], dirtyCards: [],
  }), { sync: false });
  return true;
}

export function startAutoSync() {
  void sync();
  setInterval(() => void sync(), 30_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void sync());
  window.addEventListener('online', () => void sync());
}
