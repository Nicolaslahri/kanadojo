import { KANA_BY_CHAR, type Kana } from '../data/kana';

export type Skill = 'read' | 'recall' | 'listen' | 'write';
export const SKILLS: Skill[] = ['read', 'recall', 'listen', 'write'];
export const SKILL_LABEL: Record<Skill, string> = {
  read: 'Reading',
  recall: 'Recall',
  listen: 'Listening',
  write: 'Writing',
};

export interface Card {
  char: string;
  skill: Skill;
  /** Leitner box 0–5. */
  box: number;
  due: number;
  correct: number;
  wrong: number;
  updated: number;
}

export const MAX_BOX = 5;
const DAY = 86_400_000;
const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
/** A missed card comes back in the same session or the next one. */
const RETRY_MS = 10 * 60_000;

export const cardKey = (char: string, skill: Skill) => `${char}|${skill}`;

export const skillsFor = (k: Kana | undefined): Skill[] =>
  k?.kind === 'yoon' ? ['read', 'recall', 'listen'] : SKILLS;

export function newCard(char: string, skill: Skill, now: number): Card {
  return { char, skill, box: 0, due: now, correct: 0, wrong: 0, updated: now };
}

export function review(card: Card, correct: boolean, now: number): Card {
  if (correct) {
    const box = Math.min(MAX_BOX, card.box + 1);
    return { ...card, box, due: now + INTERVAL_DAYS[box] * DAY, correct: card.correct + 1, updated: now };
  }
  return { ...card, box: Math.min(card.box, 1), due: now + RETRY_MS, wrong: card.wrong + 1, updated: now };
}

/** 0–5 average box across a character's skills. Unseen skills count as 0. */
export function mastery(char: string, cards: Record<string, Card>): number {
  const skills = skillsFor(KANA_BY_CHAR[char]);
  return skills.reduce((sum, s) => sum + (cards[cardKey(char, s)]?.box ?? 0), 0) / skills.length;
}

export const isMastered = (char: string, cards: Record<string, Card>) =>
  skillsFor(KANA_BY_CHAR[char]).every((s) => (cards[cardKey(char, s)]?.box ?? 0) >= 4);

/** Higher means weaker: low box and a poor hit rate. */
export function weakness(card: Card): number {
  const total = card.correct + card.wrong;
  const missRate = total ? card.wrong / total : 0.5;
  return (MAX_BOX - card.box) + missRate * 4;
}

export const isDue = (card: Card, now: number) => card.due <= now;

export function dayKey(t: number | Date = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Consecutive active days ending today (or yesterday, so the streak survives until you practise). */
export function streak(activeDays: Iterable<string>, now = Date.now()): number {
  const days = new Set(activeDays);
  let d = new Date(now);
  if (!days.has(dayKey(d))) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(d))) {
    count++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return count;
}
