import { useState } from 'react';
import { KANA_BY_CHAR } from '../data/kana';
import { buildDailyTest, DAILY_SIZE, type Question } from '../lib/questions';
import { dayKey } from '../lib/srs';
import { getState, saveTest, useStore } from '../lib/store';
import { go } from '../lib/router';
import { useSpeaker } from '../components/Audio';
import { Quiz, Results, type Answer } from '../components/Quiz';
import { Ring } from '../components/Ring';
import { currentStreak } from './progress';

export function DailyTest() {
  const day = dayKey();
  const s = useStore((st) => st);
  const { canSpeak, say } = useSpeaker();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const learned = Object.keys(s.learned);
  const done = s.tests[day];

  if (questions && !answers) {
    return (
      <Quiz
        questions={questions}
        mode="test"
        onExit={() => go('/')}
        onFinish={(a) => {
          setAnswers(a);
          saveTest(day, {
            score: a.filter((x) => x.correct).length,
            total: a.length,
            at: Date.now(),
            details: a.flatMap((x) => (x.q.type === 'word' ? [] : [{ char: x.q.char, skill: x.q.type, correct: x.correct }])),
          });
        }}
      />
    );
  }

  if (answers) {
    return (
      <Results answers={answers} title="Daily test complete">
        <div className="card center">
          <div style={{ fontSize: '2.2rem' }}>🔥 {currentStreak(getState())}</div>
          <div className="muted">day streak</div>
        </div>
        <a className="btn primary block" href="#/">Done</a>
      </Results>
    );
  }

  if (done) {
    const missed = done.details?.filter((d) => !d.correct) ?? [];
    return (
      <div>
        <div className="topbar"><button className="icon-btn" onClick={() => go('/')}>‹</button><h1>Today's test</h1></div>
        <div className="card center">
          <div className="result-ring"><Ring value={done.score / done.total} size={130} stroke={11} color="var(--good)"><span className="num" style={{ fontSize: '1.8rem' }}>{done.score}/{done.total}</span></Ring></div>
          <b>Done for today ✓</b>
          <p className="muted">A new test unlocks tomorrow. Want more? Practice is unlimited.</p>
        </div>
        {missed.length > 0 && (
          <div className="card">
            <h2>Missed today</h2>
            {missed.map((d, i) => {
              const k = KANA_BY_CHAR[d.char];
              return (
                <div className="mistake" key={i}>
                  <span className="kana">{k.char}</span>
                  <span><b>{k.romaji}</b> <span className="muted small">{d.skill}</span></span>
                  <span className="spacer" />
                  {canSpeak && <button className="icon-btn" onClick={() => say(k.char)}>🔊</button>}
                  <a className="icon-btn" href={`#/kana/${encodeURIComponent(k.char)}`}>✍️</a>
                </div>
              );
            })}
          </div>
        )}
        <a className="btn primary block" href="#/practice">Practise more</a>
      </div>
    );
  }

  if (learned.length < 3) {
    return (
      <div>
        <div className="topbar"><button className="icon-btn" onClick={() => go('/')}>‹</button><h1>Today's test</h1></div>
        <div className="card center">
          <div style={{ fontSize: '3rem' }}>📚</div>
          <p>Finish your first lesson to unlock daily tests.</p>
          <a className="btn primary" href="#/lesson/h-a">Start with the vowels</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar"><button className="icon-btn" onClick={() => go('/')}>‹</button><h1>Today's test</h1></div>
      <div className="card">
        <p style={{ marginTop: 0 }}>Up to {DAILY_SIZE} questions picked from the {learned.length} kana you've learned — the ones due for review and the ones you find hardest come first.</p>
        <div className="row wrap" style={{ marginBottom: 14 }}>
          <span className="chip">👀 Reading</span>
          <span className="chip">🧠 Recall</span>
          {canSpeak && <span className="chip">👂 Listening</span>}
          <span className="chip">✍️ Writing</span>
        </div>
        <button className="btn primary block" onClick={() => setQuestions(buildDailyTest(s.cards, learned, canSpeak))}>Start</button>
      </div>
    </div>
  );
}
