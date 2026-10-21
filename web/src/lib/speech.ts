// Japanese text-to-speech through the browser's built-in voices.

const PREFERRED = ['Kyoko', 'Otoya', 'O-ren', 'Hattori', 'Google 日本語', 'Nanami', 'Haruka', 'Ayumi', 'Ichiro', 'Sayaka'];

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function refresh() {
  if (!supported) return;
  voices = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
  listeners.forEach((l) => l());
}

if (supported) {
  refresh();
  speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

export const speechSupported = () => supported;

export function japaneseVoices() {
  return voices;
}

export function onVoicesChanged(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function rank(v: SpeechSynthesisVoice) {
  const i = PREFERRED.findIndex((p) => v.name.includes(p));
  return (i === -1 ? PREFERRED.length : i) - (v.localService ? 0.5 : 0);
}

export function pickVoice(voiceURI: string | null): SpeechSynthesisVoice | undefined {
  if (voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === voiceURI);
    if (chosen) return chosen;
  }
  return [...voices].sort((a, b) => rank(a) - rank(b))[0];
}

export function hasJapaneseVoice() {
  return voices.length > 0;
}

// Some engines read lone kana by their name or mumble them, so a few need a nudge.
const SPOKEN: Record<string, string> = { を: 'お', ヲ: 'オ', ぢ: 'じ', ヂ: 'ジ', づ: 'ず', ヅ: 'ズ' };

export function speak(text: string, opts: { rate?: number; voiceURI?: string | null } = {}) {
  if (!supported) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(SPOKEN[text] ?? text);
  u.lang = 'ja-JP';
  const voice = pickVoice(opts.voiceURI ?? null);
  if (voice) u.voice = voice;
  u.rate = opts.rate ?? 0.8;
  speechSynthesis.speak(u);
}
