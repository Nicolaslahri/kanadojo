import { useEffect, useRef, useState } from 'react';
import { hasJapaneseVoice, onVoicesChanged, speak, speechSupported } from '../lib/speech';
import { needsHttps, recordingSupported, startRecording, type Recording } from '../lib/recorder';
import { useStore } from '../lib/store';

export function useSpeaker() {
  const { rate, voiceURI } = useStore((s) => s.settings);
  const [, force] = useState(0);
  useEffect(() => {
    const off = onVoicesChanged(() => force((n) => n + 1));
    return () => void off();
  }, []);
  return {
    canSpeak: speechSupported() && hasJapaneseVoice(),
    say: (text: string, slow = false) => speak(text, { rate: slow ? Math.max(0.4, rate * 0.6) : rate, voiceURI }),
  };
}

/** Listen to the native voice, record yourself, and compare the two. */
export function AudioPanel({ text, autoPlay = false, record = true }: { text: string; autoPlay?: boolean; record?: boolean }) {
  const { canSpeak, say } = useSpeaker();
  const [rec, setRec] = useState<Recording | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (autoPlay && canSpeak) {
      const t = setTimeout(() => say(text), 250);
      return () => clearTimeout(t);
    }
  }, [text, autoPlay, canSpeak]);

  useEffect(() => {
    setMine(null);
    setErr(null);
  }, [text]);

  useEffect(() => () => { if (mine) URL.revokeObjectURL(mine); }, [mine]);

  const toggleRecord = async () => {
    if (rec) {
      rec.stop();
      return;
    }
    setErr(null);
    try {
      const r = await startRecording();
      setRec(r);
      const url = await r.done;
      setRec(null);
      setMine(url);
      audioRef.current = new Audio(url);
      void audioRef.current.play();
    } catch {
      setRec(null);
      setErr('Microphone access was blocked. Allow it in your browser settings to record yourself.');
    }
  };

  const playMine = () => {
    if (!mine) return;
    audioRef.current = new Audio(mine);
    void audioRef.current.play();
  };

  const canRecord = record && recordingSupported() && !needsHttps();

  return (
    <div>
      <div className="audio-row">
        <button className="btn primary" onClick={() => say(text)} disabled={!canSpeak}>🔊 Listen</button>
        <button className="btn" onClick={() => say(text, true)} disabled={!canSpeak}>🐢 Slow</button>
        {canRecord && (
          <button className={`btn ${rec ? 'recording' : ''}`} onClick={toggleRecord}>{rec ? '■ Stop' : '🎙 Record'}</button>
        )}
        {canRecord && mine && <button className="btn" onClick={playMine}>▶ Mine</button>}
      </div>
      {!canSpeak && (
        <p className="banner warn small">
          No Japanese voice found on this device. On Android install "Japanese" in Google text-to-speech settings; on iPhone
          add a Japanese voice under Settings → Accessibility → Spoken Content → Voices.
        </p>
      )}
      {record && needsHttps() && <p className="muted small center">Recording yourself needs the app opened over HTTPS.</p>}
      {err && <p className="banner warn small">{err}</p>}
      {mine && canSpeak && <p className="muted small center">Tap Listen and ▶ Mine back to back to compare.</p>}
    </div>
  );
}
