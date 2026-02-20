"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const ingest_1 = require("./ingest");
const db_1 = require("./db");
const allowedStages = [
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
const allowedAgeBrackets = ["13-15", "16-18", "both"];
const allowedRatings = new Set(["good", "bad"]);
const stageUrgency = {
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
function parsePaging(value, defaultValue, maxValue) {
    if (value === undefined) {
        return defaultValue;
    }
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return defaultValue;
    }
    if (maxValue !== undefined) {
        return Math.min(parsed, maxValue);
    }
    return parsed;
}
function parseStageList(value) {
    if (!value)
        return [];
    const requested = value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    return requested.filter((value) => allowedStages.includes(value));
}
function parseAgeBracketList(value) {
    if (!value)
        return [];
    const requested = value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    return requested.filter((value) => allowedAgeBrackets.includes(value));
}
function parseSingleInt(value, min, max) {
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
function toNullableState(value) {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
}
function mapEvent(row) {
    return {
        id: row.id,
        title: row.title,
        jurisdiction: {
            country: row.jurisdiction_country,
            state: toNullableState(row.jurisdiction_state),
        },
        stage: row.stage,
        ageBracket: row.age_bracket,
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
            reliabilityTier: row.source_reliability_tier,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastCrawledAt: row.last_crawled_at,
    };
}
function createBriefSelect(sqlLimit) {
    return `
    SELECT
      e.id,
      e.title,
      e.jurisdiction_country,
      e.jurisdiction_state,
      e.stage,
      e.age_bracket,
      e.is_under16_applicable,
      e.chili_score,
      e.summary,
      e.source_id,
      s.name AS source_name,
      s.url AS source_url,
      s.reliability_tier AS source_reliability_tier,
      e.updated_at,
      e.created_at,
      e.last_crawled_at,
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
function parseSourceIds(req) {
    if (!Array.isArray(req.body?.sourceIds)) {
        return undefined;
    }
    const sourceIds = req.body.sourceIds.filter((value) => typeof value === "string");
    return sourceIds.length > 0 ? sourceIds : [];
}
function createApp(db, options = {}) {
    const runIngestion = options.runIngestion ?? ingest_1.runIngestionPipeline;
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use(express_1.default.static(node_path_1.default.join(process.cwd(), "web")));
    app.get("/api/health", (req, res) => {
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            version: "v2",
        });
    });
    app.get("/api/brief", (req, res) => {
        const limit = parsePaging(req.query.limit, defaultBriefLimit, 20);
        const rows = db.prepare(createBriefSelect(limit)).all();
        const items = rows.map((row) => ({
            ...mapEvent(row),
            urgencyScore: stageUrgency[row.stage] ?? 0,
            chiliScore: row.chili_score,
        }));
        res.json({
            generatedAt: new Date().toISOString(),
            lastCrawledAt: (0, db_1.getLastCrawlTime)(db),
            items,
            total: rows.length,
            limit,
        });
    });
    app.get("/api/events", (req, res) => {
        const jurisdiction = typeof req.query.jurisdiction === "string" ? req.query.jurisdiction.trim() : undefined;
        const stageRaw = typeof req.query.stage === "string" ? req.query.stage : undefined;
        const ageBracketRaw = typeof req.query.ageBracket === "string" ? req.query.ageBracket : undefined;
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
        const requestedAgeBrackets = parseAgeBracketList(ageBracketRaw);
        if (ageBracketRaw !== undefined && requestedAgeBrackets.length === 0) {
            return res.status(400).json({ error: "ageBracket must use valid values" });
        }
        const whereClauses = [];
        const params = [];
        if (jurisdiction) {
            whereClauses.push("(e.jurisdiction_country = ? OR e.jurisdiction_state = ?)");
            params.push(jurisdiction, jurisdiction);
        }
        if (requestedStages.length > 0) {
            const placeholders = requestedStages.map(() => "?").join(", ");
            whereClauses.push(`e.stage IN (${placeholders})`);
            params.push(...requestedStages);
        }
        if (requestedAgeBrackets.length > 0) {
            const placeholders = requestedAgeBrackets.map(() => "?").join(", ");
            whereClauses.push(`e.age_bracket IN (${placeholders})`);
            params.push(...requestedAgeBrackets);
        }
        if (minRisk !== undefined) {
            whereClauses.push("e.chili_score >= ?");
            params.push(minRisk);
        }
        const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
        const countRow = db.prepare(`SELECT COUNT(*) AS total FROM regulation_events e ${where}`).get(...params);
        const total = countRow?.total ?? 0;
        const rows = db
            .prepare(`
      SELECT
        e.id,
        e.title,
        e.jurisdiction_country,
        e.jurisdiction_state,
        e.stage,
        e.age_bracket,
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
        e.last_crawled_at,
        s.name AS source_name,
        s.url AS source_url,
        s.reliability_tier AS source_reliability_tier
      FROM regulation_events e
      JOIN sources s ON s.id = e.source_id
      ${where}
      ORDER BY e.updated_at DESC, e.id ASC
      LIMIT ? OFFSET ?
    `)
            .all(...params, limit, offset);
        res.json({
            items: rows.map(mapEvent),
            page,
            limit,
            total,
            lastCrawledAt: (0, db_1.getLastCrawlTime)(db),
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    });
    app.get("/api/events/:id", (req, res) => {
        const { id } = req.params;
        const row = db
            .prepare(`
      SELECT
        e.id,
        e.title,
        e.jurisdiction_country,
        e.jurisdiction_state,
        e.stage,
        e.age_bracket,
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
        e.last_crawled_at,
        s.name AS source_name,
        s.url AS source_url,
        s.reliability_tier AS source_reliability_tier
      FROM regulation_events e
      JOIN sources s ON s.id = e.source_id
      WHERE e.id = ?
    `)
            .get(id);
        if (!row) {
            return res.status(404).json({ error: "event not found" });
        }
        const feedbackRows = db
            .prepare(`
      SELECT id, event_id, rating, note, created_at
      FROM feedback
      WHERE event_id = ?
      ORDER BY created_at DESC, id DESC
      `)
            .all(id);
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
    app.post("/api/events/:id/feedback", (req, res) => {
        const { id } = req.params;
        const body = req.body;
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
    app.post("/api/crawl", async (req, res) => {
        try {
            const sourceIds = parseSourceIds(req);
            const summary = await runIngestion(db, sourceIds ? { sourceIds } : undefined);
            res.json(summary);
        }
        catch (error) {
            console.error("Crawl failed", error);
            const message = error instanceof Error ? error.message : "crawl failed";
            res.status(500).json({ error: message });
        }
    });
    return app;
}
async function runIngestion(db, options) {
    if (options?.sourceIds?.length) {
        return (0, ingest_1.runIngestionPipeline)(db, { sourceIds: options.sourceIds });
    }
    return (0, ingest_1.runIngestionPipeline)(db);
}
//# sourceMappingURL=app.js.map