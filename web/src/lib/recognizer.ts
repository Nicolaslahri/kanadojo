// Compares hand-drawn strokes against KanjiVG reference strokes.
// All coordinates live in KanjiVG's 109×109 box.

export type Point = [number, number];
export type Stroke = Point[];

export type IssueKind = 'missing' | 'extra' | 'backwards' | 'order' | 'shape';

export interface StrokeResult {
  /** Index of the reference stroke this user stroke was compared with. */
  ref: number;
  quality: number;
  backwards: boolean;
}

export interface Issue {
  kind: IssueKind;
  stroke: number;
  other?: number;
  message: string;
}

export interface CheckResult {
  score: number;
  pass: boolean;
  strokes: StrokeResult[];
  issues: Issue[];
  /** User strokes after normalisation, for drawing the overlay. */
  normalized: Stroke[];
  /** Reference strokes after normalisation. */
  reference: Stroke[];
}

const N = 32;
export const PASS_SCORE = 70;
/** Every single stroke has to be at least roughly right. */
const MIN_STROKE_QUALITY = 0.4;

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function strokeLength(s: Stroke) {
  let len = 0;
  for (let i = 1; i < s.length; i++) len += dist(s[i - 1], s[i]);
  return len;
}

export function resample(s: Stroke, n = N): Stroke {
  if (s.length === 0) return [];
  if (s.length === 1) return Array.from({ length: n }, () => [s[0][0], s[0][1]] as Point);
  const total = strokeLength(s);
  if (total === 0) return Array.from({ length: n }, () => [s[0][0], s[0][1]] as Point);
  const out: Stroke = [[s[0][0], s[0][1]]];
  const step = total / (n - 1);
  let acc = 0;
  let prev = s[0];
  for (let i = 1; i < s.length && out.length < n; i++) {
    let cur = s[i];
    let d = dist(prev, cur);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const p: Point = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
      out.push(p);
      prev = p;
      d = dist(prev, cur);
      acc = 0;
    }
    acc += d;
    prev = cur;
  }
  while (out.length < n) out.push([s[s.length - 1][0], s[s.length - 1][1]]);
  return out;
}

function bbox(strokes: Stroke[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const [x, y] of s) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Centres the drawing and scales its larger side to `size`, keeping the aspect ratio. */
export function normalize(strokes: Stroke[], size = 80): Stroke[] {
  const { minX, minY, maxX, maxY } = bbox(strokes);
  const scale = size / Math.max(maxX - minX, maxY - minY, 1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return strokes.map((s) => s.map(([x, y]) => [54.5 + (x - cx) * scale, 54.5 + (y - cy) * scale] as Point));
}

/**
 * Distance between two resampled strokes. Mixes the mean point distance (overall shape and
 * position) with the worst point (catches a missing loop or hook at the end of a stroke).
 */
function meanDist(a: Stroke, b: Stroke) {
  let sum = 0, worst = 0;
  for (let i = 0; i < a.length; i++) {
    const d = dist(a[i], b[i]);
    sum += d;
    worst = Math.max(worst, d);
  }
  return Math.max(sum / a.length, worst * 0.6);
}

const reversed = (s: Stroke) => [...s].reverse();

/** Distance-to-quality mapping: ≤ 7 units is perfect, ≥ 26 units is worthless. */
const quality = (d: number) => Math.max(0, Math.min(1, 1 - (d - 7) / 19));

export interface StrokeMatch {
  forward: number;
  backward: number;
}

export function compareStroke(user: Stroke, ref: Stroke): StrokeMatch {
  const u = resample(user), r = resample(ref);
  return { forward: meanDist(u, r), backward: meanDist(reversed(u), r) };
}

/**
 * Checks one stroke while tracing over the guide (no normalisation, positions must line up).
 */
export function checkTraceStroke(user: Stroke, ref: Stroke): { ok: boolean; backwards: boolean } {
  const { forward, backward } = compareStroke(user, ref);
  if (forward <= 14) return { ok: true, backwards: false };
  return { ok: false, backwards: backward <= 14 && backward < forward };
}

/** Grades a full drawing made from memory. */
export function checkDrawing(userRaw: Stroke[], refRaw: Stroke[]): CheckResult {
  const user = userRaw.filter((s) => s.length > 1 && strokeLength(s) > 0.5);
  if (user.length === 0) {
    return { score: 0, pass: false, strokes: [], issues: [{ kind: 'missing', stroke: 0, message: 'Draw the character first.' }], normalized: [], reference: normalize(refRaw) };
  }
  const reference = normalize(refRaw).map((s) => resample(s));
  const normalized = normalize(user).map((s) => resample(s));

  const issues: Issue[] = [];
  const strokes: StrokeResult[] = [];
  const cost = normalized.map((u) => reference.map((r) => {
    const f = meanDist(u, r), b = meanDist(reversed(u), r);
    return { f, b, best: Math.min(f, b) };
  }));

  // Greedy assignment of user strokes to reference strokes, best pairs first.
  const pairs: [number, number, number][] = [];
  cost.forEach((row, i) => row.forEach((c, j) => pairs.push([c.best, i, j])));
  pairs.sort((a, b) => a[0] - b[0]);
  let userToRef = new Map<number, number>();
  let usedRef = new Set<number>();
  for (const [, i, j] of pairs) {
    if (userToRef.has(i) || usedRef.has(j)) continue;
    userToRef.set(i, j);
    usedRef.add(j);
  }
  // Small neighbouring strokes (like the dakuten dashes) can swap in a greedy match even when
  // written in the right order, so keep the in-order match unless it is clearly worse.
  if (normalized.length === reference.length) {
    let greedyCost = 0, inOrderCost = 0;
    userToRef.forEach((j, i) => { greedyCost += cost[i][j].best; });
    cost.forEach((row, i) => { inOrderCost += row[i].best; });
    if (inOrderCost <= greedyCost * 1.2 + 2 * reference.length) {
      userToRef = new Map(reference.map((_, i) => [i, i]));
      usedRef = new Set(reference.map((_, i) => i));
    }
  }

  // Long strokes carry the character's shape, so they count more than little dashes.
  const weight = reference.map((r) => Math.sqrt(strokeLength(r)) + 2);
  const totalWeight = weight.reduce((a, b) => a + b, 0);
  let qualitySum = 0;
  let penalty = 0;
  normalized.forEach((_, i) => {
    const j = userToRef.get(i);
    if (j === undefined) {
      strokes.push({ ref: -1, quality: 0, backwards: false });
      issues.push({ kind: 'extra', stroke: i, message: `Stroke ${i + 1} is an extra stroke — this character has ${reference.length}.` });
      penalty += 12;
      return;
    }
    const c = cost[i][j];
    const backwards = c.b < c.f && c.f > 12;
    const q = quality(c.best);
    strokes.push({ ref: j, quality: q, backwards });
    qualitySum += q * weight[j];
    if (backwards) {
      issues.push({ kind: 'backwards', stroke: i, message: `Stroke ${i + 1} goes the wrong way.` });
      penalty += 15;
    }
    if (q < 0.5) {
      issues.push({ kind: 'shape', stroke: i, message: `Stroke ${i + 1} doesn't quite match the shape or position.` });
    }
  });

  reference.forEach((_, j) => {
    if (!usedRef.has(j)) {
      issues.push({ kind: 'missing', stroke: j, message: `Stroke ${j + 1} is missing — this character has ${reference.length} strokes.` });
    }
  });

  // Order: user stroke i should map to reference stroke i.
  const order = [...userToRef.entries()].sort((a, b) => a[0] - b[0]).map(([, j]) => j);
  for (let k = 1; k < order.length; k++) {
    if (order[k] < order[k - 1]) {
      const [a, b] = [order[k], order[k - 1]].sort((x, y) => x - y);
      issues.push({ kind: 'order', stroke: a, other: b, message: `Stroke order: stroke ${a + 1} should come before stroke ${b + 1}.` });
      penalty += 15;
    }
  }

  const score = Math.max(0, Math.round((100 * qualitySum) / totalWeight - penalty));
  const pass = score >= PASS_SCORE
    && normalized.length === reference.length
    && strokes.every((s) => s.quality >= MIN_STROKE_QUALITY)
    && !issues.some((i) => i.kind === 'order' || i.kind === 'backwards');
  return { score, pass, strokes, issues, normalized, reference };
}
