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

Progress is stored on-device only; no network calls are required for drills.
