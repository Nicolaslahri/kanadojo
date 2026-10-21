// Japanese pronunciation: recorded clips when the app ships them, otherwise the browser's built-in voices.

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

// Recorded clips live in public/audio as <code points>.mp3 (あ → 3042.mp3, きゃ → 304d-3083.mp3),
// listed in audio/clips.json. They work on devices without a Japanese voice.
const AUDIO_BASE = `${import.meta.env.BASE_URL ?? '/'}audio/`;
let clips = new Set<string>();

export const clipName = (text: string) => [...text].map((c) => c.codePointAt(0)!.toString(16)).join('-');

if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(`${AUDIO_BASE}clips.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((list: string[]) => {
      clips = new Set(list);
      listeners.forEach((l) => l());
    })
    .catch(() => undefined);
}

const hasClip = (text: string) => clips.has(clipName(text));

export const speechSupported = () => supported || clips.size > 0;

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
  return voices.length > 0 || clips.size > 0;
}

let clipPlayer: HTMLAudioElement | null = null;

// Some engines read lone kana by their name or mumble them, so a few need a nudge.
const SPOKEN: Record<string, string> = { を: 'お', ヲ: 'オ', ぢ: 'じ', ヂ: 'ジ', づ: 'ず', ヅ: 'ズ' };

export function speak(text: string, opts: { rate?: number; voiceURI?: string | null } = {}) {
  clipPlayer?.pause();
  if (hasClip(text)) {
    if (supported) speechSynthesis.cancel();
    clipPlayer = new Audio(`${AUDIO_BASE}${clipName(text)}.mp3`);
    // Clips are recorded at natural speed; the app's default rate of 0.8 maps to normal playback.
    clipPlayer.playbackRate = Math.min(1.5, Math.max(0.5, (opts.rate ?? 0.8) / 0.8));
    void clipPlayer.play().catch(() => undefined);
    return;
  }
  if (!supported) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(SPOKEN[text] ?? text);
  u.lang = 'ja-JP';
  const voice = pickVoice(opts.voiceURI ?? null);
  if (voice) u.voice = voice;
  u.rate = opts.rate ?? 0.8;
  speechSynthesis.speak(u);
}
