import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';

const here = dirname(fileURLToPath(import.meta.url));

const app = await buildApp({
  dataDir: process.env.DATA_DIR ?? resolve(here, '../../data'),
  staticDir: process.env.STATIC_DIR ?? resolve(here, '../../dist/web'),
  pin: process.env.APP_PIN || undefined,
  vapidSubject: process.env.VAPID_SUBJECT || undefined,
  logger: true,
});

const port = Number(process.env.PORT ?? 8080);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void app.close().then(() => process.exit(0)));
}
