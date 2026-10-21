import { KANA_BY_CHAR } from '../data/kana';

// Katakana that look almost like their hiragana twin, so they come for free.
const SAME_SHAPE = new Set(['カ', 'キ', 'ケ', 'セ', 'ヘ', 'ヤ', 'リ', 'モ', 'ウ', 'ラ', 'オ', 'ニ', 'ロ']);

/** The hiragana with the same sound as a katakana (カ → か, キャ → きゃ). */
export function hiraganaTwin(char: string): string | null {
  if (KANA_BY_CHAR[char]?.script !== 'katakana') return null;
  const twin = [...char].map((c) => String.fromCodePoint(c.codePointAt(0)! - 0x60)).join('');
  return KANA_BY_CHAR[twin] ? twin : null;
}

export const looksLikeTwin = (char: string) => [...char].every((c) => SAME_SHAPE.has(c) || 'ャュョ'.includes(c)) && SAME_SHAPE.has([...char][0]);
