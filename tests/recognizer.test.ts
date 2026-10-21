import { describe, expect, it } from 'vitest';
import strokesJson from '../web/src/data/strokes.json';
import { KANA } from '../web/src/data/kana';
import { checkDrawing, checkTraceStroke, type Stroke } from '../web/src/lib/recognizer';

const STROKES = strokesJson as Record<string, { d: string; pts: [number, number][] }[]>;
const ref = (c: string): Stroke[] => STROKES[c].map((s) => s.pts);
const writable = KANA.filter((k) => k.kind !== 'yoon').map((k) => k.char);

// Deterministic pseudo-random numbers so the test is stable.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Simulates a slightly sloppy hand: shifted, scaled, wobbly. */
function sloppy(strokes: Stroke[], wobble = 5): Stroke[] {
  const dx = (rand() - 0.5) * 30, dy = (rand() - 0.5) * 30, scale = 0.7 + rand() * 0.6;
  return strokes.map((s) => {
    const ox = (rand() - 0.5) * 16, oy = (rand() - 0.5) * 16;
    return s.map(([x, y]) => [x * scale + dx + ox + (rand() - 0.5) * wobble, y * scale + dy + oy + (rand() - 0.5) * wobble] as [number, number]);
  });
}

describe('checkDrawing', () => {
  it('accepts the reference strokes for every kana', () => {
    for (const c of writable) {
      const r = checkDrawing(ref(c), ref(c));
      expect(r.score, c).toBeGreaterThanOrEqual(95);
      expect(r.pass, c).toBe(true);
    }
  });

  it('accepts a sloppy but correct drawing', () => {
    const failures: string[] = [];
    for (const c of writable) {
      const r = checkDrawing(sloppy(ref(c)), ref(c));
      if (!r.pass) failures.push(`${c}:${r.score}`);
    }
    expect(failures.length, failures.join(' ')).toBeLessThanOrEqual(writable.length * 0.05);
  });

  it('flags a backwards stroke', () => {
    const s = ref('き');
    s[2] = [...s[2]].reverse();
    const r = checkDrawing(s, ref('き'));
    expect(r.issues.some((i) => i.kind === 'backwards' && i.stroke === 2)).toBe(true);
  });

  it('flags swapped stroke order', () => {
    const s = ref('た');
    [s[0], s[1]] = [s[1], s[0]];
    const r = checkDrawing(s, ref('た'));
    expect(r.issues.some((i) => i.kind === 'order')).toBe(true);
    expect(r.pass).toBe(false);
  });

  it('flags a missing stroke', () => {
    const r = checkDrawing(ref('き').slice(0, 3), ref('き'));
    expect(r.issues.some((i) => i.kind === 'missing')).toBe(true);
    expect(r.pass).toBe(false);
  });

  it('rejects a scribble', () => {
    const scribble: Stroke[] = [Array.from({ length: 40 }, (_, i) => [20 + rand() * 70, 20 + rand() * 70] as [number, number])];
    expect(checkDrawing(scribble, ref('あ')).pass).toBe(false);
    expect(checkDrawing(scribble, ref('ノ')).pass).toBe(false);
  });

  it('rejects most other characters with the same stroke count', () => {
    let tried = 0, wrongPass = 0;
    const passes: string[] = [];
    for (const a of writable) for (const b of writable) {
      if (a === b || STROKES[a].length !== STROKES[b].length) continue;
      tried++;
      if (checkDrawing(ref(a), ref(b)).pass) { wrongPass++; passes.push(a + b); }
    }
    console.log(`confusable passes ${wrongPass}/${tried}`, passes.slice(0, 60).join(' '));
    expect(wrongPass / tried).toBeLessThan(0.01);
  });
});

describe('checkTraceStroke', () => {
  it('accepts a traced stroke and spots a reversed one', () => {
    const s = ref('く')[0];
    expect(checkTraceStroke(s.map(([x, y]) => [x + 2, y - 1]), s).ok).toBe(true);
    const back = checkTraceStroke([...s].reverse(), s);
    expect(back.ok).toBe(false);
    expect(back.backwards).toBe(true);
  });
});
