# AGENTS.md — voice-perio (Perio-Assist)

Voice-controlled periodontal charting. Hygienist speaks probing depths +
conditions hands-free; the chart fills in real time (<300ms mic→pixels),
solo or with a team. Single-page app, no backend, works offline after
first load.

Repo root is hackathon shell (`README.md`, `assets/`, `slides.txt`,
`backend/` is an intentional stub — static file server only). **The app
lives in `frontend/` — all paths below are relative to it unless noted.**

## Stack

- **Svelte 5** (runes: `$state`, `$derived`, snippets) + **Vite 6**, package
  manager is **pnpm** — never npm.
- **STT engines** **vosk-browser** (on-device WASM, model in
  `frontend/public/model.tar.gz`, gitignored, installed by `scripts/setup.sh`).
- Parser is dependency-free vanilla JS so it runs in node tests unchanged.

## Setup & commands (run from `frontend/`)

```sh
pnpm setup            # one-time: downloads Vosk model into public/ (default: lgraph 130MB; --small/--all/--force)
pnpm dev              # localhost dev server (mic requires localhost/https, never file://)
pnpm test             # unit tests (perio + feedback, assert-based, no framework) - run before every commit
pnpm build            # production build (validates Svelte compile)
pnpm eval             # synthetic text eval: transcripts + ground truth -> depth/bleed/rec/status scores
pnpm cases            # 38 narrative test cases (self-contained in scripts/cases.js) -> pass/fail/skip
pnpm acoustic         # TTS fixtures x voices x noise profiles through real model+grammar -> WER + chart-match
```

`scripts/setup.sh` never commits binaries (see `frontend/.gitignore`:
`public/model*.tar.gz`, harness `models/`, `fixtures/`, `results.json`,
`samples/`, `.venv/` — all relative to `frontend/`).
`scripts/acoustic-eval/synth.py --regen/--repad` regenerates/pads fixtures
(0.3s silence both ends — TTS starts instantly and unpadded fixtures bias
onset WER; do not remove the padding).

## Architecture (13 source files — keep it that way)

| File | Role |
|---|---|
| `src/perio.js` | Pure parser + chart state machine. Framework-free, node-testable. THE file most work lands in. |
| `src/perio.test.js` | Unit tests (assert-based, no framework). Every branchy change needs a case here. |
| `src/chart.svelte.js` | Shared `$state` store (`store`), `commit`, `say`, `moveTo`, `resetAll`. Wraps `perio.js`. |
| `src/recognizer.js` | Web Speech + Vosk engines behind one start/stop. Grammar imported from `grammar.json`. |
| `src/grammar.json` | Vosk grammar word lists. **A word must be here or on-device Vosk emits `[unk]`** — parser aliases can't recover un-emitted words. |
| `src/aliases.json` | User-editable mishearing map (`vocation`→`furcation`), applied at tokenize time. Never map syntax words (`are/is/to/and`) — see gotchas. |
| `src/feedback.js` | Pure spoken-summary mapping (`feedbackText`) + `feedback.test.js`. No browser APIs. |
| `src/export.js` | JSON report builder (`buildReport`, `downloadJson`, `reportFilename`) + `export.test.js`. DB-free by design. |
| `src/PerioChart.svelte` | Open Dental-style data chart: arch sections (upper 1–16, lower 32–17), PD + BOP/suppuration/plaque dots, GM, auto-CAL, Mob/Furc rows, click-to-cursor. |
| `src/App.svelte` | Shell: controls, summary strip (BOP%/PI%/max PD/teeth, all `$derived`), transcript, fallback type-in box. |
| `src/main.js` | Mount only. |

`scripts/`: `setup.sh`, `eval.js` + `eval_gen.py` + `gen_clinical.py` (synthetic
patient generator), `cases.js` (38 TCs), `acoustic-eval/` (TTS harness).

## Parser semantics (the contract — read before touching `perio.js`)

- **Sequential flow**: bare numbers fill at the cursor and auto-advance;
  triplets (`3 2 3`) are just sequential fills, no special-casing.
- **Site-targeted writes**: `SITE value` binds immediately (`B 1 … MB 6`
  stays on one tooth). A lone pending value attaches to the named site
  (`5 B 3 B` replaces within B); multi-value buffers stay sequential.
- **Row words park at row start**: `buccal`/`facial` → site 0 (+facial
  aspect), `lingual` → site 3 (+lingual aspect). `mid-buccal` → B(1).
- **Conditions flag in place, cursor stays** (`bleeding MB`, `plaque …`,
  `suppuration …`); bare site words navigate. `buccal` always names the
  row; `facial`/`lingual` name rows only trailing a finished tooth, else
  the mid site. `bleeding all/throughout` = 6 sites; rows chain over `and`.
- **Trailing findings** (`...lingual 4-4-3, bleeding on buccal`) attach to
  the finished tooth via `condTooth` (same-breath: flush boundary;
  later-breath: `overflowed` flag). Explicit navigation always clears it.
- **Corrections patch in place** (`change last to X`, `make the mesial a 5`,
  `correction 2 on distal`) with `prev` values so undo is exact; patching
  the parked site advances past it (re-dictation continues).
- **Backtrack rewind**: a site word right after an unconsummated wrap
  (`DL 5 MB 6`), targeting a hole in the wrapped-from tooth with the new
  tooth untouched, rewinds instead of spilling.
- **Status**: `missing`/`implant` land (implants carry charting); sequential
  `advance`/`next` skip absent teeth. `present` clears. Bulk forms
  (`all wisdom/upper/lower teeth …`) share `markAbsent`. Implant health is
  manual override words only: `peri[- ]implantitis` (red), `recovered`/
  `healed` (green), plain `implant` (yellow) — all tinted teeth probe and
  chart normally; ONLY `MISSING` blanks and skips (flow + stats). All
  status writes are hist entries → undoable.
- **Undo model**: utterance-level groups over a kind-tagged hist
  (`depth`/`bleed`/`rec`/`sup`/`plaque`/`mob`/`fur`/`absent`, each with
  `prev`); `clear`/`scratch` is single-entry, `clear tooth [N]` wipes one
  tooth (status kept) as a single group. Same-utterance writes are preferred
  over older groups; group bookkeeping must survive interleaved clears.
- **Safety valves**: out-of-range numbers hint (never record >12);
  lone `mesial`/`distal` without announced aspect hints instead of guessing;
  `no`/`not`/`without` negate findings; `class`/`mobility`/`furcation`
  grades are consumed as grades, never depths; empty/prose input hints
  (`empty input`, `no clinical data found`).
- **Numbers**: digits + words + teens/twenties composites (`twenty four`);
  tooth announcements (`tooth`/`number`/FDI `(FDI)`/Palmer `upper left 6`/
  names like `upper right first molar`) navigate, never record depths.
  And-lists (`17, 18 and 32 …`) are tentative — kept only with a list
  terminator, else rewound to depths.

## Conventions

- Fewest files possible; shortest working diff wins. No new deps without a
  measured need. New parser behavior = new unit test + cases entry where
  applicable; run `pnpm test && pnpm build` (plus `pnpm eval`/`pnpm cases`
  for parser changes) before committing.
- `ponytail:` comments mark deliberate simplifications and their upgrade
  path — preserve them when editing nearby code.
- UI text stays ASCII; `<meta charset>` is set. pnpm, never npm.

## Gotchas (each paid for at least once)

1. **Never reuse a store key for parser state.** `store.status` (UI string)
   once collided with the tooth-status map → cursor marched 1→32 on first
   input. Parser map is `absent`; UI message stays `status`.
2. **Tokenize-time aliases can't see syntax.** `"are": "all"` corrupted the
   and-list terminator. Contextual handling in-branch instead; the alias
   file warns against syntax words.
3. **Grammar membership gates everything on-device.** A parser alias for a
   word Vosk never emits is dead code — verify emission first.
4. **Constrained decoding drops out-of-grammar words to `[unk]` silently.**
   A parser alias for an un-emitted word never fires and no error surfaces —
   verify emission with `pnpm acoustic`, not by reading the grammar.
5. **TTS ≠ real speech.** Fixture evidence ranks hypotheses; user recordings
   (`samples/`, never committed) decide. Observed live confusions so far:
   `furcation`→`vocation`, lgraph TTS `furcation`→`suppuration`/`facial`
   (repaired via grades-never-follow-those-words rule).
6. **`advance()` skips absent teeth only on tooth arrival**, never mid-fill
   (or implant charting breaks). `skipAbsent` + explicit-land is the pairing.
7. **Reference data has bugs.** `periodontal_chart_test_cases.md` (git history
   only — `scripts/cases.js` is self-contained) TC-016 claims FDI 26 =
   Universal 12; it is 14 (consistent with its own TC-017).
   Trust math over prose; the harness asserts 14 with a note.
8. **Generator realism gaps** (`scripts/gen_clinical.py`): bleed verbalized
   only 80%, recession 70% — the residual eval misses are unwinnable by
   design. Its old `with bleeding` correction template asserted findings
   independent of truth and was removed; correction templates must stay
   finding-neutral.
9. Rebase replays hashes → next push needs `--force-with-lease`. Never
   commit `public/model*.tar.gz`, harness heavies, or `samples/`.

## Baselines (Sep 2026 laptop hardware — re-run, don't trust blindly.
Methodology and honest scope for every number: see `EVAL.md`.)

- `pnpm cases`: 33 pass, 0 fail, 7 skip (fan-out, stats/classification/
  sessions, Miller-note — documented in-file).
- `pnpm eval` (synthetic, 10×32): depth ~99.8%, bleed ~93% (residual is
  mostly the generator's silent rates), rec ~95%, status 100%.
- `pnpm acoustic` (TTS fixtures, same grammar, native libvosk — browser WASM
  runs ~1.5-2x slower; TTS ≠ real speech, white-noise profiles are crude):
  | model | WER clean/harsh | digits clean/harsh | decode med/p95 | RTF |
  |---|---|---|---|---|
  | small-en-us (41MB) | 24%/37% | 14%/32% | 11/16ms | 0.01 |
  | lgraph-0.22 (130MB) | 17%/46% | 14%/53% | 57/80ms | 0.03 |
  lgraph wins clean audio, loses under synthetic noise, and decodes ~5x
  slower — on office-class hardware that ratio threatens the 300ms budget.
  Verdict pending live trial.
- In-page bench: open `/bench.html` on any machine (5 fixtures × 5 reps,
  model auto-labeled by download size, copy-pasteable report) — the way to
  measure office PCs with zero installs. `run.py --model-dir PATH` selects
  the offline model.

## Git

Remote `origin` (Perio-Assist), branches `main`/`dev`/`test`. Commit per
feature with a plain message. Model binaries and voice samples never enter
history (a 130MB blob was purged once with `filter-repo` — do not repeat).
