
export type Script = 'hiragana' | 'katakana';
export type Kind = 'basic' | 'dakuten' | 'yoon';

export interface Kana {
  char: string;
  romaji: string;
  script: Script;
  kind: Kind;
  row: string;
  hook?: string;
  emoji?: string;
  story?: string;
  tip?: string;
}

export interface Lesson {
  id: string;
  title: string;
  script: Script;
  kind: Kind;
  chars: string[];
}

type Mn = [hook: string, emoji: string, story: string];

// Basic gojūon in chart order: [hiragana, katakana, romaji, row]
const BASIC: [string, string, string, string][] = [
  ['あ', 'ア', 'a', 'a'], ['い', 'イ', 'i', 'a'], ['う', 'ウ', 'u', 'a'], ['え', 'エ', 'e', 'a'], ['お', 'オ', 'o', 'a'],
  ['か', 'カ', 'ka', 'ka'], ['き', 'キ', 'ki', 'ka'], ['く', 'ク', 'ku', 'ka'], ['け', 'ケ', 'ke', 'ka'], ['こ', 'コ', 'ko', 'ka'],
  ['さ', 'サ', 'sa', 'sa'], ['し', 'シ', 'shi', 'sa'], ['す', 'ス', 'su', 'sa'], ['せ', 'セ', 'se', 'sa'], ['そ', 'ソ', 'so', 'sa'],
  ['た', 'タ', 'ta', 'ta'], ['ち', 'チ', 'chi', 'ta'], ['つ', 'ツ', 'tsu', 'ta'], ['て', 'テ', 'te', 'ta'], ['と', 'ト', 'to', 'ta'],
  ['な', 'ナ', 'na', 'na'], ['に', 'ニ', 'ni', 'na'], ['ぬ', 'ヌ', 'nu', 'na'], ['ね', 'ネ', 'ne', 'na'], ['の', 'ノ', 'no', 'na'],
  ['は', 'ハ', 'ha', 'ha'], ['ひ', 'ヒ', 'hi', 'ha'], ['ふ', 'フ', 'fu', 'ha'], ['へ', 'ヘ', 'he', 'ha'], ['ほ', 'ホ', 'ho', 'ha'],
  ['ま', 'マ', 'ma', 'ma'], ['み', 'ミ', 'mi', 'ma'], ['む', 'ム', 'mu', 'ma'], ['め', 'メ', 'me', 'ma'], ['も', 'モ', 'mo', 'ma'],
  ['や', 'ヤ', 'ya', 'ya'], ['ゆ', 'ユ', 'yu', 'ya'], ['よ', 'ヨ', 'yo', 'ya'],
  ['ら', 'ラ', 'ra', 'ra'], ['り', 'リ', 'ri', 'ra'], ['る', 'ル', 'ru', 'ra'], ['れ', 'レ', 're', 'ra'], ['ろ', 'ロ', 'ro', 'ra'],
  ['わ', 'ワ', 'wa', 'wa'], ['を', 'ヲ', 'wo', 'wa'], ['ん', 'ン', 'n', 'n'],
];

const HIRA_MN: Record<string, Mn> = {
  あ: ['an apple', '🍎', 'An apple with a stalk and a curly leaf: "a" for apple.'],
  い: ['two eels', '🐍', 'Two eels swimming side by side: "i" for eel.'],
  う: ['a U-turn', '↪️', 'A little dash on top of a road that bends: "u".'],
  え: ['an energetic ninja', '🥷', 'A ninja kicking with one leg out: "e"!'],
  お: ['a golf ball on a tee', '⛳', 'Golf player shouts "Oh!" as the ball flies.'],
  か: ['a cutting blade', '🔪', 'A blade cutting with a spark beside it: "ka"!'],
  き: ['a key', '🔑', 'It looks just like an old key: "ki".'],
  く: ['a cuckoo beak', '🐦', 'A bird’s open beak saying "ku-ku".'],
  け: ['a keg', '🛢️', 'A keg on its stand: "ke".'],
  こ: ['two koi', '🐟', 'Two koi fish swimming: "ko".'],
  さ: ['a saw-tooth face', '🙃', 'A sad face looking sideways sighs "sa".'],
  し: ['a fish hook', '🪝', 'She fishes with a long hook: "shi".'],
  す: ['a swing', '🎠', 'A loop on a swing rope: "su".'],
  せ: ['a mouth saying "se"', '👄', 'A mouth with big teeth says "se".'],
  そ: ['a zigzag sewing thread', '🧵', 'Sew a zigzag: "so".'],
  た: ['ta + a', '🍵', 'The letters t and a side by side: "ta".'],
  ち: ['a cheerleader', '📣', 'A cheerleader with a big belly yells "chi"!'],
  つ: ['a tsunami', '🌊', 'One big wave rolling in: "tsu".'],
  て: ['a telescope', '🔭', 'A bent telescope: "te".'],
  と: ['a toe with a splinter', '🦶', 'A thorn stuck in a toe: "to".'],
  な: ['a nun praying', '🙏', 'A nun kneeling by a cross: "na".'],
  に: ['a knee', '🦵', 'A leg and a knee: "ni".'],
  ぬ: ['noodles', '🍜', 'Noodles twirled on chopsticks: "nu".'],
  ね: ['a neko', '🐈', 'A cat with a curly tail: "ne".'],
  の: ['a "no" sign', '🚫', 'One big swirl saying "no".'],
  は: ['a laughing face', '😄', 'Ha! A person laughing next to a pole.'],
  ひ: ['a big grin', '😁', 'A wide smiling mouth: "hi"!'],
  ふ: ['Mount Fuji', '🗻', 'Mount Fuji with dots of snow: "fu".'],
  へ: ['a hill', '⛰️', 'A small hill to climb: "he".'],
  ほ: ['a hose on a pole', '🚿', 'Ho! A pole with a hose looped around.'],
  ま: ['a mama with two arms', '🤱', 'Mama holding a baby: "ma".'],
  み: ['the number 21', '🎂', 'Me at 21: "mi".'],
  む: ['a cow', '🐄', 'A cow saying "moo": "mu".'],
  め: ['an eye', '👁️', 'An eye looking at me: "me".'],
  も: ['a fish hook with worms', '🎣', 'More worms on the hook: "mo".'],
  や: ['a yak', '🐂', 'A yak with horns: "ya".'],
  ゆ: ['a unique fish', '🐠', 'A fish swimming in a loop: "yu".'],
  よ: ['a yo-yo', '🪀', 'A yo-yo hanging off a string: "yo".'],
  ら: ['a rabbit', '🐇', 'A rabbit with one ear: "ra".'],
  り: ['reeds', '🌾', 'Two reeds by a river: "ri".'],
  る: ['a loop route', '➰', 'A road with a loop at the end: "ru".'],
  れ: ['a man kneeling', '🧎', 'A man reaching out: "re".'],
  ろ: ['a road', '🛣️', 'A winding road without a loop: "ro".'],
  わ: ['a wasp', '🐝', 'A wasp with a big belly: "wa".'],
  を: ['someone swimming', '🏊', 'Whoa! A swimmer hitting the water: "wo".'],
  ん: ['the letter n', '🔤', 'It looks like a handwritten n.'],
};

const KATA_MN: Record<string, Mn> = {
  ア: ['an axe', '🪓', 'An axe head on a handle: "a".'],
  イ: ['an easel', '🖼️', 'A painter’s easel: "i".'],
  ウ: ['a wooden hut', '🛖', 'A hut with a chimney: "u".'],
  エ: ['an elevator', '🛗', 'An I-beam elevator shaft: "e".'],
  オ: ['an opera singer', '🎤', 'A singer with arms out: "o".'],
  カ: ['a karate chop', '🥋', 'A strong arm chopping: "ka".'],
  キ: ['a key', '🔑', 'A key with two teeth: "ki".'],
  ク: ['a cook’s hat', '👨‍🍳', 'Half of a cook’s hat: "ku".'],
  ケ: ['a K', '🔤', 'It looks like a slanted K: "ke".'],
  コ: ['a corner', '📐', 'Two corners of a box: "ko".'],
  サ: ['a signpost', '🪧', 'Sa! A sign with two posts.'],
  シ: ['a smiling face', '😊', 'She smiles, eyes on top: "shi".'],
  ス: ['a swing', '🎡', 'A person sliding down: "su".'],
  セ: ['a sail', '⛵', 'A sail on a boat: "se".'],
  ソ: ['a needle sewing', '🪡', 'Sew from top down: "so".'],
  タ: ['a tank', '🪖', 'Ta! A slanted tank.'],
  チ: ['a cheerleader', '📣', 'Chi! Arms up with a pompom.'],
  ツ: ['a tsunami', '🌊', 'Two drops and a wave coming from the side: "tsu".'],
  テ: ['a telephone pole', '📞', 'A pole with wires: "te".'],
  ト: ['a totem pole', '🗿', 'A totem with one branch: "to".'],
  ナ: ['a knife', '🗡️', 'A knife in a cross: "na".'],
  ニ: ['two lines', '✌️', 'Two lines: "ni" means two.'],
  ヌ: ['noodles', '🍝', 'Chopsticks in noodles: "nu".'],
  ネ: ['a nest', '🪺', 'A bird’s nest on a branch: "ne".'],
  ノ: ['a slash', '❌', 'A single "no!" slash.'],
  ハ: ['a hat', '🎩', 'Two strokes like a hat: "ha".'],
  ヒ: ['a heel', '👠', 'A high heel: "hi".'],
  フ: ['a fool’s hook', '🪝', 'A hook in the air: "fu".'],
  ヘ: ['a hill', '⛰️', 'Same hill as hiragana: "he".'],
  ホ: ['a holy cross', '✝️', 'Ho! A cross with two arms.'],
  マ: ['a mama’s nose', '👃', 'A big nose: "ma".'],
  ミ: ['three missiles', '🚀', 'Three missiles: "mi".'],
  ム: ['a moo cow', '🐮', 'A cow’s nose: "mu".'],
  メ: ['a medal cross', '🏅', 'Two crossing strokes: "me".'],
  モ: ['more lines', '➕', 'More lines on a hook: "mo".'],
  ヤ: ['a yak', '🐃', 'A yak horn: "ya".'],
  ユ: ['a U-boat', '🚢', 'A boat bottom: "yu".'],
  ヨ: ['a yo-yo trick', '🪀', 'Three lines like a yo: "yo".'],
  ラ: ['a rabbit', '🐰', 'A rabbit ear on top: "ra".'],
  リ: ['reeds', '🎋', 'Two reeds: "ri".'],
  ル: ['roots', '🌱', 'Two roots in the ground: "ru".'],
  レ: ['a lever', '🎚️', 'A lever: "re".'],
  ロ: ['a robot head', '🤖', 'A square robot head: "ro".'],
  ワ: ['a wine glass', '🍷', 'A glass on its side: "wa".'],
  ヲ: ['a swimmer', '🏊', 'Whoa! A swimmer: "wo".'],
  ン: ['an n with a dot', '🔤', 'One drop and a slope: "n".'],
};

const TIPS: Record<string, string> = {
  ふ: 'Not a hard "f": blow gently through your lips, like cooling soup.',
  つ: '"tsu" as in "cats", all one sound.',
  ら: 'The R row is a quick tap of the tongue, between r, l and d.',
  ん: 'ん sounds like n, m or ng depending on what comes next.',
};
for (const c of ['り', 'る', 'れ', 'ろ']) TIPS[c] = TIPS['ら'];
const toKata = (s: string) => [...s].map((c) => String.fromCodePoint(c.codePointAt(0)! + 0x60)).join('');
for (const c of Object.keys(TIPS)) TIPS[toKata(c)] = TIPS[c];

const DAKUTEN: [string, string, string, string][] = [
  ['が', 'か', 'ga', 'ga'], ['ぎ', 'き', 'gi', 'ga'], ['ぐ', 'く', 'gu', 'ga'], ['げ', 'け', 'ge', 'ga'], ['ご', 'こ', 'go', 'ga'],
  ['ざ', 'さ', 'za', 'za'], ['じ', 'し', 'ji', 'za'], ['ず', 'す', 'zu', 'za'], ['ぜ', 'せ', 'ze', 'za'], ['ぞ', 'そ', 'zo', 'za'],
  ['だ', 'た', 'da', 'da'], ['ぢ', 'ち', 'ji', 'da'], ['づ', 'つ', 'zu', 'da'], ['で', 'て', 'de', 'da'], ['ど', 'と', 'do', 'da'],
  ['ば', 'は', 'ba', 'ba'], ['び', 'ひ', 'bi', 'ba'], ['ぶ', 'ふ', 'bu', 'ba'], ['べ', 'へ', 'be', 'ba'], ['ぼ', 'ほ', 'bo', 'ba'],
  ['ぱ', 'は', 'pa', 'pa'], ['ぴ', 'ひ', 'pi', 'pa'], ['ぷ', 'ふ', 'pu', 'pa'], ['ぺ', 'へ', 'pe', 'pa'], ['ぽ', 'ほ', 'po', 'pa'],
];

const YOON_BASE: [string, string][] = [
  ['き', 'ky'], ['し', 'sh'], ['ち', 'ch'], ['に', 'ny'], ['ひ', 'hy'], ['み', 'my'], ['り', 'ry'],
  ['ぎ', 'gy'], ['じ', 'j'], ['び', 'by'], ['ぴ', 'py'],
];
const SMALL: [string, string][] = [['ゃ', 'a'], ['ゅ', 'u'], ['ょ', 'o']];

export const KANA: Kana[] = [];
for (const script of ['hiragana', 'katakana'] as const) {
  const conv = (s: string) => (script === 'hiragana' ? s : toKata(s));
  for (const [h, k, romaji, row] of BASIC) {
    const char = script === 'hiragana' ? h : k;
    const [hook, emoji, story] = (script === 'hiragana' ? HIRA_MN : KATA_MN)[char];
    KANA.push({ char, romaji, script, kind: 'basic', row, hook, emoji, story, tip: TIPS[char] });
  }
  for (const [h, base, romaji, row] of DAKUTEN) {
    const mark = romaji.startsWith('p') ? '゜' : '゛';
    KANA.push({ char: conv(h), romaji, script, kind: 'dakuten', row, hook: `${conv(base)} + ${mark}` });
  }
  for (const [base, cons] of YOON_BASE) {
    for (const [small, v] of SMALL) {
      KANA.push({ char: conv(base + small), romaji: cons + v, script, kind: 'yoon', row: cons, hook: `${conv(base)} + ${conv(small)}` });
    }
  }
}

export const KANA_BY_CHAR: Record<string, Kana> = Object.fromEntries(KANA.map((k) => [k.char, k]));

export const GOJUON_COLUMNS = ['a', 'i', 'u', 'e', 'o'];

/** Rows for the chart grid; null marks an empty cell. */
export function chartRows(script: Script, kind: Kind): (Kana | null)[][] {
  const ks = KANA.filter((k) => k.script === script && k.kind === kind);
  if (kind === 'yoon') {
    const rows: Kana[][] = [];
    for (let i = 0; i < ks.length; i += 3) rows.push(ks.slice(i, i + 3));
    return rows;
  }
  const rows = new Map<string, Kana[]>();
  for (const k of ks) rows.set(k.row, [...(rows.get(k.row) ?? []), k]);
  return [...rows.values()].map((r) => {
    if (r.length === 5) return r;
    const vowel = (k: Kana) => (k.romaji === 'n' ? 0 : k.romaji === 'wo' ? 4 : 'aiueo'.indexOf(k.romaji.slice(-1)));
    const cells: (Kana | null)[] = [null, null, null, null, null];
    for (const k of r) cells[vowel(k)] = k;
    return cells;
  });
}

const LESSON_PLAN: [string, Kind, string[], string][] = [
  ['a', 'basic', ['a'], 'Vowels'],
  ['ka', 'basic', ['ka'], 'K row'],
  ['sa', 'basic', ['sa'], 'S row'],
  ['ta', 'basic', ['ta'], 'T row'],
  ['na', 'basic', ['na'], 'N row'],
  ['ha', 'basic', ['ha'], 'H row'],
  ['ma', 'basic', ['ma'], 'M row'],
  ['ya', 'basic', ['ya'], 'Y row'],
  ['ra', 'basic', ['ra'], 'R row'],
  ['wa', 'basic', ['wa', 'n'], 'W row and ん'],
  ['gz', 'dakuten', ['ga', 'za'], 'G and Z rows'],
  ['dbp', 'dakuten', ['da', 'ba', 'pa'], 'D, B and P rows'],
  ['yoon1', 'yoon', ['ky', 'sh', 'ch', 'ny'], 'Combinations 1'],
  ['yoon2', 'yoon', ['hy', 'my', 'ry'], 'Combinations 2'],
  ['yoon3', 'yoon', ['gy', 'j', 'by', 'py'], 'Combinations 3'],
];

export const LESSONS: Lesson[] = (['hiragana', 'katakana'] as const).flatMap((script) =>
  LESSON_PLAN.map(([id, kind, rows, title]) => ({
    id: `${script[0]}-${id}`,
    title,
    script,
    kind,
    chars: KANA.filter((k) => k.script === script && k.kind === kind && rows.includes(k.row)).map((k) => k.char),
  })),
);

export const LOOKALIKES: string[][] = [
  ['シ', 'ツ'], ['ソ', 'ン'], ['シ', 'ン'], ['ツ', 'ソ'], ['ぬ', 'め'], ['わ', 'れ', 'ね'], ['は', 'ほ'],
  ['る', 'ろ'], ['さ', 'き'], ['い', 'り'], ['ク', 'ケ', 'タ'], ['ウ', 'ワ', 'フ'], ['コ', 'ユ'],
  ['チ', 'テ'], ['ノ', 'メ'], ['あ', 'お'], ['こ', 'に'], ['さ', 'ち'], ['ク', 'ワ'], ['ス', 'ヌ'],
];
