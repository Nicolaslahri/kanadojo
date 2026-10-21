import { useMemo, useState } from 'react';
import { KANA_BY_CHAR, LESSONS } from '../data/kana';
import { buildQuestion, shuffle, type Question } from '../lib/questions';
import { markLearned, recordAnswer, useStore } from '../lib/store';
import { go } from '../lib/router';
import { canWrite } from '../lib/strokes';
import { Mnemonic, Tip } from '../components/Mnemonic';
import { AudioPanel, useSpeaker } from '../components/Audio';
import { StrokeAnimator } from '../components/StrokeAnimator';
import { FreePad, TracePad } from '../components/DrawPad';
import { Quiz, Results, type Answer } from '../components/Quiz';
import { nextLesson } from './progress';

type Step = 'meet' | 'watch' | 'trace' | 'draw';
const STEP_LABEL: Record<Step, string> = { meet: 'Meet', watch: 'Watch the strokes', trace: 'Trace it', draw: 'Draw from memory' };

export function Lesson({ id }: { id: string }) {
  const lesson = LESSONS.find((l) => l.id === id);
  const learned = useStore((s) => s.learned);
  const showRomaji = useStore((s) => s.settings.romaji);
  const { canSpeak } = useSpeaker();
  const [idx, setIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<'learn' | 'quiz' | 'done'>('learn');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [drawTry, setDrawTry] = useState(0);
  const [drawn, setDrawn] = useState<boolean | null>(null);

  const quiz = useMemo<Question[]>(() => {
    if (!lesson) return [];
    const skills = canSpeak ? (['read', 'recall', 'listen'] as const) : (['read', 'recall'] as const);
    const known = new Set([...lesson.chars, ...Object.keys(learned)]);
    return shuffle(lesson.chars.flatMap((c) => skills.map((s) => buildQuestion(c, s, canSpeak, known))));
  }, [lesson, canSpeak, phase === 'quiz']);

  if (!lesson) return <p>Lesson not found. <a href="#/learn">Back to lessons</a></p>;

  const char = lesson.chars[idx];
  const steps: Step[] = canWrite(char) ? ['meet', 'watch', 'trace', 'draw'] : ['meet'];
  const step = steps[stepIdx];
  const totalSteps = lesson.chars.reduce((n, c) => n + (canWrite(c) ? 4 : 1), 0) + 1;
  const doneSteps = lesson.chars.slice(0, idx).reduce((n, c) => n + (canWrite(c) ? 4 : 1), 0) + stepIdx;

  const advance = () => {
    setDrawn(null);
    setDrawTry(0);
    if (stepIdx + 1 < steps.length) {
      setStepIdx(stepIdx + 1);
    } else if (idx + 1 < lesson.chars.length) {
      setIdx(idx + 1);
      setStepIdx(0);
    } else {
      markLearned(lesson.chars);
      setPhase('quiz');
    }
    window.scrollTo(0, 0);
  };

  if (phase === 'quiz') {
    return (
      <Quiz
        questions={quiz}
        mode="lesson"
        onExit={() => go('/learn')}
        onFinish={(a) => {
          setAnswers(a);
          setPhase('done');
        }}
      />
    );
  }

  if (phase === 'done') {
    const following = nextLesson(lesson.script, learned);
    return (
      <Results answers={answers} title={`${lesson.title} complete!`}>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            You learned <span className="kana" style={{ fontSize: '1.2rem' }}>{lesson.chars.join(' ')}</span>. They'll now show up in your daily
            tests and reviews so they stick.
          </p>
          <div className="stack">
            {following && <a className="btn primary block" href={`#/lesson/${following.id}`}>Next: {following.title}</a>}
            <a className="btn block" href="#/learn">Back to lessons</a>
          </div>
        </div>
      </Results>
    );
  }

  const k = KANA_BY_CHAR[char];
  return (
    <div>
      <div className="session-head">
        <button className="icon-btn" onClick={() => go('/learn')} aria-label="Close">✕</button>
        <div className="progress"><div style={{ width: `${(doneSteps / totalSteps) * 100}%` }} /></div>
        <span className="kana" style={{ fontSize: '1.3rem' }}>{char}</span>
      </div>
      <div className="step-label">{STEP_LABEL[step]} · {idx + 1}/{lesson.chars.length}</div>

      {step === 'meet' && (
        <>
          <Mnemonic char={char} showRomaji />
          <AudioPanel text={char} autoPlay />
          <Tip char={char} />
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={advance}>
            {steps.length > 1 ? 'Next: how to write it' : idx + 1 < lesson.chars.length ? 'Next' : 'Start quiz'}
          </button>
        </>
      )}

      {step === 'watch' && (
        <>
          <StrokeAnimator char={char} />
          <p className="center muted small">Japanese strokes generally go top → bottom and left → right. Tap to replay.</p>
          <button className="btn primary block" onClick={advance}>Got it — let me trace</button>
        </>
      )}

      {step === 'trace' && (
        <>
          <TracePad char={char} onDone={advance} />
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button className="btn sm ghost" onClick={advance}>Skip</button>
          </div>
        </>
      )}

      {step === 'draw' && (
        <>
          <p className="center" style={{ margin: '0 0 10px' }}>
            Draw <b>{showRomaji ? k.romaji : '…'}</b> without the guide.
          </p>
          <FreePad
            key={drawTry}
            char={char}
            onResult={(r) => {
              if (drawn === null) recordAnswer(char, 'write', r.pass, 'lesson');
              setDrawn(r.pass);
            }}
          />
          {drawn !== null && (
            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn block" style={{ flex: 1 }} onClick={() => setDrawTry((t) => t + 1)}>Try again</button>
              <button className={`btn block ${drawn ? 'good' : 'primary'}`} style={{ flex: 1 }} onClick={advance}>
                {idx + 1 < lesson.chars.length ? 'Next kana' : 'Start quiz'}
              </button>
            </div>
          )}
          {drawn === null && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button className="btn sm ghost" onClick={advance}>Skip</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
