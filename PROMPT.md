You are extending an existing Node/TypeScript dashboard to ingest REAL regulatory data about teen (13-18) online safety laws affecting Meta.

READ FIRST: ./plan.md and ./PRD.json for full requirements.

The existing codebase has a working Express + SQLite backend with seed data and a frontend dashboard. Your job is to ADD real data ingestion.

CRITICAL RULES:
- WRITE CODE EVERY ITERATION. No planning-only or "governance checkpoint" iterations. If you're not creating/editing .ts/.js/.json/.html/.css files, you're doing it wrong.
- DO NOT loop on no-op continuity checks. Build something or output <promise>COMPLETE</promise>.
- Commit after each meaningful chunk of work.

WHAT TO BUILD (in order):
1. Source registry: create src/sources.ts with 20+ real regulator URLs, RSS feeds, and news search queries covering US federal + states, EU, UK, Australia, Canada, APAC. Each source has a reliability tier (1-5).

2. Crawler: create src/crawler.ts that fetches pages/feeds/search results. Use node-fetch or built-in fetch. Handle errors gracefully.

3. LLM analysis: create src/analyzer.ts that sends crawled text to MiniMax M2.5 API (endpoint: https://api.minimax.io/anthropic, use MINIMAX_API_KEY env var) to:
   - Determine if the item is relevant to teen online regulation affecting Meta
   - Extract: jurisdiction, stage, age bracket (13-15 / 16-18 / both), affected Meta products, summary, business impact, required solutions, competitor responses
   - Score: impact (1-5), likelihood (1-5), confidence (1-5), chilli (1-5)

4. Persistence: extend src/db.ts to store real crawled+analysed items, dedup by URL+jurisdiction+title, track status changes.

5. Trigger: add POST /api/crawl endpoint and/or CLI command (e.g. `npm run crawl`) to run the full pipeline.

6. Dashboard updates: add age bracket filter, source reliability indicator, "last crawled" timestamp. Replace seed data display with real data.

7. Tests: add tests for crawler, analyzer, dedup, trigger endpoint.

WHEN DONE: output exactly <promise>COMPLETE</promise>

Max 50 iterations. Every iteration must produce code changes.
