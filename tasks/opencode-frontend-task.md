You are implementing the first runnable dashboard frontend for this project.

Read first:
- plan.md
- PRD.json
- activity.md

Goal:
Create a local web dashboard with:
- a top "just-read" brief section
- a detailed list/table below
- visible 🌶️ 1-5 risk indicator
- per-item feedback buttons (good/bad)

Requirements:
1) Build a simple frontend under web/ (plain HTML/CSS/JS is fine).
2) Connect to backend endpoints:
   - GET /api/brief
   - GET /api/events
   - POST /api/events/:id/feedback
3) Top section should display highest priority items with:
   - title
   - jurisdiction
   - stage
   - risk chili
   - short reason
4) Detailed section should support:
   - basic filters (jurisdiction + min risk)
   - pagination controls
   - source/provenance links
   - feedback actions
5) Add clear "last updated" timestamp and error banner for API/rate-limit failures.
6) Keep UI readable and decision-focused for risk product teams.

Constraints:
- No heavy framework required.
- Keep it robust and easy to run locally.
- Do not rewrite backend architecture.

When done:
- Update plan.md and activity.md with concise completion notes.
- Commit once with clear message.
- Output summary with files changed and how to run.