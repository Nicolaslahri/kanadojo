import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { openDb, type SyncIn } from './db.js';
import { Reminders } from './reminders.js';

export interface AppOptions {
  dataDir: string;
  staticDir?: string;
  pin?: string;
  vapidSubject?: string;
  logger?: boolean;
}

const COOKIE = 'kd_auth';
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 5 * 60_000;

export async function buildApp(opts: AppOptions) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 5 * 1024 * 1024, trustProxy: true });
  const db = openDb(opts.dataDir);
  app.addHook('onClose', async () => db.close());

  let secret = db.getMeta('secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    db.setMeta('secret', secret);
  }
  const token = opts.pin ? createHmac('sha256', secret).update(opts.pin).digest('hex') : '';

  const reminders = new Reminders(db, opts.vapidSubject ?? 'mailto:kana-dojo@example.com', app.log);
  app.addHook('onReady', async () => reminders.start());
  app.addHook('onClose', async () => reminders.stop());

  await app.register(fastifyCookie);

  const authed = (req: FastifyRequest) => {
    if (!opts.pin) return true;
    const got = req.cookies[COOKIE];
    return !!got && got.length === token.length && timingSafeEqual(Buffer.from(got), Buffer.from(token));
  };

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.url.startsWith('/api/login') || req.url.startsWith('/api/auth')) return;
    if (!authed(req)) return reply.code(401).send({ error: 'pin required' });
  });

  const failed = new Map<string, { count: number; until: number }>();

  app.get('/healthz', async () => ({ ok: true }));

  app.get('/api/auth', async (req) => ({ pinRequired: !!opts.pin, authed: authed(req) }));

  app.post<{ Body: { pin?: string } }>('/api/login', async (req, reply) => {
    if (!opts.pin) return { ok: true };
    const entry = failed.get(req.ip);
    if (entry && entry.until > Date.now()) {
      return reply.code(429).send({ error: 'Too many attempts. Try again in a few minutes.' });
    }
    const pin = String(req.body?.pin ?? '');
    const expected = Buffer.from(opts.pin);
    const ok = pin.length === opts.pin.length && timingSafeEqual(Buffer.from(pin), expected);
    if (!ok) {
      const count = (entry?.count ?? 0) + 1;
      failed.set(req.ip, { count, until: count >= MAX_FAILED_LOGINS ? Date.now() + LOCKOUT_MS : 0 });
      return reply.code(401).send({ error: 'Wrong PIN' });
    }
    failed.delete(req.ip);
    setAuthCookie(req, reply, token);
    return { ok: true };
  });

  app.get('/api/state', async () => db.state());

  app.post<{ Body: SyncIn }>('/api/sync', async (req) => {
    db.sync(req.body ?? {});
    return db.state();
  });

  app.post('/api/reset', async () => {
    db.reset();
    return db.state();
  });

  app.get('/api/push/key', async () => ({ publicKey: reminders.publicKey }));

  app.post<{ Body: { subscription?: { endpoint?: string } } }>('/api/push/subscribe', async (req, reply) => {
    const sub = req.body?.subscription;
    if (!sub?.endpoint) return reply.code(400).send({ error: 'subscription required' });
    db.addSubscription(sub.endpoint, JSON.stringify(sub));
    return { ok: true };
  });

  app.post<{ Body: { endpoint?: string } }>('/api/push/unsubscribe', async (req) => {
    if (req.body?.endpoint) db.removeSubscription(req.body.endpoint);
    return { ok: true };
  });

  app.post('/api/push/test', async () => ({ sent: await reminders.sendAll('Kana Dojo', 'Notifications are working! 🎉') }));

  if (opts.staticDir && existsSync(opts.staticDir)) {
    await app.register(fastifyStatic, {
      root: opts.staticDir,
      setHeaders(res, path) {
        if (/[\\/]assets[\\/]/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else res.setHeader('Cache-Control', 'no-cache');
      },
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'not found' });
    });
  }

  return app;
}

function setAuthCookie(req: FastifyRequest, reply: FastifyReply, value: string) {
  reply.setCookie(COOKIE, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: req.protocol === 'https',
    maxAge: 60 * 60 * 24 * 365,
  });
}
