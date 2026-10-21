// Renders web/public/icon.svg to the PNG sizes the manifest and iOS need.
// Uses a local Chromium through playwright-core (set CHROMIUM_PATH if it isn't found).
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public');
const svg = await readFile(join(pub, 'icon.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();

async function render(file, size, maskable = false) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:100%;height:100%;background:#d9442b;display:grid;place-items:center"><div style="width:80%;height:80%">${svg.replace('rx="112"', 'rx="0"')}</div></div>`
    : svg;
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:100%;height:100%;display:block}</style>${inner}`);
  await page.screenshot({ path: join(pub, file), omitBackground: !maskable });
}

await render('icon-180.png', 180);
await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('icon-maskable-512.png', 512, true);
await browser.close();
console.log('icons written');
