import data from '../data/strokes.json';
import type { Stroke } from './recognizer';

export interface RefStroke {
  d: string;
  pts: Stroke;
}

const STROKES = data as unknown as Record<string, RefStroke[]>;

export const strokesFor = (char: string): RefStroke[] => STROKES[char] ?? [];
export const canWrite = (char: string) => !!STROKES[char];
