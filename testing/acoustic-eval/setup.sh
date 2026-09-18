#!/usr/bin/env bash
# One-time model setup for the acoustic eval: downloads Kokoro TTS model files
# (never committed, see .gitignore). Vosk model setup is ../../scripts/setup.sh.
set -euo pipefail

BASE="$(cd "$(dirname "$0")" && pwd)"
DIR="$BASE/.kokoro"
mkdir -p "$DIR"

# ponytail: bounds, not pins - upstream release publishes no hashes; size check is the real guard
fetch() { # name url min-bytes
  local name="$1" url="$2" min="$3"
  local out="$DIR/$name"
  if [ -f "$out" ] && [ "$(wc -c < "$out")" -ge "$min" ]; then
    echo "keep $out"
    return 0
  fi
  echo "fetch $name..."
  curl -sSL -o "$out" "$url"
  local bytes
  bytes=$(wc -c < "$out" | tr -d ' ')
  if [ "$bytes" -lt "$min" ]; then
    echo "suspicious size for $name: $bytes bytes (want >= $min)" >&2
    rm -f "$out"
    exit 1
  fi
  echo "wrote $out"
}

fetch kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx 300000000
fetch voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin  20000000

echo "done - run: python3 synth.py"
