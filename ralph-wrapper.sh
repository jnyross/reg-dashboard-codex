#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="./logs"
mkdir -p "$LOG_DIR"

run_codex() {
  codex exec --skip-git-repo-check --full-auto -s workspace-write -m gpt-5.3-codex-spark "$(cat PROMPT.md)" 2>&1 | tee -a "$LOG_DIR/codex.log"
}

run_claude() {
  claude -p --model claude-opus-4-6 "$(cat PROMPT.md)" 2>&1 | tee -a "$LOG_DIR/claude.log"
}

run_opencode() {
  opencode run --model minimax-coding-plan/MiniMax-M2.5 --dir . "$(cat PROMPT.md)" 2>&1 | tee -a "$LOG_DIR/opencode.log"
}

# Parallel for combinations
run_codex &
PID1=$!
run_claude &
PID2=$!
run_opencode &
PID3=$!

wait "$PID1" "$PID2" "$PID3"
