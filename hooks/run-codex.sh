#!/usr/bin/env bash
set -euo pipefail
codex exec --skip-git-repo-check --full-auto -s workspace-write -m gpt-5.3-codex-spark "$(cat PROMPT.md)"
