# Kana Dojo

A mobile-first web app for learning **hiragana** and **katakana**, made to self-host on a home server.

- **Picture mnemonics.** Every basic kana has a picture and a short story: き looks like a 🔑 **key** → *ki*, ね is a 🐈 **neko** with a curly tail, ツ is a 🌊 **tsunami**.
- **Stroke order.** Animated, numbered strokes for all 150 kana, using KanjiVG data.
- **Writing practice.** You trace over a guide stroke by stroke, then draw from memory. The app grades your shape, stroke count, stroke order and direction, and tells you what went wrong ("stroke 2 goes the wrong way").
- **Pronunciation.** Each kana is spoken by a native Japanese voice (normal or slow). You can record yourself and play both back to compare. Tricky sounds (ふ, つ, the R row, ん…) come with tips.
- **Lessons.** Lessons go row by row: meet → watch → trace → draw → mini quiz. Basics come first, then dakuten (が, ぱ…), then combinations (きゃ, しゅ…).
- **Daily test.** 20 questions a day mixing reading, recall, listening and writing. Kana that are due for review and the ones you miss most come first. Your streak counts the days you practise 🔥.
- **Spaced repetition.** Each kana is tracked separately for reading, recall, listening and writing (Leitner boxes, 1 → 30 day intervals).
- **Extra practice modes.** Flashcards, quick quiz, listening, writing, real words (ねこ, すし, カメラ…), a look-alikes drill (シ/ツ, ソ/ン, ぬ/め…), and a 60-second speed round.
- **Chart and stats.** A full gojūon chart coloured by mastery, a 30-day activity heatmap, test history, accuracy per skill, and your weakest kana.
- **Sync and offline.** Progress is stored in SQLite on your server and syncs across phone, tablet and PC. The app is an installable PWA that keeps working offline and syncs when you're back.
- **Optional extras.** A PIN lock and daily reminder notifications.

## Quick start (Docker Compose)

```bash
git clone <this repo> kana-dojo
cd kana-dojo
docker compose up -d --build
```

Open `http://<your-server>:8080`.

Progress lives in the `kana-data` Docker volume, so it survives restarts and image rebuilds.

### Settings (environment variables in `docker-compose.yml`)

| Variable | Default | What it does |
| --- | --- | --- |
| `APP_PIN` | *(empty)* | If set, the app asks for this PIN once per device before showing or changing progress. |
| `VAPID_SUBJECT` | `mailto:kana-dojo@example.com` | Contact address included with push notifications. Use a real `mailto:` address. |
| `PORT` | `8080` | Port inside the container. |
| `DATA_DIR` | `/data` | Where the SQLite database and the generated push keys are stored. |

### HTTPS (recommended)

Browsers only allow the **microphone (record yourself)**, **installing the app** and **notifications** on HTTPS pages (or `localhost`). Everything else works over plain HTTP. Pick whichever matches your setup:

**Caddy** (gets certificates automatically):

```
kana.example.com {
    reverse_proxy kana-dojo:8080
}
```

**Nginx Proxy Manager / Traefik.** Add a proxy host for port `8080` with a Let's Encrypt certificate. No special headers are needed.

**Tailscale** (no public domain needed):

```bash
tailscale serve --bg 8080
```

Then open `https://<machine>.<tailnet>.ts.net` on your phone.

### Install on your phone

- **iPhone:** open the HTTPS address in Safari, tap Share → **Add to Home Screen**.
- **Android:** open it in Chrome, tap ⋮ → **Install app**.

For daily reminders, open ⚙️ Settings → **Daily reminder** from the installed app. On iPhone, notifications only work from the home-screen app (iOS 16.4+).

### Japanese voice

Pronunciation uses your device's built-in text-to-speech. Most phones already have a Japanese voice. If the app says none was found:

- **iPhone:** Settings → Accessibility → Spoken Content → Voices → Japanese (Kyoko or Otoya; the "Enhanced" versions sound best).
- **Android:** Settings → Text-to-speech → Google → Install voice data → Japanese.

### Backup

```bash
docker run --rm -v kana-dojo_kana-data:/data -v "$PWD":/backup busybox \
  cp /data/kana.db /backup/kana-backup.db
```

## Development

Needs Node 22+.

```bash
npm install
npm run dev:server   # API on :8080
npm run dev          # Vite dev server with hot reload, proxies /api to :8080
```

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the web app into `dist/web` and compiles the server. |
| `npm start` | Runs the production server (serves the app and API). |
| `npm test` | Unit tests: drawing recognizer, spaced repetition, quiz generation, and the sync API. |
| `npm run e2e` | Plays through a lesson and a daily test in headless Chromium on a phone-sized screen, then checks that progress syncs back from the server. Set `CHROMIUM_PATH` if Chromium isn't found. |
| `npm run strokes` | Regenerates `web/src/data/strokes.json` from KanjiVG. |
| `npm run icons` | Renders the PNG app icons from `web/public/icon.svg`. |

### Project layout

```
web/src/data/       kana list with mnemonics, words, stroke data
web/src/lib/        recognizer, spaced repetition, quiz builder, speech, recorder, sync store
web/src/components/ stroke animator, drawing pads, quiz, audio panel
web/src/screens/    home, learn, lesson, daily test, practice, chart, stats, settings
server/src/         Fastify API + SQLite + push reminders
```

### How the drawing check works

Your strokes and the KanjiVG reference strokes are scaled to the same box and resampled to 32 points each.

Each of your strokes is matched to a reference stroke. The match is scored on:

- the average distance between the strokes (overall shape and position)
- the single worst point (this catches a missing loop, like ぬ vs め)

From that matching, the checker also finds missing or extra strokes, strokes drawn backwards, and swapped stroke order.

Long strokes count more than small dashes. A drawing passes with a score of 70 or more, the right number of strokes, and correct order and direction.

## Credits

Stroke order data comes from [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The derived file `web/src/data/strokes.json` is shared under the same license.
