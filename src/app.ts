import express, { Request, Response } from "express";
import DatabaseConstructor from "better-sqlite3";

type Stage =
  | "proposed"
  | "introduced"
  | "committee_review"
  | "passed"
  | "enacted"
  | "effective"
  | "amended"
  | "withdrawn"
  | "rejected";

type FeedbackRow = {
  id: number;
  event_id: string;
  rating: "good" | "bad";
  note: string | null;
  created_at: string;
};

const allowedStages: Stage[] = [
  "proposed",
  "introduced",
  "committee_review",
  "passed",
  "enacted",
  "effective",
  "amended",
  "withdrawn",
  "rejected",
];

const stageUrgency: Record<Stage, number> = {
  proposed: 9,
  introduced: 8,
  committee_review: 7,
  passed: 6,
  enacted: 5,
  effective: 4,
  amended: 3,
  withdrawn: 2,
  rejected: 1,
};

const defaultBriefLimit = 5;

const allowedRatings = new Set(["good", "bad"]);

type DbEventRow = {
  id: string;
  title: string;
  jurisdiction_country: string;
  jurisdiction_state: string | null;
  stage: Stage;
  is_under16_applicable: number;
  impact_score: number;
  likelihood_score: number;
  confidence_score: number;
  chili_score: number;
  summary: string | null;
  effective_date: string | null;
  published_date: string | null;
  source_name: string;
  source_url: string;
  updated_at: string;
  created_at: string;
  urgency_rank?: number;
};

function parsePaging(value: unknown, defaultValue: number, maxValue?: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }

  if (parsed <= 0) {
    return defaultValue;
  }

  if (maxValue !== undefined) {
    return Math.min(parsed, maxValue);
  }

  return parsed;
}

function parseStageList(value: string | undefined): Stage[] {
  if (!value) return [];

  const requested = value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as Stage[];

  return requested.filter((value) => allowedStages.includes(value));
}

function parseSingleInt(value: unknown, min?: number, max?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  if (min !== undefined && parsed < min) {
    return undefined;
  }

  if (max !== undefined && parsed > max) {
    return undefined;
  }

  return parsed;
}

function mapEvent(row: DbEventRow) {
  return {
    id: row.id,
    title: row.title,
    jurisdiction: {
      country: row.jurisdiction_country,
      state: row.jurisdiction_state,
    },
    stage: row.stage,
    isUnder16Applicable: Boolean(row.is_under16_applicable),
    scores: {
      impact: row.impact_score,
      likelihood: row.likelihood_score,
      confidence: row.confidence_score,
      chili: row.chili_score,
    },
    summary: row.summary,
    effectiveDate: row.effective_date,
    publishedDate: row.published_date,
    source: {
      name: row.source_name,
      url: row.source_url,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createBriefSelect(sqlLimit: number): string {
  return `
    SELECT
      e.id,
      e.title,
      e.jurisdiction_country,
      e.jurisdiction_state,
      e.stage,
      e.is_under16_applicable,
      e.chili_score,
      e.summary,
      e.source_id,
      s.name AS source_name,
      s.url AS source_url,
      e.updated_at,
      e.created_at,
      e.impact_score,
      e.likelihood_score,
      e.confidence_score,
      e.effective_date,
      e.published_date,
      CASE e.stage
        WHEN 'proposed' THEN 9
        WHEN 'introduced' THEN 8
        WHEN 'committee_review' THEN 7
        WHEN 'passed' THEN 6
        WHEN 'enacted' THEN 5
        WHEN 'effective' THEN 4
        WHEN 'amended' THEN 3
        WHEN 'withdrawn' THEN 2
        WHEN 'rejected' THEN 1
      END AS urgency_rank
    FROM regulation_events e
    JOIN sources s ON s.id = e.source_id
    ORDER BY
      e.chili_score DESC,
      urgency_rank DESC,
      e.updated_at DESC,
      e.id ASC
    LIMIT ${sqlLimit};
  `;
}

export function createApp(db: DatabaseConstructor.Database) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "v1",
    });
  });

  app.get("/api/brief", (req: Request, res: Response) => {
    const limit = parsePaging(req.query.limit, defaultBriefLimit, 20);
    const rows = db.prepare(createBriefSelect(limit)).all() as DbEventRow[];
    const items = rows.map((row) => ({
      ...mapEvent(row),
      urgencyScore: stageUrgency[row.stage] ?? 0,
      chiliScore: row.chili_score,
    }));

    res.json({
      generatedAt: new Date().toISOString(),
      items,
      total: rows.length,
      limit,
    });
  });

  app.get("/api/events", (req: Request, res: Response) => {
    const jurisdiction = typeof req.query.jurisdiction === "string" ? req.query.jurisdiction.trim() : undefined;
    const stageRaw = typeof req.query.stage === "string" ? req.query.stage : undefined;
    const minRisk = parseSingleInt(req.query.minRisk, 1, 5);

    if (req.query.minRisk !== undefined && minRisk === undefined) {
      return res.status(400).json({ error: "minRisk must be an integer between 1 and 5" });
    }

    const page = parsePaging(req.query.page, 1);
    const limit = parsePaging(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;

    const requestedStages = parseStageList(stageRaw);
    if (stageRaw !== undefined && requestedStages.length === 0) {
      return res.status(400).json({ error: "stage must use valid lifecycle values" });
    }

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (jurisdiction) {
      whereClauses.push("(e.jurisdiction_country = ? OR e.jurisdiction_state = ?)");
      params.push(jurisdiction, jurisdiction);
    }

    if (requestedStages.length > 0) {
      const placeholders = requestedStages.map(() => "?").join(", ");
      whereClauses.push(`e.stage IN (${placeholders})`);
      params.push(...requestedStages);
    }

    if (minRisk !== undefined) {
      whereClauses.push("e.chili_score >= ?");
      params.push(minRisk);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countRow = db.prepare(`SELECT COUNT(*) AS total FROM regulation_events e ${where}`).get(...params) as {
      total: number;
    };
    const total = countRow?.total ?? 0;

    const rows = db
      .prepare(
        `
      SELECT
        e.id,
        e.title,
        e.jurisdiction_country,
        e.jurisdiction_state,
        e.stage,
        e.is_under16_applicable,
        e.impact_score,
        e.likelihood_score,
        e.confidence_score,
        e.chili_score,
        e.summary,
        e.effective_date,
        e.published_date,
        e.updated_at,
        e.created_at,
        s.name AS source_name,
        s.url AS source_url
      FROM regulation_events e
      JOIN sources s ON s.id = e.source_id
      ${where}
      ORDER BY e.updated_at DESC, e.id ASC
      LIMIT ? OFFSET ?
    `
      )
      .all(...params, limit, offset) as DbEventRow[];

    res.json({
      items: rows.map(mapEvent),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  });

  app.get("/api/events/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const row = db
      .prepare(
        `
      SELECT
        e.id,
        e.title,
        e.jurisdiction_country,
        e.jurisdiction_state,
        e.stage,
        e.is_under16_applicable,
        e.impact_score,
        e.likelihood_score,
        e.confidence_score,
        e.chili_score,
        e.summary,
        e.effective_date,
        e.published_date,
        e.updated_at,
        e.created_at,
        s.name AS source_name,
        s.url AS source_url
      FROM regulation_events e
      JOIN sources s ON s.id = e.source_id
      WHERE e.id = ?
    `
      )
      .get(id) as DbEventRow | undefined;

    if (!row) {
      return res.status(404).json({ error: "event not found" });
    }

    const feedbackRows = db
      .prepare(
        `
      SELECT id, event_id, rating, note, created_at
      FROM feedback
      WHERE event_id = ?
      ORDER BY created_at DESC, id DESC
      `
      )
      .all(id) as FeedbackRow[];

    res.json({
      ...mapEvent(row),
      feedback: feedbackRows.map((feedback) => ({
        id: feedback.id,
        eventId: feedback.event_id,
        rating: feedback.rating,
        note: feedback.note,
        createdAt: feedback.created_at,
      })),
    });
  });

  app.post("/api/events/:id/feedback", (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as { rating?: unknown; note?: unknown };
    const rating = typeof body.rating === "string" ? body.rating.toLowerCase() : "";
    const note = typeof body.note === "string" ? body.note.trim() : undefined;

    if (!allowedRatings.has(rating)) {
      return res.status(400).json({ error: "rating must be good or bad" });
    }

    const eventExists = db.prepare("SELECT 1 FROM regulation_events WHERE id = ?").get(id);
    if (!eventExists) {
      return res.status(404).json({ error: "event not found" });
    }

    const createdAt = new Date().toISOString();
    const result = db
      .prepare("INSERT INTO feedback (event_id, rating, note, created_at) VALUES (?, ?, ?, ?)")
      .run(id, rating, note ?? null, createdAt);

    res.status(201).json({
      id: result.lastInsertRowid,
      eventId: id,
      rating,
      note: note ?? null,
      createdAt,
    });
  });

  return app;
}
