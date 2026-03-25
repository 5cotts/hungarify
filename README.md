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

The app bundles structured data built from `knowledge-source/` (`*.md`, lesson `chat*.txt`, and now `.doc/.docx`; add `--pdf` for OCR PDFs).

- **Source directory:** defaults to `./knowledge-source` in the repo. Override with `KNOWLEDGE_SOURCE=/path/to/dir`.
- **Regenerate JSON:** `npm run ingest:knowledge` (`.md`, `chat*.txt`, `.doc`, `.docx`). Add `--pdf` to merge OCR from all `*.pdf` files as well (slower).
- **Quality report:** `src/data/knowledge/ingestion-report.json` (counts, skipped chat lines, and optional PDF OCR stats).
- After ingest, reload Metro so Reference and drills pick up changes.

You can also keep a **symlink** at `knowledge-source` pointing elsewhere on your machine instead of the in-repo copy; the ingest script only needs a readable directory.

#### PDF OCR ingest (optional)

All `*.pdf` files under the knowledge source are **not** processed unless you opt in. OCR uses [Tesseract.js](https://github.com/naptha/tesseract.js) (Hungarian + English) on rasterized pages ([pdf.js](https://mozilla.github.io/pdf.js/) + [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas), matching pdf.js’s Node canvas backend).

- **Run:** `npm run ingest:knowledge -- --pdf`
- **Limit pages (faster iteration):** `--pdf-max-pages=20` caps total pages OCR’d across all PDFs.
- **Subset by path (all source files):** `--include=regex` filters markdown/chat/PDF by relative path (e.g. `--include='^3\\. [^/]+/'` for lesson 3). `--pdf-include` remains as a compatibility alias.
- **Word docs:** `.docx` is parsed via Mammoth, `.doc` via WordExtractor, then fed through the same vocab/rule/phrase heuristics and cache.
- **Incremental cache (default with `--pdf`):** caches markdown/chat/PDF parse results. Only changed files are reprocessed; outputs are rebuilt from cache for deterministic full datasets.
- **Force full OCR rebuild:** add `--pdf-rebuild`.
- **Custom cache location:** `--source-cache-dir=/absolute/path` (`--pdf-cache-dir` still works as a compatibility alias).

**Prerequisites:** `npm install` must have completed so `@napi-rs/canvas`, `pdfjs-dist`, and `tesseract.js` are present. The first OCR run may download `hun`/`eng` traineddata (needs network once).

**Expectations:** Full runs over many PDFs can take a long time and use noticeable CPU and memory. Noisy scans yield noisy text; low-confidence pages are dropped (see `pdf.pdfItemsDroppedLowConfidence` in the report). Tune with `--pdf-max-pages` while iterating.

**Troubleshooting:** If `@napi-rs/canvas` fails to install, use a supported Node/OS combo or install platform build tools. pdf.js may warn about `standardFontDataUrl` under Node; rendering still succeeds for most lesson PDFs. If OCR quality is poor, try higher-DPI source PDFs or reduce scanned skew before ingest.

Progress is stored on-device only; no network calls are required for drills.
