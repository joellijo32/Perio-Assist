# PerioVoice — Brief

Hands-free periodontal charting: the hygienist speaks probing depths and
conditions, the chart fills live (<300ms mic→pixels), no assistant needed.
Svelte 5 + Vite + pnpm. On-device speech (Vosk WASM, offline after first
load), deterministic parser, Open Dental-style chart.

## How it works (30 seconds)

Mic → Vosk (words) → `perio.js` (chart meanings: numbers fill at the
cursor, site words navigate, conditions flag in place, corrections patch,
undo groups by utterance) → live chart (PD, BOP/plaque/suppuration dots,
GM, auto-CAL, mobility, furcation, missing/implant/peri-implantitis/
recovered states). Click any cell to move the cursor; click again to type
a depth. `stop` ends dictation by voice.

## Current state

- Charting: depths, BOP, plaque, suppuration, recession (±GM), mobility,
  furcation, missing/implant/peri-implantitis/recovered, FDI/Palmer/tooth
  names, bulk status, corrections, utterance undo, `clear tooth`.
- Scores: unit green · narrative cases 33/33 (+7 documented skips) ·
  synthetic eval depth 99.5% / bleed 92% / rec 95% / status 100%.
- Speech: **small 41MB model won** — lgraph (130MB) showed no accuracy gain
  on our vocabulary and decodes ~5× slower (11 vs 57ms median lab;
  threatens the 300ms budget on office hardware). Live `furcation` fix
  (`vocation` alias, verified on a real recording) is model-independent.
- Benchmarks: `/bench.html` runs on any machine, no installs;
  `pnpm acoustic` for lab A/B. Office-PC numbers still open.

## Key decisions (locked)

- Offline-first, no backend, no cloud STT. PWA after first load.
- Deterministic parser, no LLM in the hot path; hints instead of guesses.
- Manual override words for diagnoses (no auto-staging); only MISSING
  blanks/skips, all tinted teeth probe normally.
- Binaries/voice samples never enter git (`pnpm setup` fetches models).
- pnpm, never npm. Commit per feature, plain messages.

## Open / next

- Office-PC `/bench.html` numbers (2-min on-site run, both models).
- `pnpm dev` needs localhost/https for mic; never `file://`.
- Out of scope by design: stats engine beyond BOP/PI%/max-PD, exam history,
  3D teeth, i18n, plaque beyond per-site flags, GM UI beyond signed row.

See `AGENTS.md` (build/contract/gotchas) and `REFERENCE.md` (voice command
reference) for detail.
