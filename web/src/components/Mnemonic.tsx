import { KANA_BY_CHAR } from '../data/kana';

/** The character over its picture, with the hook word and story. */
export function Mnemonic({ char, showRomaji = true }: { char: string; showRomaji?: boolean }) {
  const k = KANA_BY_CHAR[char];
  return (
    <div>
      <div className="mnemonic">
        {k.emoji && <span className="pic" aria-hidden>{k.emoji}</span>}
        <span className="glyph kana">{k.char}</span>
        {showRomaji && <span className="romaji-tag">{k.romaji}</span>}
      </div>
      {k.hook && (
        <p className="hookline">
          {k.kind === 'basic' ? <>Looks like <b>{k.hook}</b> → <b>{k.romaji}</b></> : <><span className="kana">{k.hook}</span> → <b>{k.romaji}</b></>}
        </p>
      )}
      {k.story && <p className="story">{k.story}</p>}
    </div>
  );
}

export function Tip({ char }: { char: string }) {
  const tip = KANA_BY_CHAR[char]?.tip;
  if (!tip) return null;
  return (
    <div className="tip">
      <span aria-hidden>🗣️</span>
      <span>{tip}</span>
    </div>
  );
}
