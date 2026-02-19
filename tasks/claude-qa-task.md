You are the QA + integration reviewer for this project.

Read first:
- plan.md
- PRD.json
- activity.md
- backend/frontend files already added in this repo

Goal:
Harden the MVP and close gaps against the PRD.

Requirements:
1) Run available tests and report failures.
2) Add/adjust tests for:
   - API contract shape for /api/brief and /api/events
   - feedback endpoint validation
   - frontend rendering fallback when API errors
3) Create docs/checklist:
   - MVP runbook (start backend + open dashboard)
   - known gaps to hit full PRD
   - recommended next implementation slice
4) Do not redesign architecture; focus on quality and integration.

When done:
- Update plan.md and activity.md with concise QA milestone notes.
- Commit once with clear message.
- Output short summary with test results and next steps.