# Global Under-16 Regulation Intelligence Dashboard

## Backend API (Node + TypeScript)

This repository now includes a minimal runnable backend API using Express and SQLite.

### Run the API locally

```bash
npm install
npm run build
node dist/index.js
```

Or run in watch mode during development:

```bash
npm run dev
```

The API defaults to `http://localhost:3001` and creates a local SQLite database at `./data/reg-regulation-dashboard.sqlite`.

### Seed data

On startup the API seeds at least 8 regulation events and required sources if the database is empty.

### API endpoints

- `GET /api/health`
- `GET /api/brief`
- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events/:id/feedback`

### Test

```bash
npm test
```

## Notes

- SQLite schema includes `sources`, `regulation_events`, and `feedback`.
- Scoring bounds for `impactScore`, `likelihoodScore`, `confidenceScore`, and `chiliScore` are enforced to `1..5`.
