#!/usr/bin/env bash
# One-time model setup: downloads Vosk models (never committed, see .gitignore).
# Usage: ./scripts/setup.sh [--small|--lgraph|--all] [--force]   (default: --lgraph)
set -euo pipefail

VARIANT="lgraph"
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --small) VARIANT="small" ;;
    --lgraph) VARIANT="lgraph" ;;
    --all) VARIANT="all" ;;
    --force) FORCE=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUB="$ROOT/public"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ponytail: bounds, not pins - upstream publishes no hashes; layout check is the real verification
fetch() { # name zip-url min-bytes top-dir out-tar
  local name="$1" url="$2" min="$3" top="$4" out="$5"
  if [ -f "$out" ] && [ "$FORCE" -eq 0 ] && tar -tzf "$out" 2>/dev/null | grep -q "^$top/am/"; then
    echo "keep $out"
    return 0
  fi
  echo "fetch $name..."
  curl -sSL -o "$TMP/$name.zip" "$url"
  local bytes
  bytes=$(wc -c < "$TMP/$name.zip" | tr -d ' ')
  if [ "$bytes" -lt "$min" ]; then
    echo "suspicious size for $name: $bytes bytes (want >= $min)" >&2
    exit 1
  fi
  rm -rf "$TMP/$name" && mkdir -p "$TMP/$name"
  unzip -q -o "$TMP/$name.zip" -d "$TMP/$name"
  for d in am graph ivector; do
    [ -d "$TMP/$name/$top/$d" ] || { echo "bad layout in $name: missing $d" >&2; exit 1; }
  done
  mkdir -p "$PUB"
  tar -czf "$out" -C "$TMP/$name" "$top"
  echo "wrote $out"
}

SMALL_URL="https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
LGRAPH_URL="https://alphacephei.com/vosk/models/vosk-model-en-us-0.22-lgraph.zip"

case "$VARIANT" in
  small) fetch small "$SMALL_URL" 30000000 vosk-model-small-en-us-0.15 "$PUB/model.tar.gz" ;;
  lgraph) fetch lgraph "$LGRAPH_URL" 100000000 vosk-model-en-us-0.22-lgraph "$PUB/model.tar.gz" ;;
  all)
    fetch small "$SMALL_URL" 30000000 vosk-model-small-en-us-0.15 "$PUB/model.small.tar.gz"
    fetch lgraph "$LGRAPH_URL" 100000000 vosk-model-en-us-0.22-lgraph "$PUB/model.tar.gz"
    ;;
esac

echo "done - run: pnpm dev"
