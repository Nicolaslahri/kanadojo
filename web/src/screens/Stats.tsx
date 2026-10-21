import { KANA, KANA_BY_CHAR } from '../data/kana';
import { dayKey, SKILLS, SKILL_LABEL, weakness } from '../lib/srs';
import { useStore } from '../lib/store';
import { Ring } from '../components/Ring';
import { bestStreak, currentStreak, scriptProgress } from './progress';

export function Stats() {
  const s = useStore((st) => st);
  const hira = scriptProgress('hiragana', s);
  const kata = scriptProgress('katakana', s);
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29 + i)));
  const tests = Array.from({ length: 14 }, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13 + i)));
  const level = (n: number) => (n === 0 ? '' : n < 10 ? 'l1' : n < 25 ? 'l2' : n < 50 ? 'l3' : 'l4');
  const totalReviews = Object.values(s.activity).reduce((a, b) => a + b.n, 0);

  const weakest = Object.values(s.cards)
    .filter((c) => c.char in s.learned && c.correct + c.wrong > 0)
    .sort((a, b) => weakness(b) - weakness(a));
  const weakChars = [...new Set(weakest.map((c) => c.char))].slice(0, 10);

  return (
    <div>
      <div className="topbar"><h1>Stats</h1></div>

      <div className="tiles">
        <div className="tile"><div className="big">🔥 {currentStreak(s)}</div><div className="muted small">day streak · best {bestStreak(s)}</div></div>
        <div className="tile"><div className="big">{totalReviews}</div><div className="muted small">answers so far</div></div>
      </div>

      <div className="card">
        <h2>Progress</h2>
        {[['ひらがな Hiragana', hira], ['カタカナ Katakana', kata]].map(([name, p]) => {
          const prog = p as typeof hira;
          return (
            <div key={name as string} className="row" style={{ marginBottom: 12 }}>
              <Ring value={prog.mastered / prog.total} size={52} color="var(--good)"><span className="small">{Math.round((prog.mastered / prog.total) * 100)}%</span></Ring>
              <div style={{ flex: 1 }}>
                <b>{name as string}</b>
                <div className="muted small">{prog.learned} learned · {prog.mastered} mastered · {prog.total} total</div>
                <div className="progress" style={{ marginTop: 6 }}><div style={{ width: `${(prog.learned / prog.total) * 100}%` }} /></div>
              </div>
            </div>
          );
        })}
        <p className="muted small" style={{ marginBottom: 0 }}>"Mastered" means every skill for that kana has reached box 4 of 5 in the review schedule.</p>
      </div>

      <div className="card">
        <h2>Last 30 days</h2>
        <div className="heatmap">
          {days.map((d) => <div key={d} title={`${d}: ${s.activity[d]?.n ?? 0} answers`} className={`${level(s.activity[d]?.n ?? 0)} ${d === dayKey() ? 'today' : ''}`} />)}
        </div>
      </div>

      <div className="card">
        <h2>Daily tests · last 2 weeks</h2>
        <div className="bars">
          {tests.map((d) => {
            const t = s.tests[d];
            return <div key={d} className={t ? '' : 'empty'} title={t ? `${d}: ${t.score}/${t.total}` : d} style={{ height: t ? `${Math.max(6, (t.score / t.total) * 100)}%` : '3px' }} />;
          })}
        </div>
      </div>

      <div className="card">
        <h2>Accuracy by skill</h2>
        {SKILLS.map((sk) => {
          const st = s.skillStats[sk];
          const pct = st?.n ? st.correct / st.n : 0;
          return (
            <div className="stat-line" key={sk}>
              <span className="label">{SKILL_LABEL[sk]}</span>
              <div className="progress good"><div style={{ width: `${pct * 100}%` }} /></div>
              <span className="val">{st?.n ? `${Math.round(pct * 100)}%` : '–'}</span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Needs work</h2>
        {weakChars.length ? (
          <div className="weak-list">
            {weakChars.map((c) => <a key={c} href={`#/kana/${encodeURIComponent(c)}`}>{KANA_BY_CHAR[c]?.char}</a>)}
          </div>
        ) : (
          <p className="muted small">Take a few tests and your trickiest kana will show up here.</p>
        )}
      </div>
      <p className="muted small center">{KANA.length} kana in total across both scripts.</p>
    </div>
  );
}
