import { useMemo, useState } from 'react';
import { KANA, KANA_BY_CHAR, type Script } from '../data/kana';
import { WORDS } from '../data/words';
import {
  buildLookalikeQuiz, buildQuestion, buildWordQuestion, shuffle, wordsFor, type Question,
} from '../lib/questions';
import { isDue, skillsFor, type Skill } from '../lib/srs';
import { recordAnswer, useStore } from '../lib/store';
import { go } from '../lib/router';
import { useSpeaker } from '../components/Audio';
import { Quiz, Results, type Answer } from '../components/Quiz';
import { Mnemonic } from '../components/Mnemonic';

type Mode = 'review' | 'quiz' | 'flash' | 'listen' | 'write' | 'words' | 'lookalike' | 'speed';

const MODES: { id: Mode; emoji: string; title: string; desc: string }[] = [
  { id: 'review', emoji: '⏰', title: 'Due reviews', desc: 'Everything the schedule says you should see now' },
  { id: 'flash', emoji: '🃏', title: 'Flashcards', desc: 'Flip through with pictures and sounds' },
  { id: 'quiz', emoji: '🎯', title: 'Quick quiz', desc: 'Reading and recall, multiple choice' },
  { id: 'listen', emoji: '👂', title: 'Listening', desc: 'Hear it, pick the kana' },
  { id: 'write', emoji: '✍️', title: 'Writing', desc: 'Draw from memory and get graded' },
  { id: 'words', emoji: '📖', title: 'Read words', desc: 'Real words made of kana you know' },
  { id: 'lookalike', emoji: '👯', title: 'Look-alikes', desc: 'シ/ツ, ソ/ン, ぬ/め and friends' },
  { id: 'speed', emoji: '⚡', title: 'Speed round', desc: 'As many as you can in 60 seconds' },
];

const SIZE = 15;

export function Practice({ mode }: { mode?: Mode }) {
  const s = useStore((st) => st);
  const { canSpeak } = useSpeaker();
  const [script, setScript] = useState<Script | 'both'>('both');
  const [scope, setScope] = useState<'learned' | 'all'>(Object.keys(s.learned).length >= 3 ? 'learned' : 'all');
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [run, setRun] = useState(0);

  const pool = useMemo(() => KANA.filter((k) =>
    (script === 'both' || k.script === script) && (scope === 'all' ? k.kind === 'basic' || k.char in s.learned : k.char in s.learned),
  ).map((k) => k.char), [script, scope, s.learned]);

  const questions = useMemo<Question[]>(() => {
    if (!mode) return [];
    const known = new Set(pool);
    const pick = (skills: Skill[], n = SIZE) => shuffle(pool).slice(0, n).map((c) => {
      const options = skills.filter((sk) => skillsFor(KANA_BY_CHAR[c]).includes(sk));
      return buildQuestion(c, options[Math.floor(Math.random() * options.length)] ?? 'read', canSpeak, known);
    });
    switch (mode) {
      case 'review': {
        const now = Date.now();
        const due = Object.values(s.cards).filter((c) => c.char in s.learned && isDue(c, now)).sort((a, b) => a.due - b.due).slice(0, 30);
        return shuffle(due).map((c) => buildQuestion(c.char, c.skill, canSpeak, new Set(Object.keys(s.learned))));
      }
      case 'quiz': return pick(['read', 'recall']);
      case 'listen': return pick(['listen']);
      case 'write': return pick(['write'], 8);
      case 'speed': return Array.from({ length: 6 }, () => pick(['read'])).flat();
      case 'lookalike': return buildLookalikeQuiz(new Set(scope === 'all' ? KANA.map((k) => k.char) : pool));
      case 'words': {
        const known = scope === 'all' ? WORDS : wordsFor(new Set(Object.keys(s.learned)));
        const filtered = known.filter((w) => script === 'both' || (script === 'katakana') === /[ァ-ヺ]/.test(w.kana));
        return shuffle(filtered).slice(0, SIZE).map((w) => buildWordQuestion(w, WORDS));
      }
      default: return [];
    }
  }, [mode, pool, run]);
  const deck = useMemo(() => shuffle(pool), [pool, run]);

  if (!mode) {
    return (
      <div>
        <div className="topbar"><h1>Practice</h1></div>
        <Filters script={script} setScript={setScript} scope={scope} setScope={setScope} />
        {MODES.map((m) => (
          <a key={m.id} className="lesson-item" href={`#/practice/${m.id}`}>
            <span style={{ fontSize: '1.8rem' }}>{m.emoji}</span>
            <div><b>{m.title}</b><div className="muted small">{m.desc}</div></div>
            <span className="status">›</span>
          </a>
        ))}
      </div>
    );
  }

  const title = MODES.find((m) => m.id === mode)?.title ?? 'Practice';

  if (answers) {
    return (
      <Results answers={answers} title={mode === 'speed' ? `⚡ ${answers.filter((a) => a.correct).length} correct in 60s` : `${title} done`}>
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => { setAnswers(null); setRun((r) => r + 1); }}>Again</button>
          <a className="btn" style={{ flex: 1 }} href="#/practice">Other modes</a>
        </div>
      </Results>
    );
  }

  if (mode === 'flash') return <Flashcards chars={deck} onExit={() => go('/practice')} />;

  if (!questions.length) {
    return (
      <div>
        <div className="topbar"><button className="icon-btn" onClick={() => go('/practice')}>‹</button><h1>{title}</h1></div>
        <div className="card center">
          <div style={{ fontSize: '3rem' }}>{mode === 'review' ? '🎉' : '📚'}</div>
          <p>{mode === 'review' ? 'Nothing is due right now. Come back later, or try another mode.' : 'Nothing to practise with these filters yet. Learn a few more kana or switch to "All".'}</p>
          <a className="btn primary" href="#/practice">Back</a>
        </div>
      </div>
    );
  }

  return (
    <Quiz
      key={run}
      questions={questions}
      mode={`practice:${mode}`}
      timeLimit={mode === 'speed' ? 60 : undefined}
      record={mode !== 'speed' && (scope === 'learned' || mode === 'review')}
      onExit={() => go('/practice')}
      onFinish={setAnswers}
    />
  );
}

function Filters({ script, setScript, scope, setScope }: {
  script: Script | 'both'; setScript: (s: Script | 'both') => void; scope: 'learned' | 'all'; setScope: (s: 'learned' | 'all') => void;
}) {
  return (
    <>
      <div className="segmented">
        {(['hiragana', 'katakana', 'both'] as const).map((sc) => (
          <button key={sc} className={script === sc ? 'on' : ''} onClick={() => setScript(sc)}>
            {sc === 'both' ? 'Both' : sc === 'hiragana' ? 'ひらがな' : 'カタカナ'}
          </button>
        ))}
      </div>
      <div className="segmented">
        <button className={scope === 'learned' ? 'on' : ''} onClick={() => setScope('learned')}>Learned only</button>
        <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>All basics</button>
      </div>
    </>
  );
}

function Flashcards({ chars, onExit }: { chars: string[]; onExit: () => void }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const learned = useStore((s) => s.learned);
  const { say, canSpeak } = useSpeaker();
  const char = chars[i];
  if (!char) {
    return (
      <div className="card center">
        <div style={{ fontSize: '3rem' }}>🃏</div>
        <p>{chars.length ? 'You went through the whole deck!' : 'No cards with these filters.'}</p>
        <button className="btn primary" onClick={onExit}>Done</button>
      </div>
    );
  }
  const rate = (knew: boolean) => {
    if (char in learned) recordAnswer(char, 'read', knew, 'practice:flash');
    setFlipped(false);
    setI(i + 1);
  };
  return (
    <div>
      <div className="session-head">
        <button className="icon-btn" onClick={onExit}>✕</button>
        <div className="progress"><div style={{ width: `${(i / chars.length) * 100}%` }} /></div>
        <span className="muted small">{i + 1}/{chars.length}</span>
      </div>
      {!flipped ? (
        <button className="flashcard" onClick={() => { setFlipped(true); if (canSpeak) say(char); }}>
          <div>
            <div className="glyph kana">{char}</div>
            <div className="muted small" style={{ marginTop: 16 }}>Tap to reveal</div>
          </div>
        </button>
      ) : (
        <>
          <Mnemonic char={char} />
          <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
            {canSpeak && <button className="btn sm" onClick={() => say(char)}>🔊 Listen again</button>}
          </div>
          <div className="row">
            <button className="btn primary" style={{ flex: 1 }} onClick={() => rate(false)}>😕 Didn't know</button>
            <button className="btn good" style={{ flex: 1 }} onClick={() => rate(true)}>😊 Knew it</button>
          </div>
        </>
      )}
    </div>
  );
}

export const PRACTICE_MODES = MODES.map((m) => m.id);
export type { Mode as PracticeMode };
