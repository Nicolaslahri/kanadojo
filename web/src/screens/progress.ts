import { KANA, LESSONS, type Lesson, type Script } from '../data/kana';
import { dayKey, isDue, isMastered, streak, type Card } from '../lib/srs';
import type { State } from '../lib/store';

export const lessonDone = (l: Lesson, learned: Record<string, number>) => l.chars.every((c) => c in learned);

export function nextLesson(script: Script, learned: Record<string, number>) {
  return LESSONS.find((l) => l.script === script && !lessonDone(l, learned));
}

/** A lesson is open when every earlier lesson of the same script is done (or everything is unlocked). */
export function lessonOpen(l: Lesson, s: Pick<State, 'learned' | 'settings'>) {
  if (s.settings.unlockAll || lessonDone(l, s.learned)) return true;
  return nextLesson(l.script, s.learned)?.id === l.id;
}

export function scriptProgress(script: Script, s: Pick<State, 'learned' | 'cards'>) {
  const all = KANA.filter((k) => k.script === script);
  return {
    total: all.length,
    learned: all.filter((k) => k.char in s.learned).length,
    mastered: all.filter((k) => isMastered(k.char, s.cards)).length,
  };
}

export const dueCount = (cards: Record<string, Card>, learned: Record<string, number>, now = Date.now()) =>
  Object.values(cards).filter((c) => c.char in learned && isDue(c, now)).length;

export const currentStreak = (s: Pick<State, 'activity' | 'tests'>) =>
  streak([...Object.keys(s.activity).filter((d) => s.activity[d].n > 0), ...Object.keys(s.tests)]);

export function bestStreak(s: Pick<State, 'activity' | 'tests'>) {
  const days = [...new Set([...Object.keys(s.activity), ...Object.keys(s.tests)])].sort();
  let best = 0, run = 0, prev = '';
  for (const d of days) {
    const [y, m, dd] = d.split('-').map(Number);
    const yesterday = dayKey(new Date(y, m - 1, dd - 1));
    run = prev === yesterday ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
