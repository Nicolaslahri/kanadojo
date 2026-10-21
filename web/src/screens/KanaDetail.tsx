import { useState } from 'react';
import { KANA_BY_CHAR } from '../data/kana';
import { WORDS, wordChars } from '../data/words';
import { cardKey, SKILL_LABEL, skillsFor } from '../lib/srs';
import { useStore } from '../lib/store';
import { back } from '../lib/router';
import { canWrite } from '../lib/strokes';
import { Mnemonic, Tip } from '../components/Mnemonic';
import { AudioPanel, useSpeaker } from '../components/Audio';
import { StrokeAnimator } from '../components/StrokeAnimator';
import { FreePad, TracePad } from '../components/DrawPad';

export function KanaDetail({ char }: { char: string }) {
  const k = KANA_BY_CHAR[char];
  const cards = useStore((s) => s.cards);
  const { canSpeak, say } = useSpeaker();
  const [pad, setPad] = useState<'watch' | 'trace' | 'free'>('watch');
  const [round, setRound] = useState(0);
  if (!k) return <p>Unknown character. <a href="#/chart">Back to chart</a></p>;
  const words = WORDS.filter((w) => wordChars(w).includes(char)).slice(0, 5);
  const writable = canWrite(char);

  return (
    <div>
      <div className="topbar">
        <button className="icon-btn" onClick={() => back('/chart')} aria-label="Back">‹</button>
        <h1><span className="kana">{k.char}</span> · {k.romaji}</h1>
        <span className="chip">{k.script}</span>
      </div>
      <Mnemonic char={char} />
      <AudioPanel text={char} />
      <Tip char={char} />

      {writable && (
        <div className="card">
          <h2>Writing</h2>
          <div className="segmented">
            <button className={pad === 'watch' ? 'on' : ''} onClick={() => setPad('watch')}>Watch</button>
            <button className={pad === 'trace' ? 'on' : ''} onClick={() => setPad('trace')}>Trace</button>
            <button className={pad === 'free' ? 'on' : ''} onClick={() => setPad('free')}>Draw</button>
          </div>
          {pad === 'watch' && <StrokeAnimator char={char} />}
          {pad === 'trace' && <TracePad key={round} char={char} onDone={() => setTimeout(() => setRound((r) => r + 1), 900)} />}
          {pad === 'free' && <FreePad char={char} />}
        </div>
      )}

      <div className="card">
        <h2>Your progress</h2>
        <div className="skill-boxes">
          {skillsFor(k).map((s) => {
            const c = cards[cardKey(char, s)];
            return (
              <div className="skill-box" key={s}>
                <b>{c ? `${c.box}/5` : '–'}</b>
                {SKILL_LABEL[s]}
              </div>
            );
          })}
        </div>
      </div>

      {words.length > 0 && (
        <div className="card">
          <h2>Words with <span className="kana">{k.char}</span></h2>
          {words.map((w) => (
            <button key={w.kana} className="word-chip" onClick={() => canSpeak && say(w.kana)}>
              <span style={{ fontSize: '1.4rem' }}>{w.emoji}</span>
              <span className="kana">{w.kana}</span>
              <span className="muted small">{w.romaji} · {w.meaning}</span>
              <span className="spacer" />
              {canSpeak && <span>🔊</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
