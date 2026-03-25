# Hungarify

Expo (React Native) app for practicing core Hungarian grammar: verb conjugation, noun cases, vowel harmony, word order, and numbers/time.

## Setup

```bash
npm install
```

## Run

```bash
npx expo start
```

Open the project in **Expo Go** on an iPhone (scan the QR code), or press `i` for the iOS simulator.

## Project layout

- `app/` — Expo Router screens (dashboard, reference, exercises)
- `src/engine/` — Exercise generation and answer checking
- `src/data/` — JSON exercise content
- `src/db/` — SQLite progress (`expo-sqlite`)
- `knowledge-source/` — Hungarian lesson materials (PDFs, chats, markdown notes, etc.) tracked in this repo for backup and sharing
- `src/data/knowledge/` — generated JSON consumed by the app (run the ingest script after editing sources)

### Personal knowledge ingest

The app bundles structured data built from `knowledge-source/` (top-level `*.md` and lesson `chat*.txt` files).

- **Source directory:** defaults to `./knowledge-source` in the repo. Override with `KNOWLEDGE_SOURCE=/path/to/dir`.
- **Regenerate JSON:** `npm run ingest:knowledge`
- **Quality report:** `src/data/knowledge/ingestion-report.json` (counts and skipped chat lines).
- After ingest, reload Metro so Reference and drills pick up changes.

You can also keep a **symlink** at `knowledge-source` pointing elsewhere on your machine instead of the in-repo copy; the ingest script only needs a readable directory.

Progress is stored on-device only; no network calls are required for drills.
