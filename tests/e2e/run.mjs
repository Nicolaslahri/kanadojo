// End-to-end check on a phone-sized viewport: first lesson, daily test, server sync, screenshots.
// Usage: npm run build && node tests/e2e/run.mjs   (CHROMIUM_PATH can point at a Chromium binary)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = process.env.SHOTS_DIR || join(root, 'tests', 'e2e', 'screenshots');
mkdirSync(shots, { recursive: true });
const STROKES = JSON.parse(readFileSync(join(root, 'web', 'src', 'data', 'strokes.json'), 'utf8'));
const ROMAJI = { あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o' };
const CHAR_OF = Object.fromEntries(Object.entries(ROMAJI).map(([k, v]) => [v, k]));

const dataDir = mkdtempSync(join(tmpdir(), 'kana-e2e-'));
const port = 18000 + Math.floor(Math.random() * 1000);
const server = spawn('node', ['server/dist/index.js'], { cwd: root, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: 'ignore' });
const base = `http://localhost:${port}`;
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: join(shots, `${name}.png`) });
const assert = (cond, msg) => { if (!cond) throw new Error(`Assertion failed: ${msg}`); };

/** Draws reference strokes on the visible drawing pad. */
async function draw(char, { offset = 0 } = {}) {
  const box = await page.locator('svg.pad').last().boundingBox();
  for (const s of STROKES[char]) {
    const pts = s.pts.map(([x, y]) => [box.x + ((x + offset) / 109) * box.width, box.y + ((y + offset) / 109) * box.height]);
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y);
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
}

/** Answers whatever quiz question is on screen, correctly unless `wrong` is set. */
async function answerQuestion({ wrong = false } = {}) {
  const label = await page.locator('.prompt .label').first().textContent();
  const other = (r) => Object.values(ROMAJI).find((x) => x !== r);
  if (label.startsWith('Type how you read')) {
    const glyph = (await page.locator('.prompt .glyph').textContent()).trim();
    await page.locator('.typed-answer input').fill(wrong ? other(ROMAJI[glyph]) : ROMAJI[glyph]);
    await page.locator('.typed-answer input').press('Enter');
    await page.waitForTimeout(900);
    return;
  }
  if (label.startsWith('Read this word')) {
    // Lesson 1 words use only the vowels.
    const word = (await page.locator('.word-prompt').textContent()).trim();
    await page.locator('.option', { hasText: new RegExp(`^${[...word].map((c) => ROMAJI[c]).join('')}$`) }).click();
    await page.waitForTimeout(900);
    return;
  }
  if (label.startsWith('Write')) {
    const romaji = (await page.locator('.romaji-prompt').textContent()).trim();
    await draw(CHAR_OF[romaji]);
    await page.getByRole('button', { name: '✓ Check' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    return;
  }
  if (label.startsWith('How do you read')) {
    const glyph = (await page.locator('.prompt .glyph').textContent()).trim();
    const opts = page.locator('.option', { hasText: new RegExp(`^${ROMAJI[glyph]}$`) });
    await (wrong ? page.locator('.option').filter({ hasNot: opts }).filter({ hasNotText: new RegExp(`^${ROMAJI[glyph]}$`) }).first() : opts).click();
  } else {
    const romaji = (await page.locator('.romaji-prompt').textContent()).trim();
    await (wrong ? page.locator('.option').filter({ hasNotText: CHAR_OF[romaji] }).first() : page.locator('.option', { hasText: CHAR_OF[romaji] })).click();
  }
  await page.waitForTimeout(900);
}

try {
  await page.goto(base);
  await page.waitForSelector('text=Kana Dojo');
  await shot('01-home-new');

  // Lesson 1: the vowels, on the default fast track (reading only).
  await page.getByRole('link', { name: 'Start lesson 1' }).click();
  for (const char of Object.keys(ROMAJI)) {
    await page.waitForSelector('.mnemonic');
    if (char === 'あ') await shot('02-lesson-meet');
    await page.getByRole('button', { name: char === 'お' ? 'Start quiz' : 'Next', exact: true }).click();
  }
  await page.waitForSelector('.options');
  await shot('06-lesson-quiz');
  while (await page.locator('.prompt').count()) await answerQuestion();
  await page.waitForSelector('text=Vowels complete!');
  await shot('07-lesson-done');

  // Writing pass for the same lesson.
  await page.goto(`${base}/#/learn`);
  await page.getByRole('link', { name: 'Writing pass for Vowels' }).click();
  for (const char of Object.keys(ROMAJI)) {
    await page.waitForSelector('text=Watch the strokes');
    if (char === 'あ') { await page.waitForTimeout(2600); await shot('03-lesson-watch'); }
    await page.getByRole('button', { name: 'Got it — let me trace' }).click();
    await draw(char);
    if (char === 'あ') await shot('04-lesson-trace');
    await page.waitForSelector('text=Draw from memory');
    await draw(char, { offset: 3 });
    await page.getByRole('button', { name: '✓ Check' }).click();
    await page.waitForSelector('.score-badge');
    if (char === 'あ') await shot('05-lesson-draw-result');
    assert(!(await page.locator('.score-badge.bad').count()), `drawing ${char} should pass`);
    await page.getByRole('button', { name: char === 'お' ? 'Finish' : 'Next kana' }).click();
  }
  await page.waitForSelector('text=Writing pass done');

  // Daily test.
  await page.goto(`${base}/#/test`);
  await page.getByRole('button', { name: 'Start' }).click();
  let n = 0;
  while (await page.locator('.prompt').count()) {
    if (n === 1) await shot('08-test-question');
    await answerQuestion();
    n++;
  }
  await page.waitForSelector('text=Daily test complete');
  await shot('09-test-done');
  const score = await page.locator('.result-ring .num').textContent();
  assert(score.split('/')[0] === score.split('/')[1], `daily test should be perfect, got ${score}`);

  // Wipe the browser copy and reload: progress must come back from the server.
  await page.waitForTimeout(2500);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  await page.waitForSelector('text=Daily test done');
  assert(await page.locator('text=5').first().count(), 'learned count restored');
  await shot('10-home-after-sync');

  for (const [name, path] of [['11-chart', '#/chart'], ['12-kana-detail', '#/kana/%E3%81%8D'], ['13-stats', '#/stats'], ['14-practice', '#/practice'], ['15-settings', '#/settings'], ['16-learn', '#/learn']]) {
    await page.goto(`${base}/${path}`);
    await page.waitForTimeout(500);
    await shot(name);
  }

  // A deliberate miss comes back in the same session and shows up as a personal mix-up.
  await page.goto(`${base}/#/practice/quiz`);
  await page.waitForSelector('.prompt');
  await answerQuestion({ wrong: true });
  await page.waitForSelector('text=again in a moment');
  await shot('20-retry-feedback');
  await page.getByRole('button', { name: 'Continue' }).click();
  while (await page.locator('.prompt').count()) {
    if (await page.locator('.retry-tag').count()) await shot('21-retry-question');
    await answerQuestion();
  }
  await page.waitForSelector('text=fixed on the second try');
  await shot('22-practice-results');
  await page.waitForTimeout(2000);
  await page.goto(`${base}/#/practice/mixups`);
  await page.waitForSelector('.prompt');
  await shot('23-mixups');

  await page.goto(`${base}/#/kana/%E3%82%AB`);
  await page.waitForSelector('.twin');
  await shot('24-katakana-twin');

  await page.goto(`${base}/#/practice/lookalike`);
  await page.waitForTimeout(300);
  await page.goto(`${base}/#/practice/flash`);
  await page.locator('.flashcard').click();
  await shot('17-flashcard');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${base}/#/kana/%E3%81%AD`);
  await page.waitForTimeout(400);
  await shot('18-dark-detail');
  await page.goto(base);
  await page.waitForTimeout(400);
  await shot('19-dark-home');

  assert(errors.length === 0, `browser errors: ${errors.join('\n')}`);
  console.log('E2E OK');
} catch (e) {
  await shot('zz-failure').catch(() => {});
  console.error(e);
  console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
}
