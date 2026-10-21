import { useState } from 'react';
import { chartRows, GOJUON_COLUMNS, type Kind, type Script } from '../data/kana';
import { mastery } from '../lib/srs';
import { useStore } from '../lib/store';

const SECTIONS: { kind: Kind; title: string }[] = [
  { kind: 'basic', title: 'Basic' },
  { kind: 'dakuten', title: 'Dakuten ゛ & handakuten ゜' },
  { kind: 'yoon', title: 'Combinations' },
];

export function Chart() {
  const [script, setScript] = useState<Script>('hiragana');
  const { cards, learned, settings } = useStore((s) => s);
  return (
    <div>
      <div className="topbar"><h1>Chart</h1></div>
      <div className="segmented">
        <button className={script === 'hiragana' ? 'on' : ''} onClick={() => setScript('hiragana')}>ひらがな</button>
        <button className={script === 'katakana' ? 'on' : ''} onClick={() => setScript('katakana')}>カタカナ</button>
      </div>
      <div className="legend">
        <span>Tap any kana for its picture, sound and strokes.</span>
      </div>
      {SECTIONS.map(({ kind, title }) => (
        <section key={kind}>
          <h3 className="section-title">{title}</h3>
          {kind === 'basic' && (
            <div className="chart-grid" style={{ marginBottom: 6 }}>
              {GOJUON_COLUMNS.map((c) => <div key={c} className="center muted small" style={{ fontWeight: 700 }}>{c}</div>)}
            </div>
          )}
          <div className={`chart-grid ${kind === 'yoon' ? 'yoon' : ''}`}>
            {chartRows(script, kind).flat().map((k, i) => {
              if (!k) return <div key={`e${i}`} className="cell empty" />;
              const m = mastery(k.char, cards);
              const seen = k.char in learned;
              return (
                <a key={k.char} href={`#/kana/${encodeURIComponent(k.char)}`} className={`cell ${seen ? '' : 'unseen'} ${m >= 4 ? 'm5' : ''}`}>
                  <span className="kana">{k.char}</span>
                  {settings.romaji && <span className="r">{k.romaji}</span>}
                  {seen && <span className="bar"><div style={{ width: `${(m / 5) * 100}%` }} /></span>}
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
