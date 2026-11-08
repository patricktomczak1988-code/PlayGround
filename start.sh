#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "PORT must be numeric: $PORT" >&2; exit 1; }
: "${OPENCODE_WEB_DIR:?OPENCODE_WEB_DIR must point to the worker metadata directory}"

run() {
  printf '[timing]'
  printf ' %q' "$@"
  printf '\n'
  /usr/bin/time -p "$@"
}

run npm install --ignore-scripts --no-audit --no-fund
run mkdir -p "$PROJECT_DIR/dist"
run cp "$PROJECT_DIR/index.html" "$PROJECT_DIR/game.js" "$PROJECT_DIR/styles.css" "$PROJECT_DIR/dist/"
run mkdir -p "$OPENCODE_WEB_DIR"
PROJECT_DIR="$PROJECT_DIR" OPENCODE_WEB_DIR="$OPENCODE_WEB_DIR" run node -e 'const fs=require("node:fs"); const path=require("node:path"); const project=process.env.PROJECT_DIR; const output={project,directory:path.join(project,"dist")}; if (!path.isAbsolute(output.directory) || !output.directory.startsWith(project+path.sep)) throw new Error("Built directory must be inside project"); fs.writeFileSync(path.join(process.env.OPENCODE_WEB_DIR,"deployment-output.json"),JSON.stringify(output));'
run python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$PROJECT_DIR/dist"
