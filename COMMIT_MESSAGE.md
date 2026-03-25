# Commit Message

## Subject
feat: ingest personal Hungarian materials into reference and drill generation

## Body
Add a full ingestion pipeline to transform personal Hungarian study materials into structured app data, and integrate that data into both reference browsing and exercise generation.

### What changed
- add Node-based ingestion command `npm run ingest:knowledge` (via `tsx`)
- add parsing utilities for markdown and lesson chat transcripts:
  - `scripts/lib/parseMarkdown.ts`
  - `scripts/lib/parseChat.ts`
  - `scripts/lib/normalize.ts`
- add orchestration script:
  - `scripts/ingestHungarianKnowledge.ts`
- generate knowledge datasets under `src/data/knowledge/`:
  - `lessons.json`
  - `vocab.json`
  - `rules.json`
  - `phrases.json`
  - `drillSeeds.json`
  - `ingestion-report.json`
- upgrade Reference screen with a new “My materials” mode:
  - keyword search across vocab/rules
  - lesson filter chips
  - topic filter chips
  - source attribution per entry
- integrate imported drill seeds into runtime exercise generation:
  - add `src/engine/knowledgeDrills.ts`
  - extend `generateExercise()` to optionally mix in knowledge-backed drills
  - support lesson-aware filtering for generated drills
- add lesson filter controls in exercise flow to target specific lesson content
- update documentation and tooling:
  - README ingest workflow + source directory notes
  - `package.json` script/deps for ingest tooling
  - TypeScript config adjustments for script/app separation
  - Expo typed-link fix in `components/ExternalLink.tsx`

### Why
This turns personal study artifacts into a repeatable, searchable, and practice-ready knowledge source inside the app. Instead of manually copying examples into static files, content updates can be re-ingested and reflected in reference + drills with one command.

### Validation
- `npm run ingest:knowledge` completes successfully
- ingestion report generated with lesson/vocab/rule/phrase/drill counts
- `npx tsc --noEmit` passes
- Expo iOS export bundles successfully
- manual spot-check of representative ingested entries confirms expected extraction and provenance

### Notes
- MVP ingestion intentionally targets top-level `*.md` and lesson `chat*.txt` for high signal/low noise.
- richer source formats (`pdf`, `rtf`, `docx`) remain future extensions once this pipeline is stable.
