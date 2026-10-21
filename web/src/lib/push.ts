// Daily reminder notifications through the server's Web Push endpoint.

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function base64ToBytes(b64: string) {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return 'This browser does not support notifications. On iPhone, add the app to your home screen first.';
  if (!window.isSecureContext) return 'Notifications need the app opened over HTTPS.';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'Notifications were not allowed.';
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = (await (await fetch('/api/push/key')).json()) as { publicKey: string };
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToBytes(publicKey),
  }));
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  return res.ok ? null : 'Could not register with the server.';
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined);
  await sub.unsubscribe();
}

export async function testPush() {
  const res = await fetch('/api/push/test', { method: 'POST' });
  const { sent } = (await res.json()) as { sent: number };
  return sent;
}
