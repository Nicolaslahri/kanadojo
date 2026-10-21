// Lists the recorded clips in web/public/audio so the app knows which ones exist.
// Name each clip after the code points of its text: あ → 3042.mp3, きゃ → 304d-3083.mp3.
import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'audio');
const names = (await readdir(dir)).filter((f) => /^[0-9a-f]+(-[0-9a-f]+)*\.mp3$/.test(f)).map((f) => f.slice(0, -4)).sort();
await writeFile(join(dir, 'clips.json'), JSON.stringify(names) + '\n');
console.log(`listed ${names.length} clips in ${join(dir, 'clips.json')}`);
