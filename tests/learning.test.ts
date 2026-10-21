import { describe, expect, it } from 'vitest';
import { KANA_BY_CHAR } from '../web/src/data/kana';
import { buildConfusionQuiz, buildDailyTest, confusedWith, distractors, lessonWordQuestions } from '../web/src/lib/questions';
import { kanaForRomaji, normalizeRomaji, romajiMatches } from '../web/src/lib/romaji';
import { newCard, review } from '../web/src/lib/srs';
import { hiraganaTwin, looksLikeTwin } from '../web/src/lib/twins';

describe('typed romaji', () => {
  it('accepts common alternative spellings', () => {
    expect(romajiMatches(' Shi ', 'shi')).toBe(true);
    expect(romajiMatches('si', 'shi')).toBe(true);
    expect(romajiMatches('tu', 'tsu')).toBe(true);
    expect(romajiMatches('hu', 'fu')).toBe(true);
    expect(romajiMatches('zi', 'ji')).toBe(true);
    expect(romajiMatches('sya', 'sha')).toBe(true);
    expect(romajiMatches('jya', 'ja')).toBe(true);
    expect(romajiMatches('o', 'wo')).toBe(true);
    expect(romajiMatches('nn', 'n')).toBe(true);
    expect(romajiMatches('sa', 'shi')).toBe(false);
    expect(romajiMatches('', 'a')).toBe(false);
    expect(normalizeRomaji('KA!')).toBe('ka');
  });

  it('finds which kana a wrong answer belongs to', () => {
    expect(kanaForRomaji('me', 'hiragana')?.char).toBe('め');
    expect(kanaForRomaji('si', 'katakana')?.char).toBe('シ');
    expect(kanaForRomaji('xyz', 'hiragana')).toBeUndefined();
  });
});

describe('slow answers', () => {
  it('keep a correct but slow card in its box', () => {
    const c = { ...newCard('あ', 'read', 0), box: 3 };
    expect(review(c, true, 1000).box).toBe(4);
    expect(review(c, true, 1000, true).box).toBe(3);
    expect(review(newCard('あ', 'read', 0), true, 1000, true).box).toBe(1);
  });
});

describe('personal mix-ups', () => {
  const confusions = { 'ぬ|め': 3, 'め|ぬ': 1, 'シ|ツ': 2, 'あ|お': 1 };

  it('ranks what a kana gets confused with, either way round', () => {
    expect(confusedWith('ぬ', confusions)).toEqual(['め']);
    expect(confusedWith('ツ', confusions)).toEqual(['シ']);
  });

  it('puts your own mix-ups among the options', () => {
    for (let i = 0; i < 10; i++) expect(distractors('ぬ', 3, undefined, confusions).map((k) => k.char)).toContain('め');
  });

  it('builds a drill from the top pairs only', () => {
    const qs = buildConfusionQuiz(confusions, 12);
    expect(qs).toHaveLength(12);
    for (const q of qs) {
      if (!('options' in q) || q.type === 'word') throw new Error('unexpected');
      expect(['ぬ', 'め', 'シ', 'ツ', 'あ', 'お']).toContain(q.char);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
    expect(buildConfusionQuiz({})).toEqual([]);
  });
});

describe('fast track', () => {
  it('leaves writing out of the daily test until you start writing', () => {
    const learned = ['あ', 'い', 'う', 'え', 'お'];
    const qs = buildDailyTest({}, learned, false, Date.now(), { writingStartedOnly: true });
    expect(qs.some((q) => q.type === 'write')).toBe(false);
    const withWriting = buildDailyTest({ 'あ|write': newCard('あ', 'write', 0) }, learned, false, Date.now(), { writingStartedOnly: true });
    expect(withWriting.filter((q) => q.type === 'write').map((q) => 'char' in q && q.char)).toEqual(['あ']);
  });
});

describe('lesson words', () => {
  it('only uses words made of known kana that include a new one', () => {
    const known = new Set(['あ', 'い', 'う', 'え', 'お']);
    const qs = lessonWordQuestions(['か', 'き', 'く', 'け', 'こ'], known, 5);
    for (const q of qs) {
      if (q.type !== 'word') throw new Error('unexpected');
      expect(/[かきくけこ]/.test(q.word.kana)).toBe(true);
      expect([...q.word.kana].every((c) => known.has(c) || 'かきくけこ'.includes(c))).toBe(true);
    }
  });
});

describe('katakana twins', () => {
  it('maps katakana to the hiragana with the same sound', () => {
    expect(hiraganaTwin('カ')).toBe('か');
    expect(hiraganaTwin('キャ')).toBe('きゃ');
    expect(hiraganaTwin('か')).toBeNull();
    expect(looksLikeTwin('カ')).toBe(true);
    expect(looksLikeTwin('シ')).toBe(false);
    expect(KANA_BY_CHAR[hiraganaTwin('ン')!].romaji).toBe('n');
  });
});
