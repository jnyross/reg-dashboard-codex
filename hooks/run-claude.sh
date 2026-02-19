#!/usr/bin/env bash
set -euo pipefail
claude -p --model claude-opus-4-6 "$(cat PROMPT.md)"
