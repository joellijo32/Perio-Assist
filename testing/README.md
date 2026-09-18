# Testing suite

Three layers, cheapest first. All of them exercise `src/perio.js`'s
`createState()` / `parseInto()` — the voice-command parser that turns
dictated periodontal charting phrases into chart state (probing depths,
bleeding, recession, suppuration, mobility, furcation, tooth status).

Run everything (Linux/macOS, no audio deps needed) from repo root:

```
./testing/run_eval.sh
```

## 1. Unit + narrative tests — `perio.test.js`, `cases.js`

Pure logic, no audio, no Python. Each feeds hand-written phrases straight
into `parseInto` and asserts on the resulting state.

- `perio.test.js` — one long assert chain covering parser mechanics: number
  triplets, navigation ("jump 12", "go to tooth 24"), site resolution (MB,
  full names, bare "buccal"), undo/correction ("change last to 5"), missing
  teeth, recession-vs-depth disambiguation, notation systems (FDI, Palmer,
  tooth names), and known ASR mishearings ("furcation" → "vocation"/"facial").
- `cases.js` — a mini test-case harness (`TC-001`...) modeling realistic
  clinical narration end to end (full sentences, quadrants, implants,
  furcation grades). Some cases are marked `SKIP` on purpose — they name
  features the parser doesn't attempt (BOP%/mean-PD summaries, staging,
  multi-tooth mobility fan-out, multi-session history) so the gap is
  documented instead of silently passing or failing.

Run directly: `node testing/perio.test.js` / `node testing/cases.js`.

## 2. Synthetic chart eval — `eval.js` + `gen_clinical.py`/`eval_gen.py`

Text-only accuracy eval at scale, no TTS/ASR involved.

- `gen_clinical.py` generates a synthetic but clinically-shaped dictation
  transcript for N teeth (randomized depths, bleeding, recession,
  suppuration, mobility, correction phrases, operatory noise), plus the
  ground-truth JSON it was generated from.
- `eval_gen.py` is the CLI wrapper `eval.js` shells out to (`python3
  testing/eval_gen.py <seed> <teeth> <startTooth>`) to get one patient as JSON.
- `eval.js` feeds the transcript through `parseInto`, diffs the resulting
  state against ground truth, and prints hit-rate percentages for depth,
  bleeding, recession, suppuration, mobility, and tooth status. `--latency`
  additionally times each `parseInto` call and reports p50/p95 against a
  5ms budget.

Run: `node testing/eval.js <seed> <patients> <teethPerPatient> [--latency]`.

## 3. Acoustic eval — `acoustic-eval/` (skipped by `run_eval.sh` on Linux by default)

End-to-end pipeline: TTS → noise injection → ASR (Vosk, same grammar as the
app) → `parseInto` → chart diff. Answers "does the whole voice pipeline
survive a noisy operatory," not just "is the parser correct."

1. `synth.py` (or `synth_long.py` for ~90s sessions built by
   `gen_long_utterances.py`) turns `utterances.txt` lines into 16kHz mono
   WAV fixtures via Kokoro TTS + `sox`. Ships as macOS `say`+`afconvert` by
   default per the header comment in `run_eval.sh`; swap in `espeak-ng`+`sox`
   to run on Linux.
2. `run.py` decodes each fixture with Vosk under three noise profiles
   (`clean`, `suction` = 10dB + burst noise, `harsh` = 5dB), computes WER
   (overall and digits-only) against the reference text, and writes
   `results.json`.
3. `chartmatch.js` is the metric that actually matters: it charts both the
   reference and the ASR hypothesis through `parseInto` and diffs the
   resulting *state*, not the raw text — a transcription error that doesn't
   change the chart isn't a clinical error.

Run manually once fixtures exist:
```
python3 testing/acoustic-eval/synth.py
python3 testing/acoustic-eval/run.py
node   testing/acoustic-eval/chartmatch.js
```

`run.py` also warns if any reference utterance uses a word outside
`src/grammar.json`'s closed vocabulary — such a reference is unscoreable,
since the grammar-constrained recognizer can never output that word.
