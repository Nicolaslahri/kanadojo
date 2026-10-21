import webpush from 'web-push';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from './db.js';

interface ReminderSettings {
  reminder?: { enabled?: boolean; time?: string; tz?: string };
}

/** Sends a daily push reminder when today's test hasn't been taken by the chosen time. */
export class Reminders {
  readonly publicKey: string;
  private timer?: NodeJS.Timeout;

  constructor(private db: Db, subject: string, private log: FastifyBaseLogger) {
    let keys = db.getMeta('vapid');
    if (!keys) {
      keys = JSON.stringify(webpush.generateVAPIDKeys());
      db.setMeta('vapid', keys);
    }
    const { publicKey, privateKey } = JSON.parse(keys) as { publicKey: string; privateKey: string };
    this.publicKey = publicKey;
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  start() {
    this.timer = setInterval(() => void this.tick(), 60_000);
  }

  stop() {
    clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    const settings = this.db.settingsValue() as ReminderSettings | null;
    const r = settings?.reminder;
    if (!r?.enabled || !r.time) return;
    const { day, time } = localParts(now, r.tz);
    if (time < r.time) return;
    if (this.db.getMeta('last_reminder') === day || this.db.hasTest(day)) return;
    this.db.setMeta('last_reminder', day);
    await this.sendAll('Time for your daily kana test ✍️', 'Keep your streak going — it only takes a few minutes.');
  }

  async sendAll(title: string, body: string) {
    let sent = 0;
    for (const { endpoint, json } of this.db.subscriptions()) {
      try {
        await webpush.sendNotification(JSON.parse(json), JSON.stringify({ title, body, url: '/#/test' }));
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) this.db.removeSubscription(endpoint);
        else this.log.warn({ err }, 'push failed');
      }
    }
    return sent;
  }
}

function localParts(now: Date, tz?: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
