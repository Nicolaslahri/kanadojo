import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { checkDrawing, checkTraceStroke, type CheckResult, type Point, type Stroke } from '../lib/recognizer';
import { strokesFor } from '../lib/strokes';
import { buzz } from '../lib/haptics';
import { GridLines } from './StrokeAnimator';

const toPath = (s: Stroke) => (s.length ? `M${s.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}` : '');

function usePen(onStroke: (s: Stroke) => void, disabled: boolean) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const currentRef = useRef<Stroke | null>(null);

  const toPoint = (e: PointerEvent<SVGSVGElement>): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 109, ((e.clientY - r.top) / r.height) * 109];
  };

  const handlers = {
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      currentRef.current = [toPoint(e)];
      setCurrent(currentRef.current);
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
      if (!currentRef.current) return;
      const events = (e.nativeEvent as globalThis.PointerEvent).getCoalescedEvents?.() ?? [];
      const pts = events.length
        ? events.map((ev) => toPoint({ clientX: ev.clientX, clientY: ev.clientY } as PointerEvent<SVGSVGElement>))
        : [toPoint(e)];
      currentRef.current = [...currentRef.current, ...pts];
      setCurrent(currentRef.current);
    },
    onPointerUp: () => {
      const s = currentRef.current;
      currentRef.current = null;
      setCurrent(null);
      if (s && s.length > 1) onStroke(s);
      else if (s) onStroke([s[0], [s[0][0] + 0.5, s[0][1] + 0.5]]);
    },
    onPointerCancel: () => {
      currentRef.current = null;
      setCurrent(null);
    },
  };
  return { svgRef, current, handlers };
}

/** Trace over the faint guide, one stroke at a time, with hints when a stroke is off. */
export function TracePad({ char, onDone }: { char: string; onDone: (cleanFirstTry: boolean) => void }) {
  const ref = strokesFor(char);
  const [done, setDone] = useState(0);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean }>({ text: 'Trace stroke 1, starting at the red dot.' });
  const [misses, setMisses] = useState(0);
  const [hint, setHint] = useState(0);
  const clean = useRef(true);

  useEffect(() => {
    setDone(0);
    setMisses(0);
    clean.current = true;
    setMsg({ text: 'Trace stroke 1, starting at the red dot.' });
  }, [char]);

  const finished = done >= ref.length;
  const { svgRef, current, handlers } = usePen((s) => {
    if (finished) return;
    const res = checkTraceStroke(s, ref[done].pts);
    if (res.ok) {
      buzz(10);
      const next = done + 1;
      setDone(next);
      setMisses(0);
      if (next >= ref.length) {
        setMsg({ text: 'Nice! 🎉' });
        setTimeout(() => onDone(clean.current), 600);
      } else {
        setMsg({ text: `Good. Now stroke ${next + 1}.` });
      }
    } else {
      clean.current = false;
      buzz([30, 40, 30]);
      setMisses((m) => m + 1);
      setHint((h) => h + 1);
      setMsg({ text: res.backwards ? 'Other direction — start from the red dot.' : 'Not quite — follow the grey stroke.', bad: true });
    }
  }, finished);

  const target = ref[done];
  return (
    <div className="pad-wrap">
      <svg className="pad" viewBox="0 0 109 109" ref={svgRef} {...handlers}>
        <GridLines />
        {ref.map((s, i) => <path key={i} className={i < done ? 'done-stroke' : 'ref'} d={s.d} />)}
        {target && misses > 0 && <path key={`h${hint}`} className="hint draw-in" d={target.d} pathLength={1} />}
        {target && <circle className="start-dot" cx={target.pts[0][0]} cy={target.pts[0][1]} r={3.2} />}
        {current && <path className="user" d={toPath(current)} />}
      </svg>
      <p className={`pad-msg ${msg.bad ? 'bad' : ''}`}>{msg.text}</p>
    </div>
  );
}

/** Draw from memory, then get graded stroke by stroke. */
export function FreePad({ char, onResult, guide = false }: { char: string; onResult?: (r: CheckResult) => void; guide?: boolean }) {
  const ref = strokesFor(char);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    setStrokes([]);
    setResult(null);
  }, [char]);

  const { svgRef, current, handlers } = usePen((s) => setStrokes((all) => [...all, s]), !!result);

  const check = () => {
    const r = checkDrawing(strokes, ref.map((s) => s.pts));
    setResult(r);
    buzz(r.pass ? 15 : [30, 40, 30]);
    onResult?.(r);
  };

  const cls = (q: number) => (q >= 0.7 ? 'good' : q >= 0.4 ? 'meh' : 'bad');

  return (
    <div className="pad-wrap">
      <svg className="pad" viewBox="0 0 109 109" ref={svgRef} {...handlers}>
        <GridLines />
        {guide && !result && ref.map((s, i) => <path key={i} className="ref" d={s.d} />)}
        {result ? (
          <>
            {result.reference.map((s, i) => <path key={`r${i}`} className="answer" d={toPath(s)} />)}
            {result.normalized.map((s, i) => (
              <path key={`u${i}`} className={`user ${cls(result.strokes[i]?.quality ?? 0)}`} d={toPath(s)} />
            ))}
          </>
        ) : (
          strokes.map((s, i) => <path key={i} className="user" d={toPath(s)} />)
        )}
        {current && <path className="user" d={toPath(current)} />}
      </svg>
      {!result && (
        <div className="pad-tools">
          <button className="btn sm ghost" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>↶ Undo</button>
          <button className="btn sm ghost" onClick={() => setStrokes([])} disabled={!strokes.length}>✕ Clear</button>
          <button className="btn sm primary" onClick={check} disabled={!strokes.length}>✓ Check</button>
        </div>
      )}
      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row">
            <span className={`score-badge ${result.pass ? '' : 'bad'}`}>{result.score}</span>
            <div>
              <b>{result.pass ? 'Looks right! ✨' : 'Not quite yet'}</b>
              {result.issues.length > 0 ? (
                <ul className="issues">{result.issues.slice(0, 3).map((iss, i) => <li key={i}>{iss.message}</li>)}</ul>
              ) : (
                <div className="muted small">Shape, order and direction all match.</div>
              )}
            </div>
          </div>
          {!onResult && (
            <button className="btn sm ghost block" style={{ marginTop: 12 }} onClick={() => { setResult(null); setStrokes([]); }}>Try again</button>
          )}
        </div>
      )}
    </div>
  );
}
