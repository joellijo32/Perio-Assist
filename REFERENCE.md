# VoicePerio — Command Reference

Everything the parser understands, in one place. Say (or type) these
naturally in a sentence — filler words (`is, a, the, that, with, please,
at, on, probing, noted`) are ignored.

## Probing depths (0-12)

Bare numbers fill at the cursor and auto-advance. Triplets are just
sequential fills.

- `3 2 3` — record 3, 2, 3 at the next three sites
- Digits or words: `zero` … `twelve` (`won` = 1, `tree` = 3, `ate` = 8
  also work as mishearing cover)
- Numbers above 12 are never recorded — you get a hint instead
  (say `jump 24` to move to a tooth)

## Site-targeted depths

- `MB 6` / `B 1` / `DB 4` / `ML 3` / `L 2` / `DL 5` — write immediately,
  cursor parks on that site
- Full names: `mesiobuccal, buccal, distobuccal, mesiolingual,
  lingual, distolingual`
- `5 B` — a lone pending value attaches to the named site
- `mid-buccal` / `mid buccal` / `middle lingual` — mid sites B(1) / L(4)
- `mesial buccal`, `distal lingual`, `mesio buccal`, `disto lingual`,
  `m b`, `d l` — paired forms
- Bare `mesial` / `distal` use the announced aspect; with no aspect set
  you get a hint (`mesial - facial or lingual?`) instead of a guess

## Row parking

- `buccal` / `facial` — park at site 0, facial aspect
- `lingual` — park at site 3, lingual aspect
- Example: `buccal 2 3 2`, `lingual 3 2 3`

## Navigation

- `jump 12` / `go 12` / `go to 12` — move to tooth 12
- `tooth 12` / `number 12` / `teeth 1 through 8` — announce, never a depth
- `twenty four` / `thirty two` — spoken composites (teens/twenties work)
- FDI: `tooth 26 FDI` — converts to Universal (26 -> 14)
- Palmer: `upper left 6`, `lower right 3` (quadrant + 1-8)
- Names: `upper right first molar`, `lower left canine`,
  `upper right second premolar` (central/lateral/canine/cuspid/incisor,
  premolar/bicuspid, molar, first/second/third/wisdom)
- Lists: `17, 18 and 32 are missing` — kept only with a terminator
  (`missing, implant, present, mobility, are, is`), else treated as depths
- `next` — next tooth (skips missing) · `back` — previous tooth
- `skip` / `miss` — skip to the next tooth

## Bleeding (BOP)

Cursor stays put; the finding flags in place.

- `bleeding` — flags the site just recorded
- `bleeding MB` / `bleed at mesiobuccal` — flags a site
  (`bleeding, bleed, blood, bop, drop` all work)
- `bleeding on buccal` / `bleeding on lingual` — whole row
- `bleeding all` / `bleeding throughout` — all six sites
- `bleeding on buccal and lingual` — chained rows
- Trailing: `lingual 4 4 3, bleeding on buccal` — attaches to the
  finished tooth

## Plaque (PI)

Mirrors bleeding scope-for-scope.

- `plaque` / `plaque MB` / `plaque on buccal` / `plaque all` /
  `plaque on buccal and lingual` (`pi` also works)

## Suppuration

- `suppuration` / `pus` — flags the site just recorded
- `suppuration MB` / `suppuration MB and DB` — site + `and`-chains

## Recession / GM (gum margin)

CAL is computed automatically (PD + GM).

- `2mm recession` / `recession 2` / `recession 2mm at mid-buccal` —
  targets the site just touched
- `recession 3 buccal` — whole row · `recession 2 all` — whole tooth
- `margin 2` / `gm 2` — same targeting as recession
- Signed: `margin minus 3`, `margin negative 2`, `gm plus two`
- `overgrowth 2` / `hyperplasia 2 buccal` — negative GM, same targeting

## Mobility

- `mobility two` / `mobility 2` — grade 0-3 on the current tooth
- `slight mobility` (= 1) / `moderate mobility` (= 2) /
  `severe mobility` (= 3)
- `no mobility` — clears to 0

## Furcation

Grades are consumed as grades, never depths.

- `class two furcation on buccal` / `furcation class one`
- `furcation 2 on lingual` — grade 1-3, optional side
- `vocation` is auto-corrected to `furcation` (see Mishearings)

## Tooth status

- `missing` / `implant` — marks the current tooth
  (only missing renders blank and skips flow; tinted teeth probe normally)
- `tooth 5 is missing` / `tooth 12 implant` / `tooth 5 present`
- Bulk: `all teeth missing`, `all wisdom teeth missing`,
  `all upper teeth implant`, `all lower teeth present`
- `present` clears the mark and restores charting

## Implant health (manual override, tinted yellow/red/green)

- `tooth 14 has peri-implantitis` / `periimplantitis` / `peri implantitis`
  / `peri implant` / `PI` — red tint, tooth keeps charting (disease monitoring)
- `tooth 14 recovered` / `healed` — green tint
- Plain `implant` — yellow tint. Tinted teeth probe and chart normally;
  only `missing` blanks and skips.

## Corrections

- `change last to 5` — patch the last depth recorded
- `make that 5` / `make the mesial a 5` — patch last depth or a site
- `correction 5 on mesial` — patch a site (site optional -> last depth)
- `repeat` — re-enter the last set of values
- `clear` / `scratch` — take back the single last entry
- `clear tooth` / `clear tooth 14` — wipe the whole tooth (status kept),
  cursor parks for re-charting; one `undo` restores everything
- `undo` — take back the whole last utterance

## Negation

- `no bleeding` / `not bleeding` / `without bleeding` — explicitly
  records absence (also works for `plaque`, `suppuration`, `mobility`)

## Mishearings (auto-corrected)

User-editable map in `src/aliases.json`, applied at tokenize time.
Current entries:

- `vocation` -> `furcation`

Note: a word must also exist in `src/grammar.json` or on-device Vosk
emits `[unk]` and the alias can never fire. Never alias syntax words
(`are, is, to, and`) — they carry sentence structure.

## Hints (nothing recorded)

- `empty input` — silence / no words
- `no clinical data found` — prose with no clinical content
- `PD 15mm outside range 0-12` / `24 is not a depth (0-12)` —
  out-of-range numbers
- `mesial - facial or lingual?` — ambiguous side
- `bleeding site unspecified - verify` — after `some` / `any`
- `furcation grade not heard` / `overgrowth amount not heard` /
  `mobility mentioned but no grade heard`

## App controls (mouse / buttons)

- Start / Stop — click the transcript bar, or press Spacebar
  (typing and focused buttons keep their native behavior)
- Reset — clear the whole chart
- Click any cell — move the cursor there
- Type / Log (header button) — dialog with the type-in box and
  the voice log
- Interim (unconfirmed) results render thin-italic, semi-transparent
- Chimes (WebAudio, no files): rising tone when the engine is ready,
  falling tone on stop, blip on entry, low blip on undo,
  puzzled tone when nothing was understood
