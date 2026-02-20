"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const ingest_1 = require("./ingest");
const db_1 = require("./db");
const quality_1 = require("./quality");
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
const allowedRatings = new Set(["good", "bad"]);
const sortableValues = new Set([
    "updated_at",
    "recently_updated",
    "date_desc",
    "date_asc",
    "risk_desc",
    "risk_asc",
    "jurisdiction_asc",
    "jurisdiction_desc",
    "stage_asc",
    "stage_desc",
]);
const defaultBriefLimit = 5;
const baseEventSelect = `
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
    e.business_impact,
    e.required_solutions,
    e.affected_products,
    e.competitor_responses,
    e.provenance_links,
    e.raw_source_text,
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
`;
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
function parseBooleanQuery(value, defaultValue = false) {
    if (value === undefined) {
        return defaultValue;
    }
    const normalized = String(value).trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
}
function parseCsv(value) {
    if (!value) {
        return [];
    }
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function parseStageList(value) {
    const items = parseCsv(value);
    return items.filter((entry) => allowedStages.includes(entry));
}
function parseAgeBracketList(value) {
    const items = parseCsv(value);
    return items.filter((entry) => allowedAgeBrackets.includes(entry));
}
function safeJsonParseArray(value) {
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((entry) => typeof entry === "string")
            .map((entry) => (0, quality_1.cleanText)(entry))
            .filter(Boolean);
    }
    catch {
        return [];
    }
}
function buildSearchBlob(parts) {
    return parts.join(" ").toLowerCase();
}
function mapEvent(row) {
    const cleanedTitle = (0, quality_1.cleanText)(row.title);
    const cleanedSummary = (0, quality_1.cleanSummary)(row.summary) ?? (0, quality_1.cleanSummary)(row.raw_source_text) ?? null;
    const cleanedImpact = (0, quality_1.cleanText)(row.business_impact || "Unknown");
    const requiredSolutions = safeJsonParseArray(row.required_solutions);
    const affectedProducts = safeJsonParseArray(row.affected_products);
    const competitorResponses = safeJsonParseArray(row.competitor_responses);
    const provenanceLinks = safeJsonParseArray(row.provenance_links);
    const lowQuality = (0, quality_1.isLowQualityEvent)({
        title: cleanedTitle,
        summary: cleanedSummary,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
    });
    const searchBlob = buildSearchBlob([
        cleanedTitle,
        cleanedSummary ?? "",
        cleanedImpact,
        row.jurisdiction_country,
        (0, quality_1.normalizeJurisdictionState)(row.jurisdiction_state) ?? "",
        row.stage,
        row.source_name,
        ...requiredSolutions,
        ...affectedProducts,
        ...competitorResponses,
    ]);
    return {
        id: row.id,
        title: (0, quality_1.decodeHtmlEntities)(cleanedTitle),
        jurisdiction: {
            country: (0, quality_1.cleanText)(row.jurisdiction_country),
            state: (0, quality_1.normalizeJurisdictionState)(row.jurisdiction_state),
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
        summary: cleanedSummary,
        businessImpact: cleanedImpact || "Unknown",
        requiredSolutions,
        affectedProducts,
        competitorResponses,
        provenanceLinks,
        effectiveDate: row.effective_date,
        publishedDate: row.published_date,
        source: {
            name: (0, quality_1.cleanText)(row.source_name),
            url: row.source_url,
            reliabilityTier: row.source_reliability_tier,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastCrawledAt: row.last_crawled_at,
        quality: {
            lowQuality,
        },
        searchBlob,
    };
}
function eventDateForFiltering(event) {
    if (event.publishedDate) {
        return event.publishedDate;
    }
    return event.updatedAt.slice(0, 10);
}
function sortEvents(items, sortBy) {
    const result = [...items];
    const stageIndex = (stage) => allowedStages.indexOf(stage);
    result.sort((a, b) => {
        if (sortBy === "date_asc") {
            return eventDateForFiltering(a).localeCompare(eventDateForFiltering(b));
        }
        if (sortBy === "risk_desc") {
            return b.scores.chili - a.scores.chili || b.updatedAt.localeCompare(a.updatedAt);
        }
        if (sortBy === "risk_asc") {
            return a.scores.chili - b.scores.chili || b.updatedAt.localeCompare(a.updatedAt);
        }
        if (sortBy === "jurisdiction_asc") {
            return (a.jurisdiction.country.localeCompare(b.jurisdiction.country) ||
                b.updatedAt.localeCompare(a.updatedAt));
        }
        if (sortBy === "jurisdiction_desc") {
            return (b.jurisdiction.country.localeCompare(a.jurisdiction.country) ||
                b.updatedAt.localeCompare(a.updatedAt));
        }
        if (sortBy === "stage_asc") {
            return stageIndex(a.stage) - stageIndex(b.stage) || b.updatedAt.localeCompare(a.updatedAt);
        }
        if (sortBy === "stage_desc") {
            return stageIndex(b.stage) - stageIndex(a.stage) || b.updatedAt.localeCompare(a.updatedAt);
        }
        return b.updatedAt.localeCompare(a.updatedAt);
    });
    return result;
}
function parseFiltersFromQuery(query) {
    const jurisdictions = parseCsv(typeof query.jurisdiction === "string" ? query.jurisdiction : undefined);
    const stagesRaw = typeof query.stage === "string" ? query.stage : undefined;
    const ageRaw = typeof query.ageBracket === "string" ? query.ageBracket : undefined;
    const stages = parseStageList(stagesRaw);
    const ageBrackets = parseAgeBracketList(ageRaw);
    const minRisk = parseSingleInt(query.minRisk, 1, 5);
    const maxRisk = parseSingleInt(query.maxRisk, 1, 5);
    if (stagesRaw !== undefined && stages.length === 0) {
        return null;
    }
    if (ageRaw !== undefined && ageBrackets.length === 0) {
        return null;
    }
    if (query.minRisk !== undefined && minRisk === undefined) {
        return null;
    }
    if (query.maxRisk !== undefined && maxRisk === undefined) {
        return null;
    }
    const sortByRaw = typeof query.sortBy === "string" ? query.sortBy.trim() : "updated_at";
    const sortBy = sortableValues.has(sortByRaw) ? sortByRaw : "updated_at";
    const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : undefined;
    const dateFrom = typeof query.dateFrom === "string" ? query.dateFrom.trim() : undefined;
    const dateTo = typeof query.dateTo === "string" ? query.dateTo.trim() : undefined;
    return {
        jurisdictions,
        stages,
        ageBrackets,
        minRisk,
        maxRisk,
        search: search && search.length > 0 ? search : undefined,
        dateFrom: dateFrom && dateFrom.length > 0 ? dateFrom : undefined,
        dateTo: dateTo && dateTo.length > 0 ? dateTo : undefined,
        includeLowQuality: parseBooleanQuery(query.includeLowQuality, false),
        sortBy,
    };
}
function eventMatchesFilters(event, filters) {
    if (!filters.includeLowQuality && event.quality.lowQuality) {
        return false;
    }
    if (filters.jurisdictions.length > 0) {
        const jurisdictionSet = new Set(filters.jurisdictions.map((value) => value.toLowerCase()));
        const country = event.jurisdiction.country.toLowerCase();
        const state = (event.jurisdiction.state ?? "").toLowerCase();
        if (!jurisdictionSet.has(country) && (state.length === 0 || !jurisdictionSet.has(state))) {
            return false;
        }
    }
    if (filters.stages.length > 0 && !filters.stages.includes(event.stage)) {
        return false;
    }
    if (filters.ageBrackets.length > 0 && !filters.ageBrackets.includes(event.ageBracket)) {
        return false;
    }
    if (filters.minRisk !== undefined && event.scores.chili < filters.minRisk) {
        return false;
    }
    if (filters.maxRisk !== undefined && event.scores.chili > filters.maxRisk) {
        return false;
    }
    if (filters.search && !event.searchBlob.includes(filters.search)) {
        return false;
    }
    const dateValue = eventDateForFiltering(event);
    if (filters.dateFrom && dateValue < filters.dateFrom) {
        return false;
    }
    if (filters.dateTo && dateValue > filters.dateTo) {
        return false;
    }
    return true;
}
function listMappedEvents(db) {
    const rows = db
        .prepare(`${baseEventSelect} ORDER BY e.updated_at DESC, e.id ASC`)
        .all();
    return rows.map(mapEvent);
}
function readFilteredEvents(db, filters) {
    const mapped = listMappedEvents(db);
    return sortEvents(mapped.filter((event) => eventMatchesFilters(event, filters)), filters.sortBy);
}
function setPaginationHeaders(req, res, page, limit, total, totalPages) {
    res.setHeader("X-Total-Count", String(total));
    res.setHeader("X-Total-Pages", String(totalPages));
    res.setHeader("X-Page", String(page));
    res.setHeader("X-Limit", String(limit));
    const links = [];
    const append = (targetPage, rel) => {
        const params = new URLSearchParams(req.query);
        params.set("page", String(targetPage));
        params.set("limit", String(limit));
        links.push(`<${req.path}?${params.toString()}>; rel="${rel}"`);
    };
    if (page > 1) {
        append(1, "first");
        append(page - 1, "prev");
    }
    if (page < totalPages) {
        append(page + 1, "next");
        append(totalPages, "last");
    }
    if (links.length > 0) {
        res.setHeader("Link", links.join(", "));
    }
}
function mapPublicEvent(event) {
    return {
        id: event.id,
        title: event.title,
        jurisdiction: event.jurisdiction,
        stage: event.stage,
        ageBracket: event.ageBracket,
        isUnder16Applicable: event.isUnder16Applicable,
        scores: event.scores,
        summary: event.summary,
        businessImpact: event.businessImpact,
        requiredSolutions: event.requiredSolutions,
        affectedProducts: event.affectedProducts,
        competitorResponses: event.competitorResponses,
        provenanceLinks: event.provenanceLinks,
        effectiveDate: event.effectiveDate,
        publishedDate: event.publishedDate,
        source: event.source,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        lastCrawledAt: event.lastCrawledAt,
        quality: event.quality,
    };
}
function getLatestCrawlRun(db) {
    return db
        .prepare(`
      SELECT
        id,
        started_at,
        finished_at,
        status,
        sources_attempted,
        sources_success,
        sources_failed,
        items_discovered,
        events_created,
        events_updated,
        events_status_changed,
        events_ignored
      FROM crawl_runs
      ORDER BY started_at DESC, id DESC
      LIMIT 1
      `)
        .get();
}
function computeSummary(events) {
    const totalEvents = events.length;
    const totalRisk = events.reduce((sum, event) => sum + event.scores.chili, 0);
    const averageRiskScore = totalEvents === 0 ? 0 : Number((totalRisk / totalEvents).toFixed(2));
    const highRiskCount = events.filter((event) => event.scores.chili >= 4).length;
    const jurisdictionMap = new Map();
    for (const event of events) {
        const key = event.jurisdiction.country;
        jurisdictionMap.set(key, (jurisdictionMap.get(key) ?? 0) + 1);
    }
    let topJurisdiction = "—";
    let topJurisdictionCount = 0;
    for (const [country, count] of jurisdictionMap.entries()) {
        if (count > topJurisdictionCount) {
            topJurisdiction = country;
            topJurisdictionCount = count;
        }
    }
    const newestEvent = [...events].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    return {
        totalEvents,
        averageRiskScore,
        highRiskCount,
        topJurisdiction,
        topJurisdictionCount,
        newestEvent: newestEvent
            ? {
                id: newestEvent.id,
                title: newestEvent.title,
                updatedAt: newestEvent.updatedAt,
            }
            : null,
    };
}
function buildTrendSeries(events) {
    const map = new Map();
    for (const event of events) {
        const date = eventDateForFiltering(event);
        const month = date.slice(0, 7);
        const existing = map.get(month) ?? { month, count: 0, highRiskCount: 0, riskTotal: 0 };
        existing.count += 1;
        existing.riskTotal += event.scores.chili;
        if (event.scores.chili >= 4) {
            existing.highRiskCount += 1;
        }
        map.set(month, existing);
    }
    return [...map.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((entry) => ({
        month: entry.month,
        count: entry.count,
        highRiskCount: entry.highRiskCount,
        avgRisk: entry.count === 0 ? 0 : Number((entry.riskTotal / entry.count).toFixed(2)),
    }));
}
function buildRiskDistribution(events) {
    const buckets = [1, 2, 3, 4, 5].map((score) => ({ score, count: 0 }));
    for (const event of events) {
        const index = Math.max(1, Math.min(5, event.scores.chili)) - 1;
        buckets[index].count += 1;
    }
    return buckets;
}
function buildJurisdictionStats(events) {
    const map = new Map();
    for (const event of events) {
        const key = event.jurisdiction.country;
        const current = map.get(key) ?? {
            country: key,
            count: 0,
            riskTotal: 0,
            maxRisk: 0,
            highRiskCount: 0,
        };
        current.count += 1;
        current.riskTotal += event.scores.chili;
        current.maxRisk = Math.max(current.maxRisk, event.scores.chili);
        if (event.scores.chili >= 4) {
            current.highRiskCount += 1;
        }
        map.set(key, current);
    }
    return [...map.values()]
        .map((row) => ({
        country: row.country,
        count: row.count,
        avgRisk: Number((row.riskTotal / Math.max(1, row.count)).toFixed(2)),
        maxRisk: row.maxRisk,
        highRiskCount: row.highRiskCount,
    }))
        .sort((a, b) => b.avgRisk - a.avgRisk || b.count - a.count || a.country.localeCompare(b.country));
}
function buildStageStats(events) {
    const map = new Map();
    for (const event of events) {
        const current = map.get(event.stage) ?? { stage: event.stage, count: 0, riskTotal: 0 };
        current.count += 1;
        current.riskTotal += event.scores.chili;
        map.set(event.stage, current);
    }
    return [...map.values()]
        .map((entry) => ({
        stage: entry.stage,
        count: entry.count,
        avgRisk: Number((entry.riskTotal / Math.max(1, entry.count)).toFixed(2)),
        urgency: stageUrgency[entry.stage],
    }))
        .sort((a, b) => b.urgency - a.urgency);
}
function getEventDetail(db, eventId) {
    const row = db
        .prepare(`${baseEventSelect} WHERE e.id = ?`)
        .get(eventId);
    if (!row) {
        return null;
    }
    const mapped = mapEvent(row);
    const feedbackRows = db
        .prepare(`
      SELECT id, event_id, rating, note, created_at
      FROM feedback
      WHERE event_id = ?
      ORDER BY created_at DESC, id DESC
      `)
        .all(eventId);
    const annotationRows = db
        .prepare(`
      SELECT id, event_id, note, author, created_at
      FROM event_annotations
      WHERE event_id = ?
      ORDER BY created_at DESC, id DESC
      `)
        .all(eventId);
    const relatedRows = db
        .prepare(`${baseEventSelect}
       WHERE e.id <> ?
         AND (e.jurisdiction_country = ? OR e.stage = ?)
       ORDER BY e.chili_score DESC, e.updated_at DESC
       LIMIT 5`)
        .all(eventId, mapped.jurisdiction.country, mapped.stage);
    const relatedEvents = relatedRows.map(mapEvent).filter((event) => !event.quality.lowQuality).map(mapPublicEvent);
    return {
        ...mapPublicEvent(mapped),
        feedback: feedbackRows.map((feedback) => ({
            id: feedback.id,
            eventId: feedback.event_id,
            rating: feedback.rating,
            note: feedback.note,
            createdAt: feedback.created_at,
        })),
        annotations: annotationRows.map((annotation) => ({
            id: annotation.id,
            eventId: annotation.event_id,
            note: annotation.note,
            author: annotation.author,
            createdAt: annotation.created_at,
        })),
        statusHistory: (0, db_1.listEventHistory)(db, eventId),
        relatedEvents,
    };
}
function escapeCsv(value) {
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        return `"${value.replace(/\"/g, '""')}"`;
    }
    return value;
}
function toCsv(events) {
    const headers = [
        "id",
        "title",
        "jurisdiction_country",
        "jurisdiction_state",
        "stage",
        "age_bracket",
        "is_under16_applicable",
        "chili_score",
        "impact_score",
        "likelihood_score",
        "confidence_score",
        "published_date",
        "effective_date",
        "updated_at",
        "source_name",
        "source_url",
        "summary",
        "business_impact",
    ];
    const lines = [headers.join(",")];
    for (const event of events) {
        const row = [
            event.id,
            event.title,
            event.jurisdiction.country,
            event.jurisdiction.state ?? "",
            event.stage,
            event.ageBracket,
            event.isUnder16Applicable ? "1" : "0",
            String(event.scores.chili),
            String(event.scores.impact),
            String(event.scores.likelihood),
            String(event.scores.confidence),
            event.publishedDate ?? "",
            event.effectiveDate ?? "",
            event.updatedAt,
            event.source.name,
            event.source.url,
            event.summary ?? "",
            event.businessImpact,
        ].map(escapeCsv);
        lines.push(row.join(","));
    }
    return lines.join("\n");
}
function createPdfBuffer(params) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ size: "A4", margin: 48 });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("error", reject);
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.fontSize(20).text(params.title, { align: "left" });
        doc.moveDown(0.25);
        doc.fontSize(11).fillColor("#555").text(params.subtitle);
        doc.fillColor("#111");
        doc.moveDown(1);
        doc.fontSize(13).text("Executive Summary", { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(10).text(`Total events: ${params.summary.totalEvents}`);
        doc.text(`Average risk score: ${params.summary.averageRiskScore}/5`);
        doc.text(`High-risk events (4-5🌶️): ${params.summary.highRiskCount}`);
        doc.text(`Top jurisdiction: ${params.summary.topJurisdiction} (${params.summary.topJurisdictionCount})`);
        doc.moveDown(1);
        doc.fontSize(13).text("Top Events", { underline: true });
        doc.moveDown(0.4);
        const topEvents = params.events.slice(0, 20);
        for (const [index, event] of topEvents.entries()) {
            doc.fontSize(10).fillColor("#111").text(`${index + 1}. ${event.title}`, { continued: false });
            doc.fontSize(9).fillColor("#444").text(`   ${event.jurisdiction.country}${event.jurisdiction.state ? ` (${event.jurisdiction.state})` : ""} • ${event.stage} • ${event.scores.chili}/5`);
            if (event.summary) {
                doc.fontSize(8.5).fillColor("#666").text(`   ${event.summary.slice(0, 240)}`);
            }
            doc.moveDown(0.3);
            if (doc.y > 720) {
                doc.addPage();
            }
        }
        doc.end();
    });
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
    app.use((req, res, next) => {
        res.setHeader("Access-Control-Expose-Headers", "X-Total-Count,X-Total-Pages,X-Page,X-Limit,Link");
        next();
    });
    app.use(express_1.default.static(node_path_1.default.join(process.cwd(), "web")));
    app.get("/api/health", (req, res) => {
        const quality = listMappedEvents(db).reduce((acc, event) => {
            if (event.quality.lowQuality) {
                acc.lowQuality += 1;
            }
            else {
                acc.productionQuality += 1;
            }
            return acc;
        }, { productionQuality: 0, lowQuality: 0 });
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            version: "v3",
            lastCrawledAt: (0, db_1.getLastCrawlTime)(db),
            quality,
        });
    });
    app.get("/api/crawl/status", (req, res) => {
        const lastRun = getLatestCrawlRun(db);
        const mapped = listMappedEvents(db);
        const productionQualityCount = mapped.filter((event) => !event.quality.lowQuality).length;
        if (!lastRun) {
            return res.json({
                status: "never_run",
                lastCrawledAt: (0, db_1.getLastCrawlTime)(db),
                totalEvents: productionQualityCount,
                excludedLowQuality: mapped.length - productionQualityCount,
                lastRun: null,
            });
        }
        return res.json({
            status: lastRun.status,
            runId: lastRun.id,
            startedAt: lastRun.started_at,
            finishedAt: lastRun.finished_at,
            lastCrawledAt: lastRun.finished_at ?? (0, db_1.getLastCrawlTime)(db),
            totalEvents: productionQualityCount,
            excludedLowQuality: mapped.length - productionQualityCount,
            lastRun: {
                id: lastRun.id,
                status: lastRun.status,
                startedAt: lastRun.started_at,
                finishedAt: lastRun.finished_at,
                sourcesAttempted: lastRun.sources_attempted,
                sourcesSuccess: lastRun.sources_success,
                sourcesFailed: lastRun.sources_failed,
                itemsDiscovered: lastRun.items_discovered,
                eventsCreated: lastRun.events_created,
                eventsUpdated: lastRun.events_updated,
                eventsStatusChanged: lastRun.events_status_changed,
                eventsIgnored: lastRun.events_ignored,
            },
        });
    });
    app.get("/api/brief", (req, res) => {
        const limit = parsePaging(req.query.limit, defaultBriefLimit, 20);
        const includeLowQuality = parseBooleanQuery(req.query.includeLowQuality, false);
        const all = listMappedEvents(db)
            .filter((event) => includeLowQuality || !event.quality.lowQuality)
            .sort((a, b) => {
            const urgencyA = stageUrgency[a.stage] ?? 0;
            const urgencyB = stageUrgency[b.stage] ?? 0;
            return b.scores.chili - a.scores.chili || urgencyB - urgencyA || b.updatedAt.localeCompare(a.updatedAt);
        })
            .slice(0, limit);
        const items = all.map((event) => ({
            ...mapPublicEvent(event),
            urgencyScore: stageUrgency[event.stage],
            chiliScore: event.scores.chili,
        }));
        res.json({
            generatedAt: new Date().toISOString(),
            lastCrawledAt: (0, db_1.getLastCrawlTime)(db),
            items,
            total: items.length,
            limit,
        });
    });
    app.get("/api/events", (req, res) => {
        const parsedFilters = parseFiltersFromQuery(req.query);
        if (!parsedFilters) {
            return res.status(400).json({ error: "Invalid filter values supplied" });
        }
        const page = parsePaging(req.query.page, 1);
        const limit = parsePaging(req.query.limit, 15, 200);
        const filtered = readFilteredEvents(db, parsedFilters);
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);
        const offset = (safePage - 1) * limit;
        const items = filtered.slice(offset, offset + limit).map(mapPublicEvent);
        setPaginationHeaders(req, res, safePage, limit, total, totalPages);
        res.json({
            items,
            page: safePage,
            limit,
            total,
            totalPages,
            lastCrawledAt: (0, db_1.getLastCrawlTime)(db),
        });
    });
    app.patch("/api/events/:id", (req, res) => {
        const { id } = req.params;
        const existing = db.prepare("SELECT stage FROM regulation_events WHERE id = ?").get(id);
        if (!existing) {
            return res.status(404).json({ error: "event not found" });
        }
        const body = req.body;
        const updateClauses = [];
        const values = [];
        if (typeof body.title === "string" && body.title.trim()) {
            updateClauses.push("title = ?");
            values.push((0, quality_1.cleanText)(body.title));
        }
        if (typeof body.summary === "string") {
            updateClauses.push("summary = ?");
            values.push((0, quality_1.cleanSummary)(body.summary) ?? null);
        }
        if (typeof body.businessImpact === "string" && body.businessImpact.trim()) {
            updateClauses.push("business_impact = ?");
            values.push((0, quality_1.cleanText)(body.businessImpact));
        }
        if (typeof body.jurisdictionCountry === "string" && body.jurisdictionCountry.trim()) {
            updateClauses.push("jurisdiction_country = ?");
            values.push((0, quality_1.cleanText)(body.jurisdictionCountry));
        }
        if (typeof body.jurisdictionState === "string" || body.jurisdictionState === null) {
            updateClauses.push("jurisdiction_state = ?");
            values.push(body.jurisdictionState ? (0, quality_1.cleanText)(String(body.jurisdictionState)) : "");
        }
        if (typeof body.stage === "string") {
            const stage = body.stage;
            if (!allowedStages.includes(stage)) {
                return res.status(400).json({ error: "Invalid stage" });
            }
            updateClauses.push("stage = ?");
            values.push(stage);
        }
        if (typeof body.ageBracket === "string") {
            const ageBracket = body.ageBracket;
            if (!allowedAgeBrackets.includes(ageBracket)) {
                return res.status(400).json({ error: "Invalid ageBracket" });
            }
            updateClauses.push("age_bracket = ?");
            values.push(ageBracket);
        }
        if (typeof body.isUnder16Applicable === "boolean") {
            updateClauses.push("is_under16_applicable = ?");
            values.push(body.isUnder16Applicable ? 1 : 0);
        }
        const impactScore = parseSingleInt(body.impactScore, 1, 5);
        if (body.impactScore !== undefined) {
            if (impactScore === undefined) {
                return res.status(400).json({ error: "impactScore must be an integer between 1 and 5" });
            }
            updateClauses.push("impact_score = ?");
            values.push(impactScore);
        }
        const likelihoodScore = parseSingleInt(body.likelihoodScore, 1, 5);
        if (body.likelihoodScore !== undefined) {
            if (likelihoodScore === undefined) {
                return res.status(400).json({ error: "likelihoodScore must be an integer between 1 and 5" });
            }
            updateClauses.push("likelihood_score = ?");
            values.push(likelihoodScore);
        }
        const confidenceScore = parseSingleInt(body.confidenceScore, 1, 5);
        if (body.confidenceScore !== undefined) {
            if (confidenceScore === undefined) {
                return res.status(400).json({ error: "confidenceScore must be an integer between 1 and 5" });
            }
            updateClauses.push("confidence_score = ?");
            values.push(confidenceScore);
        }
        const chiliScore = parseSingleInt(body.chiliScore, 1, 5);
        if (body.chiliScore !== undefined) {
            if (chiliScore === undefined) {
                return res.status(400).json({ error: "chiliScore must be an integer between 1 and 5" });
            }
            updateClauses.push("chili_score = ?");
            values.push(chiliScore);
        }
        if (typeof body.effectiveDate === "string" || body.effectiveDate === null) {
            updateClauses.push("effective_date = ?");
            values.push(body.effectiveDate ? String(body.effectiveDate) : null);
        }
        if (typeof body.publishedDate === "string" || body.publishedDate === null) {
            updateClauses.push("published_date = ?");
            values.push(body.publishedDate ? String(body.publishedDate) : null);
        }
        const annotationNote = typeof body.annotation === "string" ? body.annotation.trim() : "";
        const annotationAuthor = typeof body.author === "string" ? body.author.trim() : null;
        if (updateClauses.length === 0 && !annotationNote) {
            return res.status(400).json({ error: "No editable fields provided" });
        }
        const now = new Date().toISOString();
        if (updateClauses.length > 0) {
            updateClauses.push("updated_at = ?");
            values.push(now);
            values.push(id);
            db.prepare(`UPDATE regulation_events SET ${updateClauses.join(", ")} WHERE id = ?`).run(...values);
            if (typeof body.stage === "string" && body.stage !== existing.stage) {
                db.prepare("INSERT INTO regulation_event_status_changes (event_id, previous_stage, new_stage, changed_at) VALUES (?, ?, ?, ?)").run(id, existing.stage, body.stage, now);
            }
        }
        if (annotationNote) {
            db.prepare("INSERT INTO event_annotations (event_id, note, author, created_at) VALUES (?, ?, ?, ?)").run(id, annotationNote, annotationAuthor, now);
        }
        const detail = getEventDetail(db, id);
        return res.json(detail);
    });
    app.get("/api/events/:id", (req, res) => {
        const detail = getEventDetail(db, req.params.id);
        if (!detail) {
            return res.status(404).json({ error: "event not found" });
        }
        return res.json(detail);
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
        return res.status(201).json({
            id: result.lastInsertRowid,
            eventId: id,
            rating,
            note: note ?? null,
            createdAt,
        });
    });
    app.get("/api/jurisdictions", (req, res) => {
        const filters = parseFiltersFromQuery(req.query) ?? {
            jurisdictions: [],
            stages: [],
            ageBrackets: [],
            includeLowQuality: false,
            sortBy: "jurisdiction_asc",
        };
        const events = readFilteredEvents(db, {
            ...filters,
            sortBy: "jurisdiction_asc",
        });
        const countries = [...new Set(events.map((event) => event.jurisdiction.country))].sort((a, b) => a.localeCompare(b));
        res.json({ countries, total: countries.length });
    });
    app.get("/api/analytics/summary", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        res.json({
            ...computeSummary(events),
            lastCrawledAt: (0, db_1.getLastCrawlTime)(db),
        });
    });
    app.get("/api/analytics/trends", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        res.json({ trends: buildTrendSeries(events) });
    });
    app.get("/api/analytics/risk-distribution", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        res.json({ distribution: buildRiskDistribution(events) });
    });
    app.get("/api/analytics/jurisdictions", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        res.json({ jurisdictions: buildJurisdictionStats(events) });
    });
    app.get("/api/analytics/stages", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        res.json({ stages: buildStageStats(events) });
    });
    app.get("/api/analytics/pipeline", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        const stages = buildStageStats(events);
        res.json({
            pipeline: stages.map((stage, index) => ({
                stage: stage.stage,
                count: stage.count,
                nextStage: stages[index + 1]?.stage ?? null,
            })),
        });
    });
    app.get("/api/export/csv", (req, res) => {
        const parsedFilters = parseFiltersFromQuery(req.query) ?? {
            jurisdictions: [],
            stages: [],
            ageBrackets: [],
            includeLowQuality: false,
            sortBy: "updated_at",
        };
        const events = readFilteredEvents(db, parsedFilters);
        const csv = toCsv(events);
        const stamp = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=codex-events-${stamp}.csv`);
        res.send(csv);
    });
    app.get("/api/export/pdf", async (req, res) => {
        const parsedFilters = parseFiltersFromQuery(req.query) ?? {
            jurisdictions: [],
            stages: [],
            ageBrackets: [],
            includeLowQuality: false,
            sortBy: "risk_desc",
        };
        const events = readFilteredEvents(db, parsedFilters);
        const summary = computeSummary(events);
        const stamp = new Date().toISOString().slice(0, 10);
        try {
            const pdfBuffer = await createPdfBuffer({
                title: "CODEX Regulatory Intelligence Executive Brief",
                subtitle: `Generated ${new Date().toISOString()}`,
                summary,
                events,
            });
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=codex-executive-brief-${stamp}.pdf`);
            res.send(pdfBuffer);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Failed to generate PDF";
            res.status(500).json({ error: message });
        }
    });
    app.get("/api/reports/executive", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        res.json({
            generatedAt: new Date().toISOString(),
            summary: computeSummary(events),
            topEvents: sortEvents(events, "risk_desc").slice(0, 10).map(mapPublicEvent),
            trends: buildTrendSeries(events).slice(-6),
        });
    });
    app.get("/api/reports/trends", (req, res) => {
        const events = listMappedEvents(db).filter((event) => !event.quality.lowQuality);
        res.json({
            generatedAt: new Date().toISOString(),
            trends: buildTrendSeries(events),
            stages: buildStageStats(events),
            jurisdictions: buildJurisdictionStats(events).slice(0, 10),
        });
    });
    app.get("/api/reports/jurisdiction/:country", (req, res) => {
        const country = req.params.country.trim().toLowerCase();
        const events = listMappedEvents(db)
            .filter((event) => !event.quality.lowQuality)
            .filter((event) => event.jurisdiction.country.toLowerCase() === country);
        res.json({
            generatedAt: new Date().toISOString(),
            jurisdiction: req.params.country,
            summary: computeSummary(events),
            events: sortEvents(events, "risk_desc").map(mapPublicEvent),
        });
    });
    app.get("/api/alerts/high-risk", (req, res) => {
        const minRisk = parseSingleInt(req.query.minRisk, 1, 5) ?? 4;
        const since = typeof req.query.since === "string" ? req.query.since : null;
        const events = listMappedEvents(db)
            .filter((event) => !event.quality.lowQuality)
            .filter((event) => event.scores.chili >= minRisk)
            .filter((event) => (since ? event.updatedAt >= since : true))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(mapPublicEvent);
        res.json({
            generatedAt: new Date().toISOString(),
            minRisk,
            since,
            count: events.length,
            items: events,
        });
    });
    app.get("/api/saved-searches", (req, res) => {
        const rows = db
            .prepare("SELECT id, name, filters_json, created_at, updated_at FROM saved_searches ORDER BY updated_at DESC, id DESC")
            .all();
        res.json({
            items: rows.map((row) => ({
                id: row.id,
                name: row.name,
                filters: (() => {
                    try {
                        return JSON.parse(row.filters_json);
                    }
                    catch {
                        return {};
                    }
                })(),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })),
        });
    });
    app.post("/api/saved-searches", (req, res) => {
        const body = req.body;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }
        if (!body.filters || typeof body.filters !== "object") {
            return res.status(400).json({ error: "filters object is required" });
        }
        const now = new Date().toISOString();
        const result = db
            .prepare("INSERT INTO saved_searches (name, filters_json, created_at, updated_at) VALUES (?, ?, ?, ?)")
            .run(name, JSON.stringify(body.filters), now, now);
        return res.status(201).json({
            id: Number(result.lastInsertRowid),
            name,
            filters: body.filters,
            createdAt: now,
            updatedAt: now,
        });
    });
    app.delete("/api/saved-searches/:id", (req, res) => {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "invalid saved search id" });
        }
        const result = db.prepare("DELETE FROM saved_searches WHERE id = ?").run(id);
        if (result.changes === 0) {
            return res.status(404).json({ error: "saved search not found" });
        }
        return res.status(204).send();
    });
    app.get("/api/digest/config", (req, res) => {
        const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
        if (!email) {
            return res.status(400).json({ error: "email query parameter is required" });
        }
        const row = db
            .prepare("SELECT id, email, frequency, min_risk, enabled, created_at, updated_at FROM digest_configs WHERE email = ?")
            .get(email);
        if (!row) {
            return res.json({ config: null });
        }
        return res.json({
            config: {
                id: row.id,
                email: row.email,
                frequency: row.frequency,
                minRisk: row.min_risk,
                enabled: Boolean(row.enabled),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            },
        });
    });
    app.post("/api/digest/config", (req, res) => {
        const body = req.body;
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const frequency = typeof body.frequency === "string" ? body.frequency.trim().toLowerCase() : "daily";
        const minRisk = parseSingleInt(body.minRisk, 1, 5) ?? 4;
        const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return res.status(400).json({ error: "valid email is required" });
        }
        if (frequency !== "daily" && frequency !== "weekly") {
            return res.status(400).json({ error: "frequency must be daily or weekly" });
        }
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO digest_configs (email, frequency, min_risk, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        frequency = excluded.frequency,
        min_risk = excluded.min_risk,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
      `).run(email, frequency, minRisk, enabled ? 1 : 0, now, now);
        return res.json({
            email,
            frequency,
            minRisk,
            enabled,
            updatedAt: now,
        });
    });
    app.get("/api/digest/preview", (req, res) => {
        const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
        if (!email) {
            return res.status(400).json({ error: "email query parameter is required" });
        }
        const config = db
            .prepare("SELECT id, email, frequency, min_risk, enabled, created_at, updated_at FROM digest_configs WHERE email = ?")
            .get(email);
        if (!config || config.enabled === 0) {
            return res.json({
                email,
                enabled: false,
                items: [],
                message: "Digest disabled or not configured",
            });
        }
        const events = listMappedEvents(db)
            .filter((event) => !event.quality.lowQuality)
            .filter((event) => event.scores.chili >= config.min_risk)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 15)
            .map(mapPublicEvent);
        return res.json({
            email,
            enabled: true,
            frequency: config.frequency,
            minRisk: config.min_risk,
            generatedAt: new Date().toISOString(),
            items: events,
        });
    });
    app.get("/api/webhooks", (req, res) => {
        const rows = db
            .prepare("SELECT id, url, min_risk, secret, enabled, created_at, updated_at FROM webhook_subscriptions ORDER BY updated_at DESC, id DESC")
            .all();
        res.json({
            items: rows.map((row) => ({
                id: row.id,
                url: row.url,
                minRisk: row.min_risk,
                hasSecret: Boolean(row.secret),
                enabled: Boolean(row.enabled),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })),
        });
    });
    app.post("/api/webhooks", (req, res) => {
        const body = req.body;
        const url = typeof body.url === "string" ? body.url.trim() : "";
        const minRisk = parseSingleInt(body.minRisk, 1, 5) ?? 4;
        const secret = typeof body.secret === "string" ? body.secret.trim() : null;
        const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
        if (!url) {
            return res.status(400).json({ error: "url is required" });
        }
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        }
        catch {
            return res.status(400).json({ error: "url must be valid" });
        }
        if (!(parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:")) {
            return res.status(400).json({ error: "url must use http or https" });
        }
        const now = new Date().toISOString();
        db.prepare(`
      INSERT INTO webhook_subscriptions (url, min_risk, secret, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        min_risk = excluded.min_risk,
        secret = excluded.secret,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
      `).run(url, minRisk, secret, enabled ? 1 : 0, now, now);
        return res.status(201).json({
            url,
            minRisk,
            hasSecret: Boolean(secret),
            enabled,
            updatedAt: now,
        });
    });
    app.delete("/api/webhooks/:id", (req, res) => {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "invalid webhook id" });
        }
        const result = db.prepare("DELETE FROM webhook_subscriptions WHERE id = ?").run(id);
        if (result.changes === 0) {
            return res.status(404).json({ error: "webhook not found" });
        }
        return res.status(204).send();
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