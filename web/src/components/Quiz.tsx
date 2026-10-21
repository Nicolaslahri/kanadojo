import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { KANA_BY_CHAR } from '../data/kana';
import { questionSkill, type Question } from '../lib/questions';
import { kanaForRomaji, romajiMatches } from '../lib/romaji';
import { cardKey } from '../lib/srs';
import { getState, recordAnswer } from '../lib/store';
import { buzz } from '../lib/haptics';
import { FreePad } from './DrawPad';
import { useSpeaker } from './Audio';
import { Ring } from './Ring';

export interface Answer {
  q: Question;
  correct: boolean;
  /** A second try at something missed earlier in the same session; not part of the score. */
  retry?: boolean;
}

interface Item {
  q: Question;
  retry: boolean;
  /** Type the answer instead of picking it. */
  typed: boolean;
}

/** A missed question comes back this many questions later. */
const RETRY_GAP = 3;
/** Correct answers slower than this count as half-known. */
const SLOW_MS: Partial<Record<Question['type'], number>> = { read: 4500, recall: 5000, listen: 6000, word: 8000 };
const SLOW_TYPED_MS = 7000;

/** Typing is used for reading questions about kana you've already answered at least once. */
function shouldType(q: Question, timed: boolean) {
  if (timed || q.type !== 'read') return false;
  const s = getState();
  return s.settings.typing && (s.cards[cardKey(q.char, 'read')]?.correct ?? 0) > 0;
}

interface Props {
  questions: Question[];
  /** Stored with each review, e.g. "test" or "practice". */
  mode: string;
  onFinish: (answers: Answer[]) => void;
  onExit: () => void;
  /** Seconds for a timed round. */
  timeLimit?: number;
  record?: boolean;
}

export function Quiz({ questions, mode, onFinish, onExit, timeLimit, record = true }: Props) {
  const [items, setItems] = useState<Item[]>(() => questions.map((q) => ({ q, retry: false, typed: shouldType(q, !!timeLimit) })));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [slow, setSlow] = useState(false);
  const [left, setLeft] = useState(timeLimit ?? 0);
  const answers = useRef<Answer[]>([]);
  const shownAt = useRef(Date.now());
  const { canSpeak, say } = useSpeaker();
  const item = items[i];
  const q = item?.q;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onFinish(answers.current);
  };

  useEffect(() => {
    if (!timeLimit) return;
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) {
        clearInterval(t);
        finish();
        return 0;
      }
      return l - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [timeLimit]);

  useEffect(() => {
    shownAt.current = Date.now();
    if (q?.type === 'listen' && canSpeak) {
      const t = setTimeout(() => say(q.char), 300);
      return () => clearTimeout(t);
    }
  }, [i]);

  if (!q) return null;

  const answer = (correct: boolean, pickedChar?: string) => {
    const limit = item.typed ? SLOW_TYPED_MS : SLOW_MS[q.type];
    const isSlow = correct && !timeLimit && !item.retry && !!limit && Date.now() - shownAt.current > limit;
    setVerdict(correct);
    setSlow(isSlow);
    answers.current.push({ q, correct, retry: item.retry });
    const skill = questionSkill(q);
    // A retry is extra practice: the first miss already scheduled the card.
    if (record && skill && 'char' in q && !item.retry) recordAnswer(q.char, skill, correct, mode, { slow: isSlow, picked: pickedChar });
    if (!correct && !timeLimit && !item.retry) {
      setItems((list) => {
        const copy = [...list];
        copy.splice(Math.min(i + 1 + RETRY_GAP, copy.length), 0, { q, retry: true, typed: item.typed });
        return copy;
      });
    }
    if (correct) buzz(12);
    else buzz([40, 50, 40]);
    if (q.type === 'word') say(q.word.kana);
    else if (!correct || q.type === 'read') say(q.char);
    if (correct && !isSlow && (timeLimit || q.type !== 'write')) setTimeout(next, timeLimit ? 350 : 750);
  };

  /** Which kana the learner actually chose, so mix-ups can be drilled later. */
  const pickedKana = (opt: string) => {
    if (!('char' in q)) return undefined;
    if (q.type === 'recall' || q.type === 'listen') return opt;
    return kanaForRomaji(opt, KANA_BY_CHAR[q.char].script)?.char;
  };

  const pick = (opt: string) => {
    if (verdict !== null) return;
    setPicked(opt);
    const correct = opt === ('answer' in q ? q.answer : '');
    answer(correct, correct ? undefined : pickedKana(opt));
  };

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    if (verdict !== null || !typed.trim() || !('answer' in q)) return;
    const correct = romajiMatches(typed, q.answer);
    answer(correct, correct ? undefined : pickedKana(typed));
  };

  const next = () => {
    setPicked(null);
    setTyped('');
    setVerdict(null);
    setSlow(false);
    setI((n) => {
      if (n + 1 >= items.length) {
        setTimeout(finish, 0);
        return n;
      }
      return n + 1;
    });
  };

  const k = 'char' in q ? KANA_BY_CHAR[q.char] : null;

  return (
    <div>
      <div className="session-head">
        <button className="icon-btn" onClick={onExit} aria-label="Quit">✕</button>
        {timeLimit ? (
          <>
            <div className="progress"><div style={{ width: `${(left / timeLimit) * 100}%` }} /></div>
            <b>{left}s</b>
            <span className="chip">✓ {answers.current.filter((a) => a.correct).length}</span>
          </>
        ) : (
          <>
            <div className="progress"><div style={{ width: `${(i / items.length) * 100}%` }} /></div>
            <span className="muted small">{i + 1}/{items.length}</span>
          </>
        )}
      </div>

      <div key={i}>
        {item.retry && <div className="retry-tag">🔁 One more try</div>}
        {q.type === 'read' && (
          <div className="prompt">
            <div className="label">{item.typed ? 'Type how you read this' : 'How do you read this?'}</div>
            <div className="glyph kana">{q.char}</div>
          </div>
        )}
        {q.type === 'recall' && (
          <div className="prompt">
            <div className="label">Which {k?.script} is…</div>
            <div className="romaji-prompt">{k?.romaji}</div>
          </div>
        )}
        {q.type === 'listen' && (
          <div className="prompt">
            <div className="label">Which {k?.script} do you hear?</div>
            <button className="listen-big" onClick={() => say(q.char)} aria-label="Play again">🔊</button>
            <div className="small muted" style={{ marginTop: 8 }}>
              <button className="btn sm ghost" onClick={() => say(q.char, true)}>🐢 Slower</button>
            </div>
          </div>
        )}
        {q.type === 'word' && (
          <div className="prompt">
            <div className="label">Read this word</div>
            <div className="word-prompt kana">{q.word.kana}</div>
          </div>
        )}
        {q.type === 'write' && (
          <>
            <div className="prompt" style={{ marginBottom: 10 }}>
              <div className="label">Write the {k?.script} for</div>
              <div className="row" style={{ justifyContent: 'center' }}>
                <span className="romaji-prompt" style={{ fontSize: '2.4rem' }}>{k?.romaji}</span>
                {canSpeak && <button className="icon-btn" onClick={() => say(q.char)} aria-label="Listen">🔊</button>}
              </div>
            </div>
            <FreePad char={q.char} onResult={(r) => answer(r.pass)} />
          </>
        )}

        {item.typed && 'answer' in q && (
          <form className="typed-answer" onSubmit={submitTyped}>
            <input
              className={verdict === null ? '' : verdict ? 'correct' : 'wrong'}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="romaji, e.g. ka"
              aria-label="Your answer in romaji"
              autoFocus
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              disabled={verdict !== null}
            />
            <button className="btn primary" disabled={verdict !== null || !typed.trim()}>Check</button>
            <button type="button" className="btn sm ghost" disabled={verdict !== null}
              onClick={() => setItems((list) => list.map((it, n) => (n === i ? { ...it, typed: false } : it)))}>
              Show choices
            </button>
          </form>
        )}

        {'options' in q && !item.typed && (
          <div className="options">
            {q.options.map((opt) => {
              const isAnswer = opt === q.answer;
              const cls = verdict === null ? '' : isAnswer ? 'correct' : opt === picked ? 'wrong' : '';
              const isKana = q.type === 'recall' || q.type === 'listen';
              return (
                <button key={opt} className={`option ${isKana ? 'kana-opt' : ''} ${cls}`} onClick={() => pick(opt)} disabled={verdict !== null}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {verdict !== null && !(verdict && !slow && (timeLimit || q.type !== 'write')) && (
        <div className={`feedback ${verdict ? '' : 'bad'}`}>
          <div className="inner">
            <div className={`verdict ${verdict ? 'good' : 'bad'}`}>
              {!verdict ? 'Not quite' : slow ? 'Correct, but slow' : 'Correct!'}
            </div>
            {slow && <div className="muted small" style={{ marginBottom: 6 }}>It'll come back a bit sooner so it gets automatic.</div>}
            {!verdict && !timeLimit && !item.retry && <div className="muted small" style={{ marginBottom: 6 }}>You'll see this one again in a moment.</div>}
            {q.type === 'word' ? (
              <div className="answer-line">
                <span style={{ fontSize: '2rem' }}>{q.word.emoji}</span>
                <span><span className="kana">{q.word.kana}</span> = <b>{q.word.romaji}</b> · {q.word.meaning}</span>
              </div>
            ) : k && (
              <div className="answer-line">
                <span className="kana">{k.char}</span>
                <span>
                  <b>{k.romaji}</b>
                  {k.hook && <span className="muted"> · {k.emoji} {k.kind === 'basic' ? `looks like ${k.hook}` : k.hook}</span>}
                </span>
                <span className="spacer" />
                {canSpeak && <button className="icon-btn" onClick={() => say(k.char)} aria-label="Listen">🔊</button>}
              </div>
            )}
            <button className={`btn block ${verdict ? 'good' : 'primary'}`} onClick={next} autoFocus>Continue</button>
          </div>
        </div>
      )}
      {verdict !== null && <div style={{ height: 150 }} />}
    </div>
  );
}

const SKILL_ICON: Record<string, string> = { read: '👀', recall: '🧠', listen: '👂', write: '✍️', word: '📖' };

export function Results({ answers: all, title, children }: { answers: Answer[]; title: string; children?: ReactNode }) {
  const answers = all.filter((a) => !a.retry);
  const right = answers.filter((a) => a.correct).length;
  const pct = answers.length ? right / answers.length : 0;
  const mistakes = answers.filter((a) => !a.correct);
  const fixed = all.filter((a) => a.retry && a.correct).length;
  const { canSpeak, say } = useSpeaker();
  const msg = pct === 1 ? 'Perfect! 🌸' : pct >= 0.8 ? 'Great job! 🎉' : pct >= 0.5 ? 'Good effort — keep going 💪' : 'Every mistake is practice 🌱';
  return (
    <div>
      <h1 className="center" style={{ fontSize: '1.4rem' }}>{title}</h1>
      <div className="result-ring">
        <Ring value={pct} size={150} stroke={12} color={pct >= 0.8 ? 'var(--good)' : 'var(--accent)'}>
          <div className="center"><div className="num">{right}/{answers.length}</div><div className="muted small">{Math.round(pct * 100)}%</div></div>
        </Ring>
      </div>
      <p className="center" style={{ fontWeight: 650 }}>{msg}</p>
      {fixed > 0 && <p className="center muted small">🔁 {fixed} {fixed === 1 ? 'miss' : 'misses'} fixed on the second try</p>}
      {children}
      {mistakes.length > 0 && (
        <div className="card">
          <h2>Review your mistakes</h2>
          {mistakes.map((a, idx) => {
            if (a.q.type === 'word') {
              return (
                <div className="mistake" key={idx}>
                  <span className="kana" style={{ fontSize: '1.3rem', width: 'auto' }}>{a.q.word.kana}</span>
                  <span><b>{a.q.word.romaji}</b> · {a.q.word.meaning}</span>
                  <span className="spacer" />
                  {canSpeak && <button className="icon-btn" onClick={() => a.q.type === 'word' && say(a.q.word.kana)}>🔊</button>}
                </div>
              );
            }
            const k = KANA_BY_CHAR[a.q.char];
            return (
              <div className="mistake" key={idx}>
                <span className="kana">{k.char}</span>
                <span><b>{k.romaji}</b> <span className="muted small">{SKILL_ICON[a.q.type]} {a.q.type}</span></span>
                <span className="spacer" />
                {canSpeak && <button className="icon-btn" onClick={() => say(k.char)} aria-label="Listen">🔊</button>}
                <a className="icon-btn" href={`#/kana/${encodeURIComponent(k.char)}`} aria-label="Open">✍️</a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
