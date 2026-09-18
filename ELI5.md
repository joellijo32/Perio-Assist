# How the whole thing works, ELI5

## The one-sentence version

The hygienist talks to the computer the way they'd talk to a human
assistant holding the chart — *"three, two, three… bleeding…"* — and the
chart fills itself in, live.

## The cast: ears, brain, and paper

Imagine a super-fast dental assistant sitting inside the computer. She has
three parts:

1. **Ears** — hears sounds and turns them into words. (That's the speech model.)
2. **Brain** — understands what the words *mean for the chart*. (That's the parser.)
3. **Paper** — the chart on screen that she writes on. (That's the UI.)

A spoken sentence travels ears → brain → paper in under a third of a
second. Let's follow one: **"three two three, bleeding."**

## The ears (speech recognition)

The ears are a program called **Vosk** that lives *inside the browser* —
nothing is sent to the internet, so it works offline and no patient audio
ever leaves the room.

- Before starting, the ears download a **model**: a ~41MB file of "what
  English sounds like." One download, then it's yours forever.
- The ears also get a **word list** (the "grammar"): only ~100 words —
  numbers, tooth parts, commands. Anything said outside the list comes out
  as *"I didn't catch that"* (`[unk]`).
- Why the list matters: if the ears only have to choose between 100 words
  instead of all of English, they mix things up far less. Saying "tree"
  for "three" still works because we taught the brain that trick.

So *"three two three, bleeding"* arrives at the brain as the words:
`three, two, three, bleeding`. Sometimes with mistakes (`vocation`
instead of `furcation`) — the brain has a small cheat-sheet for the known
ones.

## The brain (the parser — the clever bit)

The brain keeps track of **where the probe is**: which tooth (1–32) and
which of its 6 spots (each tooth has 3 spots on the cheek side, 3 on the
tongue side). Think of a little blue cursor hopping around the mouth.

Rules it lives by, in plain words:

- **Numbers fill boxes.** Each number drops into the current box and the
  cursor hops forward. `3 2 3` fills three boxes. That's all triplets
  are — no magic.
- **Naming a spot jumps there.** `MB` (front-cheek corner), `bleeding`,
  `distal`… say a spot's name and the cursor goes to it. Say `buccal`
  and it goes to the start of the cheek row.
- **Findings stick where they land.** Saying `bleeding` pins a red flag on
  the spot just probed, without moving the cursor. Saying it *with* a
  spot (`bleeding MB`) pins it there.
- **It finishes your tooth for you.** If you say `bleeding` right after
  finishing tooth 14's six numbers, it knows you mean tooth 14 — even
  though the cursor already moved on.
- **Corrections fix in place.** `change last to 5`, `make the mesial a 5`,
  `scratch that` — it erases and rewrites that one box, like white-out.
  `undo` takes back your whole last sentence; `clear tooth 14` wipes one
  tooth (and one more `undo` brings it all back).
- **Tooth states.** `tooth 5 is missing` crosses the tooth out (greyed,
  skipped over). `implant` tints it yellow, `peri-implantitis` red,
  `recovered` green. Only missing teeth get skipped — tinted ones still
  get probed.
- **It asks instead of guessing.** Say a number too big for a pocket
  (`15`)? It warns instead of writing. Say `mesial` without saying which
  side first? It asks `facial or lingual?` instead of flipping a coin.
  Say `no bleeding`? It records *no* flag rather than a flag.
- **Navigation words are never measurements.** `tooth 12`, `jump 24`,
  `upper left 6`, `upper right first molar`, even `tooth 26 (FDI)` — all
  just move the cursor. `next`, `back`, `repeat` do what they sound like.

## The paper (the chart on screen)

The chart looks like the ones dentists know (modeled on Open Dental):
upper teeth 1–16 across the top, lower teeth 32–17 across the bottom, six
little boxes per tooth.

- **Numbers** in the boxes; deep ones (4+) turn red.
- **Red dots** above a box = bled there. **Yellow** = pus (suppuration).
  **Blue** = plaque.
- **GM row** = gum recession; **CAL row** = computed automatically
  (depth + recession).
- **Mob/Furc rows** = wiggly teeth (mobility 0–3) and root-splitting
  (furcation grades).
- Clicking any box moves the blue cursor there — for when you want to
  point instead of speak. Click again (or Enter) to type a number in.
- The top strip keeps score live: teeth done, % bleeding, % plaque,
  deepest pocket.

## The safety nets (so it never confidently writes nonsense)

- **Undo everything**: every mark remembers what was there before, grouped
  by sentence.
- **Hints, not silent failures**: empty mic, gibberish input, out-of-range
  numbers, ambiguous anatomy — each produces a plain-English note in the
  status line.
- **Type-in box**: if the mic ever misbehaves mid-appointment, type the
  exact same words — same brain, same chart.

## How we know any of this works (the part you never see)

Three robot test-suites run on every change:

1. **Unit tests** — dozens of tiny "say X, expect Y in box Z" checks,
   including every bug ever found (each got its own test so it can never
   sneak back).
2. **38 story tests** — full narrations like *"Tooth 14, buccal 4-5-4…
   bleeding on buccal"* checked against expected charts. 33 pass; the rest
   are documented as out-of-scope (things like insurance codes and
   multi-visit history — a records system, not a charting engine).
3. **Fake patients + fake voices** — a generator invents thousands of
   synthetic mouths with known truth, and computer voices read the scripts
   (in clean, suction-noise, and harsh-noise versions) through the real
   ears, scoring depth/bleed accuracy. That's how the 41MB vs 130MB model
   question got answered with numbers instead of opinions.

## The 10-second cheat sheet (stick it on the monitor)

| Say | Happens |
|---|---|
| `3 2 3` | fills 3 boxes, cursor advances |
| `bleeding` / `plaque` / `pus` | flags the spot just probed |
| `MB`, `buccal`, `lingual`, `distal`… | cursor jumps there |
| `tooth 12`, `jump 24`, `next` | moves teeth |
| `change last to 5`, `scratch that` | fixes one box |
| `undo` / `clear tooth` | takes back a sentence / a tooth |
| `tooth 5 is missing`, `implant`, `peri-implantitis`, `recovered` | marks the tooth |
| `no bleeding` | records *no* flag |
| `stop` | stops listening |
