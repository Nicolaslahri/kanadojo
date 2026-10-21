// Builds web/src/data/strokes.json from KanjiVG stroke data (CC BY-SA 3.0).
// SVGs are read from scripts/.cache/kanjivg when present, otherwise downloaded.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(here, '.cache', 'kanjivg');
const outFile = join(here, '..', 'web', 'src', 'data', 'strokes.json');
const SAMPLES = 48;

const hira = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゃゅょっ';
const kata = [...hira].map((c) => String.fromCodePoint(c.codePointAt(0) + 0x60)).join('');
const chars = [...hira, ...kata, 'ー'];

const hex = (c) => c.codePointAt(0).toString(16).padStart(5, '0');

async function loadSvg(c) {
  const file = join(cacheDir, `${hex(c)}.svg`);
  try {
    await access(file);
    return readFile(file, 'utf8');
  } catch {
    const res = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex(c)}.svg`);
    if (!res.ok) throw new Error(`download failed for ${c}: ${res.status}`);
    const text = await res.text();
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, text);
    return text;
  }
}

// Flattens an SVG path (M/m, L/l, C/c, S/s, H/h, V/v) into a dense polyline.
function flatten(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const pts = [];
  let i = 0, cmd = '', x = 0, y = 0, lcx = 0, lcy = 0;
  const num = () => parseFloat(tokens[i++]);
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    for (let t = 1; t <= 16; t++) {
      const s = t / 16, u = 1 - s;
      pts.push([
        u * u * u * x + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x3,
        u * u * u * y + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * y3,
      ]);
    }
    lcx = x2; lcy = y2; x = x3; y = y3;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toLowerCase()) {
      case 'm': x = ox + num(); y = oy + num(); pts.push([x, y]); lcx = x; lcy = y; cmd = rel ? 'l' : 'L'; break;
      case 'l': x = ox + num(); y = oy + num(); pts.push([x, y]); lcx = x; lcy = y; break;
      case 'h': x = ox + num(); pts.push([x, y]); lcx = x; lcy = y; break;
      case 'v': y = oy + num(); pts.push([x, y]); lcx = x; lcy = y; break;
      case 'c': cubic(ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()); break;
      case 's': { const x1 = 2 * x - lcx, y1 = 2 * y - lcy; cubic(x1, y1, ox + num(), oy + num(), ox + num(), oy + num()); break; }
      default: throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return pts;
}

function resample(pts, n) {
  const dists = [0];
  for (let k = 1; k < pts.length; k++) {
    dists.push(dists[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  const total = dists[dists.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (j < dists.length - 2 && dists[j + 1] < target) j++;
    const seg = dists[j + 1] - dists[j] || 1;
    const t = Math.min(1, Math.max(0, (target - dists[j]) / seg));
    out.push([
      +(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t).toFixed(1),
      +(pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t).toFixed(1),
    ]);
  }
  return out;
}

const result = {};
for (const c of chars) {
  const svg = await loadSvg(c);
  const paths = [...svg.matchAll(/<path[^>]*id="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((m) => m[2]);
  if (!paths.length) throw new Error(`no strokes for ${c}`);
  result[c] = paths.map((d) => ({ d, pts: resample(flatten(d), SAMPLES) }));
}

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(result));
console.log(`wrote ${Object.keys(result).length} characters to ${outFile}`);
