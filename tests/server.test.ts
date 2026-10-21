import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../server/src/app';

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'kana-dojo-'));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const card = (updated: number, box: number) => ({ char: 'あ', skill: 'read', box, due: 0, correct: box, wrong: 0, updated });

describe('sync API', () => {
  it('round-trips progress and keeps the newest card', async () => {
    const dataDir = tempDir();
    const app = await buildApp({ dataDir });
    const body = {
      reviews: [{ id: 'r1', char: 'あ', skill: 'read', correct: true, mode: 'test', at: 1, day: '2026-01-01' },
        { id: 'r2', char: 'あ', skill: 'read', correct: false, mode: 'test', at: 2, day: '2026-01-01' }],
      cards: [card(100, 2)],
      learned: { あ: 50 },
      tests: { '2026-01-01': { score: 18, total: 20, at: 3 } },
      settings: { value: { rate: 0.8 }, updated: 10 },
    };
    let res = await app.inject({ method: 'POST', url: '/api/sync', payload: body });
    expect(res.statusCode).toBe(200);
    // Same reviews again must not double count; an older card must not win.
    res = await app.inject({ method: 'POST', url: '/api/sync', payload: { ...body, cards: [card(90, 0)], settings: { value: { rate: 1 }, updated: 5 } } });
    const state = res.json();
    expect(state.cards).toEqual([card(100, 2)]);
    expect(state.activity['2026-01-01']).toEqual({ n: 2, correct: 1 });
    expect(state.skillStats.read).toEqual({ n: 2, correct: 1 });
    expect(state.learned).toEqual({ あ: 50 });
    expect(state.tests['2026-01-01'].score).toBe(18);
    expect(state.settings.value).toEqual({ rate: 0.8 });
    await app.close();

    // Data survives a restart.
    const again = await buildApp({ dataDir });
    expect((await again.inject({ url: '/api/state' })).json().cards).toHaveLength(1);
    await again.inject({ method: 'POST', url: '/api/reset' });
    expect((await again.inject({ url: '/api/state' })).json().cards).toHaveLength(0);
    await again.close();
  });

  it('requires the PIN when one is set', async () => {
    const app = await buildApp({ dataDir: tempDir(), pin: '2468' });
    expect((await app.inject({ url: '/api/state' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/auth' })).json()).toEqual({ pinRequired: true, authed: false });
    expect((await app.inject({ method: 'POST', url: '/api/login', payload: { pin: '1111' } })).statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/login', payload: { pin: '2468' } });
    expect(ok.statusCode).toBe(200);
    const cookie = ok.cookies.find((c) => c.name === 'kd_auth')!;
    const res = await app.inject({ url: '/api/state', cookies: { kd_auth: cookie.value } });
    expect(res.statusCode).toBe(200);
    expect((await app.inject({ url: '/healthz' })).statusCode).toBe(200);
    await app.close();
  });

  it('locks out after repeated wrong PINs', async () => {
    const app = await buildApp({ dataDir: tempDir(), pin: '2468' });
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/api/login', payload: { pin: '0000' } });
    expect((await app.inject({ method: 'POST', url: '/api/login', payload: { pin: '2468' } })).statusCode).toBe(429);
    await app.close();
  });
});
