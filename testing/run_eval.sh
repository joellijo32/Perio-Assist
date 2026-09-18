#!/usr/bin/env bash
# ponytail: soft-continue - all harnesses run even if one fails; exit 1 at end if any failed
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

run() {
  echo ""
  echo "=== $1 ==="
  shift
  if ! "$@"; then
    echo "  FAILED ^^"
    fail=1
  fi
}

run "[1/3] parser unit tests"   node "$ROOT/testing/perio.test.js"
run "[2/3] narrative TC suite"  node "$ROOT/testing/cases.js"
run "[3/3] synthetic chart eval (seed=1, 10 patients, 16 teeth)" \
    node "$ROOT/testing/eval.js" 1 10 16

echo ""
echo "=== acoustic eval: SKIP ==="
echo "  Needs one-time model downloads (Kokoro TTS + Vosk), not run automatically:"
echo "    ./scripts/setup.sh                       # Vosk ASR model"
echo "    ./testing/acoustic-eval/setup.sh          # Kokoro TTS model"
echo "    python3 testing/acoustic-eval/synth.py"
echo "    python3 testing/acoustic-eval/run.py"
echo "    node   testing/acoustic-eval/chartmatch.js"

echo ""
[ "$fail" -eq 0 ] && echo "ALL DONE (pass)" || echo "DONE (some failures above)"
exit $fail
