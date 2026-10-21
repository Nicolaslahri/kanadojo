import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KANA_BY_CHAR } from '../data/kana';
import { questionSkill, type Question } from '../lib/questions';
import { recordAnswer } from '../lib/store';
import { buzz } from '../lib/haptics';
import { FreePad } from './DrawPad';
import { useSpeaker } from './Audio';
import { Ring } from './Ring';

export interface Answer {
  q: Question;
  correct: boolean;
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
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [left, setLeft] = useState(timeLimit ?? 0);
  const answers = useRef<Answer[]>([]);
  const { canSpeak, say } = useSpeaker();
  const q = questions[i];
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
    if (q?.type === 'listen' && canSpeak) {
      const t = setTimeout(() => say(q.char), 300);
      return () => clearTimeout(t);
    }
  }, [i]);

  if (!q) return null;

  const answer = (correct: boolean) => {
    setVerdict(correct);
    answers.current.push({ q, correct });
    const skill = questionSkill(q);
    if (record && skill && 'char' in q) recordAnswer(q.char, skill, correct, mode);
    if (correct) buzz(12);
    else buzz([40, 50, 40]);
    if (q.type === 'word') say(q.word.kana);
    else if (!correct || q.type === 'read') say(q.char);
    if (correct && (timeLimit || q.type !== 'write')) setTimeout(next, timeLimit ? 350 : 750);
  };

  const pick = (opt: string) => {
    if (verdict !== null) return;
    setPicked(opt);
    answer(opt === ('answer' in q ? q.answer : ''));
  };

  const next = () => {
    setPicked(null);
    setVerdict(null);
    setI((n) => {
      if (n + 1 >= questions.length) {
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
            <div className="progress"><div style={{ width: `${(i / questions.length) * 100}%` }} /></div>
            <span className="muted small">{i + 1}/{questions.length}</span>
          </>
        )}
      </div>

      <div key={i}>
        {q.type === 'read' && (
          <div className="prompt">
            <div className="label">How do you read this?</div>
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

        {'options' in q && (
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

      {verdict !== null && !(verdict && (timeLimit || q.type !== 'write')) && (
        <div className={`feedback ${verdict ? '' : 'bad'}`}>
          <div className="inner">
            <div className={`verdict ${verdict ? 'good' : 'bad'}`}>{verdict ? 'Correct!' : 'Not quite'}</div>
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

export function Results({ answers, title, children }: { answers: Answer[]; title: string; children?: ReactNode }) {
  const right = answers.filter((a) => a.correct).length;
  const pct = answers.length ? right / answers.length : 0;
  const mistakes = answers.filter((a) => !a.correct);
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
