import { KANA_BY_CHAR } from '../data/kana';
import { dayKey } from '../lib/srs';
import { useStore } from '../lib/store';
import { Ring } from '../components/Ring';
import { currentStreak, dueCount, nextLesson, scriptProgress } from './progress';

export function Home() {
  const s = useStore((st) => st);
  const today = s.tests[dayKey()];
  const learnedCount = Object.keys(s.learned).length;
  const streak = currentStreak(s);
  const due = dueCount(s.cards, s.learned);
  const hira = scriptProgress('hiragana', s);
  const kata = scriptProgress('katakana', s);
  const next = nextLesson('hiragana', s.learned) ?? nextLesson('katakana', s.learned);
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'おはよう' : hour < 18 ? 'こんにちは' : 'こんばんは';

  return (
    <div>
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="sub kana" style={{ fontSize: '1rem' }}>{greet}!</div>
          <h1>Kana Dojo</h1>
        </div>
        <span className="streak" title="Day streak">🔥 {streak}</span>
        <a className="icon-btn" href="#/settings" aria-label="Settings">⚙️</a>
      </div>

      {learnedCount === 0 ? (
        <div className="hero-test">
          <h2>Welcome! 👋</h2>
          <p>Start with the five vowels: あ い う え お. Each one comes with a picture to remember it by.</p>
          <a className="btn" href="#/lesson/h-a">Start lesson 1</a>
        </div>
      ) : today ? (
        <div className="hero-test done">
          <h2>Daily test done ✓</h2>
          <p>You scored {today.score}/{today.total} today. Come back tomorrow to keep your 🔥 {streak}-day streak.</p>
          <a className="btn" href="#/test">See results</a>
        </div>
      ) : (
        <div className="hero-test">
          <h2>Today's test</h2>
          <p>20 quick questions mixing reading, listening, recall and writing.</p>
          <a className="btn" href="#/test">Start test</a>
        </div>
      )}

      {next && (
        <a className="card next-lesson" href={`#/lesson/${next.id}`}>
          <span className="kana-preview">{next.chars[0]}</span>
          <div>
            <div className="muted small">Next lesson · {next.script}</div>
            <b>{next.title}</b>
            <div className="kana" style={{ fontSize: '1.1rem', marginTop: 4, letterSpacing: '0.1em' }}>{next.chars.slice(0, 6).join(' ')}</div>
          </div>
          <span className="spacer" />
          <span style={{ fontSize: '1.4rem' }}>›</span>
        </a>
      )}

      <div className="tiles">
        <a className="tile" href={due ? '#/practice/review' : '#/practice'}>
          <div className="big">{due}</div>
          <div className="muted small">{due === 1 ? 'review' : 'reviews'} due</div>
        </a>
        <a className="tile" href="#/stats">
          <div className="big">{learnedCount}</div>
          <div className="muted small">kana learned</div>
        </a>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 18 }}>
          {[['Hiragana', 'あ', hira], ['Katakana', 'ア', kata]].map(([name, ch, p]) => {
            const prog = p as typeof hira;
            return (
              <a key={name as string} href="#/chart" className="row" style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
                <Ring value={prog.learned / prog.total} size={58}><span className="kana" style={{ fontSize: '1.4rem' }}>{ch as string}</span></Ring>
                <div>
                  <b>{name as string}</b>
                  <div className="muted small">{prog.learned}/{prog.total} · {prog.mastered} mastered</div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <div className="tiles">
        <a className="tile" href="#/practice/lookalike"><div className="emoji">👯</div><b>Look-alikes</b><div className="muted small">シ vs ツ, ぬ vs め…</div></a>
        <a className="tile" href="#/practice/words"><div className="emoji">📖</div><b>Read words</b><div className="muted small">ねこ, すし, カメラ…</div></a>
        <a className="tile" href="#/practice/speed"><div className="emoji">⚡</div><b>Speed round</b><div className="muted small">60 seconds</div></a>
        <a className="tile" href={`#/kana/${encodeURIComponent(next?.chars[0] ?? 'あ')}`}><div className="emoji">✍️</div><b>Writing pad</b><div className="muted small">Practise <span className="kana">{KANA_BY_CHAR[next?.chars[0] ?? 'あ'].char}</span></div></a>
      </div>
    </div>
  );
}
