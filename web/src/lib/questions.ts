import { KANA, KANA_BY_CHAR, LOOKALIKES, type Kana } from '../data/kana';
import { WORDS, wordChars, type Word } from '../data/words';
import { cardKey, isDue, skillsFor, weakness, type Card, type Skill } from './srs';

export type Question =
  | { type: 'read'; char: string; options: string[]; answer: string }
  | { type: 'recall' | 'listen'; char: string; options: string[]; answer: string }
  | { type: 'write'; char: string }
  | { type: 'word'; word: Word; options: string[]; answer: string };

export const questionSkill = (q: Question): Skill | null => (q.type === 'word' ? null : q.type);

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const vowelOf = (k: Kana) => k.romaji.slice(-1);

/**
 * Up to `n` plausible wrong answers: look-alikes first, then same row or vowel, then anything.
 * Characters in `known` are preferred so beginners aren't shown kana they haven't met yet.
 */
export function distractors(char: string, n = 3, known?: Set<string>): Kana[] {
  const target = KANA_BY_CHAR[char];
  const sameScript = KANA.filter((k) => k.script === target.script && k.char !== char && k.romaji !== target.romaji);
  const look = LOOKALIKES.filter((g) => g.includes(char)).flat()
    .map((c) => KANA_BY_CHAR[c])
    .filter((k): k is Kana => !!k && sameScript.includes(k));
  const sameKind = sameScript.filter((k) => k.kind === target.kind);
  const near = sameKind.filter((k) => k.row === target.row || vowelOf(k) === vowelOf(target));
  const picked: Kana[] = [];
  const seenRomaji = new Set([target.romaji]);
  const ranked = [...shuffle(look), ...shuffle(near), ...shuffle(sameKind), ...shuffle(sameScript)];
  const ordered = known ? [...ranked.filter((k) => known.has(k.char)), ...ranked] : ranked;
  for (const k of ordered) {
    if (picked.length >= n) break;
    if (seenRomaji.has(k.romaji)) continue;
    seenRomaji.add(k.romaji);
    picked.push(k);
  }
  return picked;
}

export function buildQuestion(char: string, skill: Skill, canSpeak: boolean, known?: Set<string>): Question {
  const k = KANA_BY_CHAR[char];
  if (skill === 'write' && k.kind !== 'yoon') return { type: 'write', char };
  const wrong = distractors(char, 3, known);
  if (skill === 'read') {
    return { type: 'read', char, answer: k.romaji, options: shuffle([k.romaji, ...wrong.map((w) => w.romaji)]) };
  }
  const type = skill === 'listen' && canSpeak ? 'listen' : 'recall';
  return { type, char, answer: char, options: shuffle([char, ...wrong.map((w) => w.char)]) };
}

export function buildWordQuestion(word: Word, pool: Word[]): Question {
  const others = shuffle(pool.filter((w) => w.romaji !== word.romaji));
  const sameLength = others.filter((w) => Math.abs(w.romaji.length - word.romaji.length) <= 2);
  const picks = [...new Set([...sameLength, ...others].map((w) => w.romaji))].slice(0, 3);
  return { type: 'word', word, answer: word.romaji, options: shuffle([word.romaji, ...picks]) };
}

export function wordsFor(chars: Set<string>): Word[] {
  return WORDS.filter((w) => wordChars(w).every((c) => chars.has(c)));
}

/** Spreads repeats of the same character apart so two questions about it rarely follow each other. */
function spread(qs: Question[]): Question[] {
  const out: Question[] = [];
  const rest = [...qs];
  while (rest.length) {
    const last = out[out.length - 1];
    const lastChar = last && 'char' in last ? last.char : null;
    const i = rest.findIndex((q) => !('char' in q) || q.char !== lastChar);
    out.push(...rest.splice(i === -1 ? 0 : i, 1));
  }
  return out;
}

export const DAILY_SIZE = 20;
const MAX_WRITE = 5;

/** Picks today's test: due cards first, then the weakest, mixing all four skills. */
export function buildDailyTest(cards: Record<string, Card>, learned: string[], canSpeak: boolean, now = Date.now()): Question[] {
  const pool: Card[] = [];
  for (const c of learned) {
    for (const skill of skillsFor(KANA_BY_CHAR[c])) {
      pool.push(cards[cardKey(c, skill)] ?? { char: c, skill, box: 0, due: now, correct: 0, wrong: 0, updated: now });
    }
  }
  const due = shuffle(pool.filter((c) => isDue(c, now))).sort((a, b) => a.box - b.box);
  const notDue = pool.filter((c) => !isDue(c, now)).sort((a, b) => weakness(b) - weakness(a) || a.due - b.due);
  const chosen: Card[] = [];
  let writes = 0;
  for (const c of [...due, ...notDue]) {
    if (chosen.length >= DAILY_SIZE) break;
    if (c.skill === 'write') {
      if (writes >= MAX_WRITE) continue;
      writes++;
    }
    chosen.push(c);
  }
  const known = new Set(learned);
  return spread(shuffle(chosen).map((c) => buildQuestion(c.char, c.skill, canSpeak, known)));
}

/** Look-alike drill: each question's options are the characters it gets confused with. */
export function buildLookalikeQuiz(chars: Set<string>, count = 15): Question[] {
  const groups = LOOKALIKES.filter((g) => g.filter((c) => chars.has(c)).length >= 2 && new Set(g.map((c) => KANA_BY_CHAR[c].script)).size === 1);
  if (!groups.length) return [];
  const qs: Question[] = [];
  for (let i = 0; i < count; i++) {
    const g = groups[i % groups.length];
    const char = g[Math.floor(Math.random() * g.length)];
    const k = KANA_BY_CHAR[char];
    const extra = distractors(char, 4 - g.length).map((d) => d.char);
    const options = shuffle([...new Set([...g, ...extra])]).slice(0, 4);
    if (!options.includes(char)) options[0] = char;
    if (i % 2 === 0) {
      qs.push({ type: 'read', char, answer: k.romaji, options: shuffle([...new Set(options.map((c) => KANA_BY_CHAR[c].romaji))]) });
    } else {
      qs.push({ type: 'recall', char, answer: char, options: shuffle(options) });
    }
  }
  return spread(shuffle(qs));
}
