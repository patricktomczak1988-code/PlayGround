#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an evidence directory}"
[[ "$CAPTURE_DIR" = /* ]] || { echo 'CAPTURE_DIR must be an absolute path.' >&2; exit 1; }
case "$CAPTURE_DIR/" in
  "$PROJECT_DIR/"*) echo 'CAPTURE_DIR must be outside the project.' >&2; exit 1 ;;
esac
: "${HOME:?HOME must be set for the browser runtime}"

run() {
  printf '[timing]'
  printf ' %q' "$@"
  printf '\n'
  /usr/bin/time -p "$@"
}

run bash -n "$PROJECT_DIR/capture.sh"
run mkdir -p "$CAPTURE_DIR"
export CAPTURE_READY_SELECTOR='#gameCanvas'
export CAPTURE_STRICT=1
run node "${RUNTIME_DIR:-/home/runner/work/_temp/omgithub-runtime}/scripts/default-capture.mjs"
