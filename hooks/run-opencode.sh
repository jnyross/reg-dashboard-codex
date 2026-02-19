#!/usr/bin/env bash
set -euo pipefail
opencode run --model minimax-coding-plan/MiniMax-M2.5 --dir . "$(cat PROMPT.md)"
