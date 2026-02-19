You are implementing the first runnable backend for this project.

Read first:
- plan.md
- PRD.json
- schemas/regulation-event.json
- activity.md

Goal:
Create a minimal but runnable backend API on local Mac mini for the Global Under-16 Regulation Intelligence Dashboard.

Requirements:
1) Set up a Node + TypeScript backend scaffold (prefer simple/fast stack).
2) Add SQLite persistence with tables for:
   - regulation_events
   - sources
   - feedback (good/bad)
3) Add API endpoints:
   - GET /api/health
   - GET /api/brief (top items for just-read section)
   - GET /api/events (filter by jurisdiction, stage, minRisk; pagination)
   - GET /api/events/:id
   - POST /api/events/:id/feedback  body: {rating:"good"|"bad", note?:string}
4) Seed at least 8 sample events (mixed jurisdictions, risk levels, under-16 flags).
5) Enforce 1-5 bounds for impact/likelihood/confidence/chili in backend validation.
6) Add a README section for running the API locally.
7) Add tests for at least:
   - scoring bounds validation
   - brief ordering by risk and urgency
   - feedback persistence

Constraints:
- Keep implementation straightforward; no over-engineering.
- Use deterministic ordering rules from PRD where applicable.
- Make code compile and tests runnable.

When done:
- Update plan.md and activity.md with concise completion notes.
- Commit once with a clear message.
- Output a short summary with files changed and run commands.