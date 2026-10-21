import { useEffect, useState } from 'react';
import { japaneseVoices, onVoicesChanged } from '../lib/speech';
import { resetProgress, sync, updateSettings, useStore } from '../lib/store';
import { disablePush, enablePush, pushSupported, testPush } from '../lib/push';
import { go } from '../lib/router';
import { useSpeaker } from '../components/Audio';

export function Settings() {
  const settings = useStore((s) => s.settings);
  const status = useStore((s) => s.syncStatus);
  const lastSync = useStore((s) => s.lastSync);
  const { say, canSpeak } = useSpeaker();
  const [voices, setVoices] = useState(japaneseVoices());
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState(0);

  useEffect(() => {
    const off = onVoicesChanged(() => setVoices(japaneseVoices()));
    return () => void off();
  }, []);

  const toggleReminder = async (on: boolean) => {
    setPushMsg(null);
    if (on) {
      const err = await enablePush();
      if (err) {
        setPushMsg(err);
        return;
      }
    } else {
      await disablePush();
    }
    updateSettings({ reminder: { ...settings.reminder, enabled: on, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
  };

  const doReset = async () => {
    if (resetStep < 1) return setResetStep(1);
    const ok = await resetProgress();
    setResetStep(0);
    if (ok) go('/');
    else alert("Couldn't reach the server, so nothing was reset. Try again when you're online.");
  };

  return (
    <div>
      <div className="topbar"><button className="icon-btn" onClick={() => go('/')} aria-label="Back">‹</button><h1>Settings</h1></div>

      <h3 className="section-title">Voice</h3>
      <div className="card">
        <div className="setting">
          <span className="label">Japanese voice<small>{voices.length ? `${voices.length} available on this device` : 'None found on this device'}</small></span>
          <select value={settings.voiceURI ?? ''} onChange={(e) => updateSettings({ voiceURI: e.target.value || null })}>
            <option value="">Automatic</option>
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
          </select>
        </div>
        <div className="setting">
          <span className="label">Speed<small>{settings.rate.toFixed(2)}×</small></span>
          <input type="range" min={0.5} max={1.2} step={0.05} value={settings.rate} onChange={(e) => updateSettings({ rate: Number(e.target.value) })} />
        </div>
        <div className="setting">
          <span className="label">Test it</span>
          <button className="btn sm" disabled={!canSpeak} onClick={() => say('ひらがな と カタカナ')}>🔊 ひらがな</button>
        </div>
      </div>

      <h3 className="section-title">Learning</h3>
      <div className="card">
        <Toggle label="Show romaji in the chart" value={settings.romaji} onChange={(v) => updateSettings({ romaji: v })} />
        <Toggle label="Unlock all lessons" hint="Skip ahead if you already know some kana" value={settings.unlockAll} onChange={(v) => updateSettings({ unlockAll: v })} />
        <Toggle label="Vibration" hint="Small buzz on right and wrong answers" value={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
        <div className="setting">
          <span className="label">Theme</span>
          <select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as typeof settings.theme })}>
            <option value="auto">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <h3 className="section-title">Daily reminder</h3>
      <div className="card">
        <Toggle
          label="Remind me to take the test"
          hint={pushSupported() ? 'Sent by your server if the test isn\'t done by this time' : 'Not supported in this browser'}
          value={settings.reminder.enabled}
          onChange={toggleReminder}
        />
        {settings.reminder.enabled && (
          <>
            <div className="setting">
              <span className="label">Time</span>
              <input type="time" value={settings.reminder.time} onChange={(e) => updateSettings({ reminder: { ...settings.reminder, time: e.target.value } })} />
            </div>
            <div className="setting">
              <span className="label">Send a test notification</span>
              <button className="btn sm" onClick={async () => setPushMsg((await testPush()) ? 'Sent! Check your notifications.' : 'No device is subscribed yet.')}>Send</button>
            </div>
          </>
        )}
        {pushMsg && <p className="banner small" style={{ marginTop: 10, marginBottom: 0 }}>{pushMsg}</p>}
      </div>

      <h3 className="section-title">Sync</h3>
      <div className="card">
        <div className="setting">
          <span className="label">
            <span className={`sync-dot ${status}`} /> {status === 'synced' ? 'Synced with your server' : status === 'syncing' ? 'Syncing…' : status === 'auth' ? 'PIN needed' : status === 'offline' ? 'Offline — saved on this device' : 'Not synced yet'}
            <small>{lastSync ? `Last sync ${new Date(lastSync).toLocaleString()}` : 'Progress is saved on this device and on your server.'}</small>
          </span>
          <button className="btn sm" onClick={() => void sync()}>Sync now</button>
        </div>
        <div className="setting">
          <span className="label">Reset all progress<small>Clears lessons, reviews and tests on every device</small></span>
          <button className="btn sm" style={resetStep ? { background: 'var(--bad)', color: '#fff' } : undefined} onClick={doReset}>
            {resetStep ? 'Tap again to confirm' : 'Reset'}
          </button>
        </div>
      </div>

      <p className="muted small center" style={{ marginTop: 20 }}>
        Stroke order data from <a href="https://kanjivg.tagaini.net" target="_blank" rel="noreferrer">KanjiVG</a> by Ulrich Apel, CC BY-SA 3.0.
      </p>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting">
      <span className="label">{label}{hint && <small>{hint}</small>}</span>
      <input type="checkbox" className="switch" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
