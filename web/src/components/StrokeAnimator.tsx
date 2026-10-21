import { useState } from 'react';
import { strokesFor } from '../lib/strokes';

const STROKE_S = 0.7;
const GAP_S = 0.25;

/** Animated stroke order with numbered starting points. */
export function StrokeAnimator({ char, numbers = true }: { char: string; numbers?: boolean }) {
  const [run, setRun] = useState(0);
  const strokes = strokesFor(char);
  return (
    <div className="pad-wrap">
      <svg className="pad anim" viewBox="0 0 109 109" key={run} onClick={() => setRun((r) => r + 1)} role="img" aria-label={`Stroke order for ${char}`}>
        <GridLines />
        {strokes.map((s, i) => <path key={`g${i}`} className="ghost" d={s.d} />)}
        {strokes.map((s, i) => (
          <path
            key={i}
            className="stroke draw-in"
            d={s.d}
            pathLength={1}
            style={{ animationDelay: `${0.3 + i * (STROKE_S + GAP_S)}s`, ['--dur' as string]: `${STROKE_S}s` }}
          />
        ))}
        {numbers && strokes.map((s, i) => (
          <g key={`n${i}`}>
            <circle className="num-bg" cx={s.pts[0][0]} cy={s.pts[0][1]} r={4} />
            <text className="num" x={s.pts[0][0]} y={s.pts[0][1] + 2.1} textAnchor="middle">{i + 1}</text>
          </g>
        ))}
      </svg>
      <div className="pad-tools">
        <button className="btn sm ghost" onClick={() => setRun((r) => r + 1)}>↻ Replay</button>
        <span className="muted small" style={{ alignSelf: 'center' }}>{strokes.length} stroke{strokes.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

export function GridLines() {
  return (
    <>
      <line className="gridline" x1="54.5" y1="4" x2="54.5" y2="105" />
      <line className="gridline" x1="4" y1="54.5" x2="105" y2="54.5" />
    </>
  );
}
