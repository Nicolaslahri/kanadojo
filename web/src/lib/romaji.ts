import { KANA, type Kana, type Script } from '../data/kana';

// Other common spellings, mapped to the Hepburn the app uses.
const VARIANTS: [RegExp, string][] = [
  [/^si$/, 'shi'], [/^ti$/, 'chi'], [/^tu$/, 'tsu'], [/^hu$/, 'fu'], [/^(zi|di|jy?i)$/, 'ji'], [/^d?zu$|^du$/, 'zu'],
  [/^sy([auo])$/, 'sh$1'], [/^ty([auo])$/, 'ch$1'], [/^cy([auo])$/, 'ch$1'], [/^(zy|jy|dy)([auo])$/, 'j$2'],
  [/^nn$/, 'n'], [/^wo$/, 'o'],
];

/** Lowercases, trims and folds alternative spellings (si → shi, tu → tsu, wo → o…). */
export function normalizeRomaji(input: string): string {
  let r = input.trim().toLowerCase().replace(/[^a-z]/g, '');
  for (const [re, to] of VARIANTS) r = r.replace(re, to);
  return r;
}

export const romajiMatches = (input: string, answer: string) =>
  normalizeRomaji(input) !== '' && normalizeRomaji(input) === normalizeRomaji(answer);

/** The kana in `script` that the typed or picked romaji belongs to, if any. */
export function kanaForRomaji(input: string, script: Script): Kana | undefined {
  const r = normalizeRomaji(input);
  if (!r) return undefined;
  return KANA.find((k) => k.script === script && normalizeRomaji(k.romaji) === r);
}
