import { KANA_BY_CHAR } from './kana';

export interface Word {
  kana: string;
  romaji: string;
  meaning: string;
  emoji: string;
}

export const WORDS: Word[] = [
  { kana: 'ねこ', romaji: 'neko', meaning: 'cat', emoji: '🐈' },
  { kana: 'いぬ', romaji: 'inu', meaning: 'dog', emoji: '🐕' },
  { kana: 'すし', romaji: 'sushi', meaning: 'sushi', emoji: '🍣' },
  { kana: 'あい', romaji: 'ai', meaning: 'love', emoji: '❤️' },
  { kana: 'いえ', romaji: 'ie', meaning: 'house', emoji: '🏠' },
  { kana: 'あお', romaji: 'ao', meaning: 'blue', emoji: '🔵' },
  { kana: 'かお', romaji: 'kao', meaning: 'face', emoji: '🙂' },
  { kana: 'あき', romaji: 'aki', meaning: 'autumn', emoji: '🍂' },
  { kana: 'さけ', romaji: 'sake', meaning: 'salmon / rice wine', emoji: '🍶' },
  { kana: 'とけい', romaji: 'tokei', meaning: 'clock', emoji: '🕰️' },
  { kana: 'はな', romaji: 'hana', meaning: 'flower', emoji: '🌸' },
  { kana: 'やま', romaji: 'yama', meaning: 'mountain', emoji: '⛰️' },
  { kana: 'うみ', romaji: 'umi', meaning: 'sea', emoji: '🌊' },
  { kana: 'そら', romaji: 'sora', meaning: 'sky', emoji: '☁️' },
  { kana: 'さかな', romaji: 'sakana', meaning: 'fish', emoji: '🐟' },
  { kana: 'たまご', romaji: 'tamago', meaning: 'egg', emoji: '🥚' },
  { kana: 'ほん', romaji: 'hon', meaning: 'book', emoji: '📖' },
  { kana: 'でんしゃ', romaji: 'densha', meaning: 'train', emoji: '🚃' },
  { kana: 'きっぷ', romaji: 'kippu', meaning: 'ticket', emoji: '🎫' },
  { kana: 'ちゃ', romaji: 'cha', meaning: 'tea', emoji: '🍵' },
  { kana: 'カメラ', romaji: 'kamera', meaning: 'camera', emoji: '📷' },
  { kana: 'テレビ', romaji: 'terebi', meaning: 'TV', emoji: '📺' },
  { kana: 'パン', romaji: 'pan', meaning: 'bread', emoji: '🍞' },
  { kana: 'ピザ', romaji: 'piza', meaning: 'pizza', emoji: '🍕' },
  { kana: 'コーヒー', romaji: 'koohii', meaning: 'coffee', emoji: '☕' },
  { kana: 'ホテル', romaji: 'hoteru', meaning: 'hotel', emoji: '🏨' },
  { kana: 'バナナ', romaji: 'banana', meaning: 'banana', emoji: '🍌' },
  { kana: 'メロン', romaji: 'meron', meaning: 'melon', emoji: '🍈' },
  { kana: 'タクシー', romaji: 'takushii', meaning: 'taxi', emoji: '🚕' },
  { kana: 'ギター', romaji: 'gitaa', meaning: 'guitar', emoji: '🎸' },
];

/** Splits a word into the kana units the app tracks (combinations count as one). */
export function wordChars(w: Word): string[] {
  const out: string[] = [];
  const s = [...w.kana];
  for (let i = 0; i < s.length; i++) {
    const pair = s[i] + (s[i + 1] ?? '');
    if (KANA_BY_CHAR[pair]) { out.push(pair); i++; }
    else if (KANA_BY_CHAR[s[i]]) out.push(s[i]);
  }
  return out;
}
