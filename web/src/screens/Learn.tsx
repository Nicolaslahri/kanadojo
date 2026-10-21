import { useState } from 'react';
import { LESSONS, type Kind, type Script } from '../data/kana';
import { cardKey, mastery } from '../lib/srs';
import { canWrite } from '../lib/strokes';
import { updateSettings, useStore } from '../lib/store';
import { lessonDone, lessonOpen, nextLesson } from './progress';

const KIND_TITLE: Record<Kind, string> = { basic: 'Basics', dakuten: 'Dakuten ゛ & handakuten ゜', yoon: 'Combinations (yōon)' };

export function Learn() {
  const s = useStore((st) => st);
  const [script, setScript] = useState<Script>(() => (nextLesson('hiragana', s.learned) ? 'hiragana' : 'katakana'));
  const next = nextLesson(script, s.learned);
  return (
    <div>
      <div className="topbar"><h1>Learn</h1></div>
      <div className="segmented">
        <button className={script === 'hiragana' ? 'on' : ''} onClick={() => setScript('hiragana')}>ひらがな Hiragana</button>
        <button className={script === 'katakana' ? 'on' : ''} onClick={() => setScript('katakana')}>カタカナ Katakana</button>
      </div>
      <p className="muted small" style={{ margin: '0 4px 8px' }}>
        {script === 'hiragana'
          ? 'Hiragana is used for native Japanese words and grammar. Start here.'
          : 'Katakana is used for foreign words like カメラ (camera) and names. Every one sounds like a hiragana you already know.'}
      </p>
      <label className="card setting" style={{ marginBottom: 8 }}>
        <span className="label">⚡ Fast track<small>{s.settings.fastTrack
          ? 'Learn to read first. Writing is a separate pass: tap ✍️ on a finished lesson.'
          : 'Each lesson teaches reading and writing together.'}</small></span>
        <input type="checkbox" className="switch" checked={s.settings.fastTrack} onChange={(e) => updateSettings({ fastTrack: e.target.checked })} />
      </label>
      {(['basic', 'dakuten', 'yoon'] as const).map((kind) => (
        <section key={kind}>
          <h3 className="section-title">{KIND_TITLE[kind]}</h3>
          {LESSONS.filter((l) => l.script === script && l.kind === kind).map((l) => {
            const done = lessonDone(l, s.learned);
            const open = lessonOpen(l, s);
            const m = l.chars.reduce((sum, c) => sum + mastery(c, s.cards), 0) / l.chars.length / 5;
            const cls = `lesson-item ${open ? '' : 'locked'} ${next?.id === l.id ? 'next' : ''}`;
            const writable = l.chars.filter(canWrite);
            const written = writable.length > 0 && writable.every((c) => (s.cards[cardKey(c, 'write')]?.correct ?? 0) > 0);
            const writePass = done && writable.length > 0 && s.settings.fastTrack && (
              <a className={`btn sm write-pass ${written ? 'good' : ''}`} href={`#/lesson/${l.id}/write`}
                onClick={(e) => e.stopPropagation()} aria-label={`Writing pass for ${l.title}`}>
                ✍️ {written ? 'Written' : 'Write'}
              </a>
            );
            const body = (
              <>
                <div style={{ minWidth: 0 }}>
                  <div className="chars">{l.chars.slice(0, 6).join(' ')}{l.chars.length > 6 ? ' …' : ''}</div>
                  <div className="title">{l.title}</div>
                  {done && <div className="progress good" style={{ marginTop: 6, width: 120 }}><div style={{ width: `${m * 100}%` }} /></div>}
                </div>
                <span className="spacer" />
                {writePass}
                <span className="status">{done ? '✅' : open ? '▶️' : '🔒'}</span>
              </>
            );
            return open && !writePass
              ? <a key={l.id} className={cls} href={`#/lesson/${l.id}`}>{body}</a>
              : <div key={l.id} className={cls} aria-disabled={!open} onClick={open ? () => { location.hash = `/lesson/${l.id}`; } : undefined}>{body}</div>;
          })}
        </section>
      ))}
      <p className="muted small center">Already know some? Turn on "Unlock all lessons" in ⚙️ Settings.</p>
    </div>
  );
}
