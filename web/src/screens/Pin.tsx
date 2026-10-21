import { useState, type FormEvent } from 'react';
import { login } from '../lib/store';

export function Pin() {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(await login(pin));
    setBusy(false);
  };
  return (
    <form className="pin-screen" onSubmit={submit}>
      <div>
        <div className="kana" style={{ fontSize: '4rem' }}>🔒</div>
        <h1 style={{ fontSize: '1.4rem' }}>Enter your PIN</h1>
        <input type="password" inputMode="numeric" autoComplete="current-password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} aria-label="PIN" />
        {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
        <div><button className="btn primary" disabled={!pin || busy}>Unlock</button></div>
      </div>
    </form>
  );
}
