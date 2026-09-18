# Perio-Assist — Test Suite Status

## Done

| Harness | Command | Latest result |
|---|---|---|
| Parser unit tests | `pnpm test` | ✅ pass |
| Narrative TC suite | `pnpm cases` | ✅ 30 pass, 0 fail, 8 skip (out of scope) |
| Synthetic chart eval | `pnpm eval` | ✅ depth 99.3% · bleed 92.1% · rec 94.1% · sup 100% · mob 100% · status 100% |
| Dashboard | `pnpm eval:full` | ✅ all three above, soft-continue |

All test files live in [`testing/`](./testing/):
`perio.test.js` · `cases.js` · `eval.js` · `eval_gen.py` · `gen_clinical.py` · `run_eval.sh` · `acoustic-eval/`

`gen_clinical.py` now emits suppuration (5 %, depth ≥ 4 only) and mobility (18 % non-zero, grades 0–3) in both transcript and ground truth.

---

## Left — Acoustic eval

`espeak-ng` and `sox` are installed. One step needed:

**Patch `testing/acoustic-eval/synth.py`** — swap the macOS `say`/`afconvert` calls for `espeak-ng` + `sox`:

```python
# replace the subprocess.run block inside synth():
subprocess.run(
    ['espeak-ng', '-v', 'en-us', '-s', str(rate), '-w', aiff, text], check=True
)
subprocess.run(
    ['sox', aiff, '-r', '16000', '-c', '1', '-e', 'signed-integer', '-b', '16', wav], check=True
)
os.remove(aiff)
```

> `aiff` here is just a temp filename — rename it to `.wav.tmp` or similar since espeak-ng writes a proper WAV directly. Simplest: write espeak-ng output to a temp path, convert with sox, delete temp.

Then run in order:

```bash
python3 testing/acoustic-eval/synth.py        # generates fixtures/ (~240 WAVs)
python3 testing/acoustic-eval/run.py          # WER + digit-WER per noise profile → results.json
node   testing/acoustic-eval/chartmatch.js    # chart-match per profile
```

**Key metrics unlocked:**
- Overall WER and **digit-WER** (clinically critical) across clean / suction (10 dB) / harsh (5 dB) profiles
- Chart-match % per noise profile (noise degradation Δ)

`chartmatch.js` currently scores `clean` only — extend `if (r.profile !== 'clean') continue` to group by profile for the full noise-degradation picture.
