import { describe, expect, it } from 'vitest';
import { KANA, KANA_BY_CHAR, LESSONS } from '../web/src/data/kana';
import { buildDailyTest, buildLookalikeQuiz, buildQuestion, distractors } from '../web/src/lib/questions';

describe('kana data', () => {
  it('has 46 basic, 25 dakuten and 33 yōon per script with stroke data for writable ones', async () => {
    const strokes = (await import('../web/src/data/strokes.json')).default as Record<string, unknown[]>;
    for (const script of ['hiragana', 'katakana'] as const) {
      const ks = KANA.filter((k) => k.script === script);
      expect(ks.filter((k) => k.kind === 'basic')).toHaveLength(46);
      expect(ks.filter((k) => k.kind === 'dakuten')).toHaveLength(25);
      expect(ks.filter((k) => k.kind === 'yoon')).toHaveLength(33);
      for (const k of ks.filter((k) => k.kind !== 'yoon')) expect(strokes[k.char], k.char).toBeTruthy();
      for (const k of ks.filter((k) => k.kind === 'basic')) expect(k.story && k.emoji && k.hook, k.char).toBeTruthy();
    }
    expect(new Set(KANA.map((k) => k.char)).size).toBe(KANA.length);
    expect(LESSONS.flatMap((l) => l.chars).sort()).toEqual(KANA.map((k) => k.char).sort());
  });
});

describe('questions', () => {
  it('never offers a distractor that sounds the same as the answer', () => {
    for (const k of KANA) {
      const d = distractors(k.char);
      expect(d.length, k.char).toBe(3);
      expect(d.every((x) => x.romaji !== k.romaji && x.script === k.script), k.char).toBe(true);
    }
  });

  it('builds 4 unique options including the answer', () => {
    for (const k of KANA) for (const skill of ['read', 'recall', 'listen'] as const) {
      const q = buildQuestion(k.char, skill, true);
      if (q.type === 'write' || q.type === 'word') throw new Error('unexpected');
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
    }
    expect(buildQuestion('きゃ', 'write', true).type).not.toBe('write');
    expect(buildQuestion('あ', 'listen', false).type).toBe('recall');
  });

  it('daily test has up to 20 questions with at most 5 writing', () => {
    const learned = KANA.filter((k) => k.script === 'hiragana' && k.kind === 'basic').map((k) => k.char);
    const qs = buildDailyTest({}, learned, true);
    expect(qs).toHaveLength(20);
    expect(qs.filter((q) => q.type === 'write').length).toBeLessThanOrEqual(5);
    expect(buildDailyTest({}, ['あ', 'い'], true).length).toBe(8);
  });

  it('look-alike drill only uses groups present in the set', () => {
    const set = new Set(['シ', 'ツ', 'ソ', 'ン']);
    const qs = buildLookalikeQuiz(set, 10);
    expect(qs).toHaveLength(10);
    for (const q of qs) if ('char' in q) expect(set.has(q.char)).toBe(true);
    expect(KANA_BY_CHAR['シ'].romaji).toBe('shi');
  });
});

describe('distractors for beginners', () => {
  it('prefers characters already learned', () => {
    const known = new Set(['あ', 'い', 'う', 'え', 'お']);
    for (let i = 0; i < 20; i++) {
      expect(distractors('あ', 3, known).every((k) => known.has(k.char))).toBe(true);
    }
  });
});
