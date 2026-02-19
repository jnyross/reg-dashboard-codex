# Plan — Real Data Ingestion for Under-16/Teen Regulation Dashboard

## Goal
Extend the existing MVP dashboard (Express + SQLite + HTML frontend) to ingest REAL regulatory data from live sources, replacing seed data with comprehensive global coverage.

## What Exists (MVP baseline)
- Node/TypeScript backend with Express + SQLite
- API: /api/health, /api/brief, /api/events (filter/paginate), /api/events/:id/feedback
- Frontend dashboard with top brief + detail table + 🌶️ risk + feedback
- 8 seeded sample events, 140 passing tests
- Scoring validation (1-5 bounds)

## What Must Be Built

### 1. Source Registry + Crawler Framework
- Define a source registry (JSON/DB) mapping jurisdictions → official URLs, RSS feeds, API endpoints
- Build a pluggable crawler that can:
  - Fetch HTML pages from regulator sites
  - Parse RSS/Atom feeds
  - Query news APIs (e.g. Brave Search, NewsAPI, Google News)
  - Run general web searches for regulatory keywords
- Each source gets a reliability tier: official (5), legal/industry (4), general news (3), social (2)

### 2. LLM Analysis Pipeline (MiniMax M2.5)
- For each crawled item, call MiniMax M2.5 to:
  - Determine relevance (is this about teen/child online regulation affecting Meta?)
  - Extract structured fields: jurisdiction, stage, age range (13-15 / 16-18 / both), affected Meta products
  - Score impact (1-5), likelihood (1-5), confidence (1-5)
  - Generate summary + business impact + required solutions
  - Identify competitor responses mentioned
- Use the minimax-coding-plan/MiniMax-M2.5 endpoint (already configured in OpenCode)

### 3. Age Range Model
- Track whether regulation targets early teens (13-15), late teens (16-18), or both
- Display age bracket in dashboard brief and detail views
- Filter by age bracket

### 4. Data Persistence + Dedup
- Store crawled + analysed items in SQLite regulation_events table
- Dedup by source URL + jurisdiction + instrument title
- Track status changes over time (new → updated → status_changed)
- Keep raw source text + provenance links

### 5. Coverage Scope
- Time horizon: last 5 years through upcoming/proposed
- Geography: all Meta operating markets (US federal + 50 states + EU/EEA + UK + Australia + Canada + major APAC + LATAM)
- Must capture: in-flight, upcoming, recently enacted, and historical with current status

### 6. On-Demand Trigger
- CLI command or API endpoint to trigger a full crawl + analysis run
- No automatic cron for MVP

### 7. Dashboard Updates
- Replace seed data display with real data
- Add age bracket filter (13-15 / 16-18 / all)
- Add source reliability indicator
- Show "last crawled" timestamp

## Implementation Order
1. Source registry + at least 20 real sources across jurisdictions
2. Crawler framework (fetch + parse)
3. MiniMax M2.5 analysis pipeline integration
4. Dedup + persistence
5. Trigger endpoint/CLI
6. Dashboard updates (age filter, reliability, real data)
7. Tests for all new components

## Success Criteria
- Running the trigger produces real, current regulatory data in the dashboard
- At least 20+ real regulation items from multiple jurisdictions
- Age brackets correctly identified
- Source reliability visible
- All existing + new tests pass
