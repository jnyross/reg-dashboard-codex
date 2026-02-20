import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import DatabaseConstructor from "better-sqlite3";

export const databasePathDefault = path.join(process.cwd(), "data", "reg-regulation-dashboard.sqlite");

export type Stage =
  | "proposed"
  | "introduced"
  | "committee_review"
  | "passed"
  | "enacted"
  | "effective"
  | "amended"
  | "withdrawn"
  | "rejected";

export type AgeBracket = "13-15" | "16-18" | "both";

export type AuthorityType = "national" | "state" | "local" | "supranational";

export type SourceRegistryRow = {
  id: number;
  name: string;
  url: string;
  authority_type: AuthorityType;
  jurisdiction: string;
  reliability_tier: number;
  last_crawled_at: string | null;
  created_at: string;
};

export type RegulationEventDbRow = {
  id: string;
  title: string;
  jurisdiction_country: string;
  jurisdiction_state: string;
  age_bracket: AgeBracket;
  stage: Stage;
  is_under16_applicable: number;
  impact_score: number;
  likelihood_score: number;
  confidence_score: number;
  chili_score: number;
  summary: string | null;
  business_impact: string;
  required_solutions: string; // JSON array
  affected_products: string; // JSON array
  competitor_responses: string; // JSON array
  provenance_links: string; // JSON array
  raw_source_text: string | null;
  effective_date: string | null;
  published_date: string | null;
  source_id: number;
  source_url: string;
  created_at: string;
  updated_at: string;
  last_crawled_at: string | null;
};

export type SourceInput = {
  name: string;
  url: string;
  authorityType: AuthorityType;
  jurisdiction: string;
  reliabilityTier: number;
  lastCrawledAt?: string | null;
};

export type RegulationEventInput = {
  title: string;
  jurisdictionCountry: string;
  jurisdictionState: string | null;
  stage: Stage;
  ageBracket: AgeBracket;
  isUnder16Applicable: boolean;
  impactScore: number;
  likelihoodScore: number;
  confidenceScore: number;
  chiliScore: number;
  summary: string;
  businessImpact: string;
  requiredSolutions: string[];
  affectedMetaProducts: string[];
  competitorResponses: string[];
  rawSourceText: string;
  provenanceLinks: string[];
  effectiveDate: string | null;
  publishedDate: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceJurisdiction: string;
  sourceAuthorityType: AuthorityType;
  sourceReliabilityTier: number;
};

export type UpsertStatus = "created" | "updated" | "status_changed" | "unchanged";

export type UpsertEventResult = {
  id: string;
  status: UpsertStatus;
  wasStatusChange: boolean;
  previousStage: Stage | null;
};

export type CrawlRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  sourcesAttempted: number;
  sourcesSuccess: number;
  sourcesFailed: number;
  itemsDiscovered: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsStatusChanged: number;
  eventsIgnored: number;
};

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
] as const;

const allowedAuthorities = ["national", "state", "local", "supranational"] as const;

export function openDatabase(databasePath = databasePathDefault): DatabaseConstructor.Database {
  if (databasePath !== ":memory:") {
    const directory = path.dirname(databasePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  const db = new DatabaseConstructor(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

function normalizeJurisdictionState(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeScore(value: number): number {
  if (!Number.isInteger(value)) {
    return 1;
  }

  if (value < 1) {
    return 1;
  }

  if (value > 5) {
    return 5;
  }

  return value;
}

function dedupeKey(country: string, state: string, title: string): string {
  const normalized = `${country.toLowerCase()}|${state.toLowerCase()}|${title.toLowerCase()}`;
  return normalized;
}

function deterministicEventId(dedupe: string): string {
  return crypto.createHash("sha1").update(dedupe).digest("hex");
}

export function initializeSchema(db: DatabaseConstructor.Database): void {
  const authorityList = allowedAuthorities.map((a) => `'${a}'`).join(",");
  const stageList = allowedStages.map((s) => `'${s}'`).join(",");
  const reliabilityList = [1, 2, 3, 4, 5].join(",");
  const bracketList = "'13-15','16-18','both'";

  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL UNIQUE,
      authority_type TEXT NOT NULL CHECK (authority_type IN (${authorityList})),
      jurisdiction TEXT NOT NULL,
      reliability_tier INTEGER NOT NULL CHECK (reliability_tier IN (${reliabilityList})),
      last_crawled_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS regulation_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      jurisdiction_country TEXT NOT NULL,
      jurisdiction_state TEXT NOT NULL DEFAULT '',
      age_bracket TEXT NOT NULL CHECK (age_bracket IN (${bracketList})),
      stage TEXT NOT NULL CHECK (stage IN (${stageList})),
      is_under16_applicable INTEGER NOT NULL CHECK (is_under16_applicable IN (0,1)),
      impact_score INTEGER NOT NULL CHECK (impact_score BETWEEN 1 AND 5),
      likelihood_score INTEGER NOT NULL CHECK (likelihood_score BETWEEN 1 AND 5),
      confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 1 AND 5),
      chili_score INTEGER NOT NULL CHECK (chili_score BETWEEN 1 AND 5),
      summary TEXT,
      business_impact TEXT NOT NULL,
      required_solutions TEXT NOT NULL,
      affected_products TEXT NOT NULL,
      competitor_responses TEXT NOT NULL,
      raw_source_text TEXT,
      provenance_links TEXT NOT NULL,
      effective_date TEXT,
      published_date TEXT,
      source_id INTEGER NOT NULL,
      source_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_crawled_at TEXT,
      FOREIGN KEY (source_id) REFERENCES sources (id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS regulation_event_status_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      previous_stage TEXT NOT NULL,
      new_stage TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES regulation_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      rating TEXT NOT NULL CHECK (rating IN ('good', 'bad')),
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES regulation_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      note TEXT NOT NULL,
      author TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES regulation_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digest_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
      min_risk INTEGER NOT NULL CHECK (min_risk BETWEEN 1 AND 5),
      enabled INTEGER NOT NULL CHECK (enabled IN (0,1)) DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      min_risk INTEGER NOT NULL CHECK (min_risk BETWEEN 1 AND 5),
      secret TEXT,
      enabled INTEGER NOT NULL CHECK (enabled IN (0,1)) DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crawl_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      sources_attempted INTEGER NOT NULL,
      sources_success INTEGER NOT NULL,
      sources_failed INTEGER NOT NULL,
      items_discovered INTEGER NOT NULL,
      events_created INTEGER NOT NULL,
      events_updated INTEGER NOT NULL,
      events_status_changed INTEGER NOT NULL,
      events_ignored INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_regulation_events_stage
      ON regulation_events(stage);
    CREATE INDEX IF NOT EXISTS idx_regulation_events_jurisdiction_country
      ON regulation_events(jurisdiction_country);
    CREATE INDEX IF NOT EXISTS idx_regulation_events_jurisdiction_state
      ON regulation_events(jurisdiction_state);
    CREATE INDEX IF NOT EXISTS idx_feedback_event_id
      ON feedback(event_id);
    CREATE INDEX IF NOT EXISTS idx_event_annotations_event_id
      ON event_annotations(event_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_regulation_events_dedupe
      ON regulation_events(jurisdiction_country, jurisdiction_state, source_url, title);
    CREATE INDEX IF NOT EXISTS idx_status_changes_event_id
      ON regulation_event_status_changes(event_id);
    CREATE INDEX IF NOT EXISTS idx_crawl_runs_finished_at
      ON crawl_runs(finished_at);
  `);
}

export function upsertSource(db: DatabaseConstructor.Database, source: SourceInput): number {
  const statement = db.prepare(`
    INSERT INTO sources (name, url, authority_type, jurisdiction, reliability_tier, last_crawled_at, created_at)
    VALUES (@name, @url, @authorityType, @jurisdiction, @reliabilityTier, @lastCrawledAt, @createdAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      authority_type = excluded.authority_type,
      jurisdiction = excluded.jurisdiction,
      reliability_tier = excluded.reliability_tier,
      last_crawled_at = excluded.last_crawled_at,
      created_at = COALESCE(sources.created_at, excluded.created_at)
  `);

  const timestamp = source.lastCrawledAt ?? new Date().toISOString();
  statement.run({
    name: source.name,
    url: source.url,
    authorityType: source.authorityType,
    jurisdiction: source.jurisdiction,
    reliabilityTier: source.reliabilityTier,
    lastCrawledAt: timestamp,
    createdAt: timestamp,
  });

  const row = db.prepare("SELECT id FROM sources WHERE url = ?").get(source.url) as { id: number };
  return row.id;
}

export function getSourceByUrl(db: DatabaseConstructor.Database, url: string): SourceRegistryRow | undefined {
  return db.prepare("SELECT * FROM sources WHERE url = ?").get(url) as SourceRegistryRow | undefined;
}

export function getLastCrawlTime(db: DatabaseConstructor.Database): string | null {
  const row = db.prepare("SELECT MAX(finished_at) AS lastCrawledAt FROM crawl_runs").get() as {
    lastCrawledAt: string | null;
  };
  return row?.lastCrawledAt ?? null;
}

function stringifyJsonArray(values: unknown[]): string {
  return JSON.stringify(values);
}

function extractStage(row: string | number | undefined): Stage {
  const candidate = typeof row === "string" ? row : "proposed";
  return (allowedStages as readonly string[]).includes(candidate) ? (candidate as Stage) : "proposed";
}

export function upsertRegulationEvent(db: DatabaseConstructor.Database, event: RegulationEventInput): UpsertEventResult {
  const now = new Date().toISOString();
  const state = normalizeJurisdictionState(event.jurisdictionState);
  const country = event.jurisdictionCountry.trim() || "Unknown";
  const sourceId = upsertSource(db, {
    name: event.sourceName,
    url: event.sourceUrl,
    authorityType: event.sourceAuthorityType,
    jurisdiction: event.sourceJurisdiction,
    reliabilityTier: event.sourceReliabilityTier,
    lastCrawledAt: now,
  });

  const existing = db
    .prepare(
      `
      SELECT
        id,
        stage,
        updated_at,
        age_bracket,
        is_under16_applicable,
        impact_score,
        likelihood_score,
        confidence_score,
        chili_score,
        summary,
        business_impact,
        required_solutions,
        affected_products,
        competitor_responses,
        raw_source_text,
        provenance_links,
        effective_date,
        published_date
      FROM regulation_events
      WHERE jurisdiction_country = ?
        AND jurisdiction_state = ?
        AND lower(title) = lower(?)
      ORDER BY updated_at DESC
      LIMIT 1
      `,
    )
    .get(country, state, event.title) as RegulationEventDbRow | undefined;

  const eventId = deterministicEventId(dedupeKey(country, state, event.title));

  const normalized: RegulationEventInput = {
    ...event,
    stage: event.stage,
    impactScore: normalizeScore(event.impactScore),
    likelihoodScore: normalizeScore(event.likelihoodScore),
    confidenceScore: normalizeScore(event.confidenceScore),
    chiliScore: normalizeScore(event.chiliScore),
    summary: event.summary || `Regulation item: ${event.title}`,
    businessImpact: event.businessImpact || "Unknown",
    requiredSolutions: event.requiredSolutions,
    affectedMetaProducts: event.affectedMetaProducts,
    competitorResponses: event.competitorResponses,
    rawSourceText: event.rawSourceText || "",
    provenanceLinks: event.provenanceLinks,
  };

  if (!existing) {
    db.prepare(
      `
      INSERT INTO regulation_events (
        id, title, jurisdiction_country, jurisdiction_state, age_bracket, stage,
        is_under16_applicable, impact_score, likelihood_score, confidence_score, chili_score,
        summary, business_impact, required_solutions, affected_products, competitor_responses,
        raw_source_text, provenance_links, effective_date, published_date, source_id, source_url, created_at, updated_at, last_crawled_at
      )
      VALUES (
        @id, @title, @jurisdictionCountry, @jurisdictionState, @ageBracket, @stage,
        @isUnder16Applicable, @impactScore, @likelihoodScore, @confidenceScore, @chiliScore,
        @summary, @businessImpact, @requiredSolutions, @affectedProducts, @competitorResponses,
        @rawSourceText, @provenanceLinks, @effectiveDate, @publishedDate, @sourceId,
        @sourceUrl, @now, @now, @now
      )
    `,
    ).run({
      id: eventId,
      title: normalized.title,
      jurisdictionCountry: country,
      jurisdictionState: state,
      ageBracket: normalized.ageBracket,
      stage: normalized.stage,
      isUnder16Applicable: normalized.isUnder16Applicable ? 1 : 0,
      impactScore: normalized.impactScore,
      likelihoodScore: normalized.likelihoodScore,
      confidenceScore: normalized.confidenceScore,
      chiliScore: normalized.chiliScore,
      summary: normalized.summary,
      businessImpact: normalized.businessImpact,
      requiredSolutions: stringifyJsonArray(normalized.requiredSolutions),
      affectedProducts: stringifyJsonArray(normalized.affectedMetaProducts),
      competitorResponses: stringifyJsonArray(normalized.competitorResponses),
      rawSourceText: normalized.rawSourceText,
      provenanceLinks: stringifyJsonArray(normalized.provenanceLinks),
      effectiveDate: normalized.effectiveDate,
      publishedDate: normalized.publishedDate,
      sourceId,
      sourceUrl: event.sourceUrl,
      now,
    });

    return { id: eventId, status: "created", wasStatusChange: false, previousStage: null };
  }

  const wasStatusChange = existing.stage !== normalized.stage;
  const hasChanges =
    wasStatusChange ||
    existing.age_bracket !== normalized.ageBracket ||
    existing.impact_score !== normalized.impactScore ||
    existing.likelihood_score !== normalized.likelihoodScore ||
    existing.confidence_score !== normalized.confidenceScore ||
    existing.chili_score !== normalized.chiliScore ||
    (existing.summary ?? "") !== normalized.summary ||
    existing.business_impact !== normalized.businessImpact ||
    existing.required_solutions !== stringifyJsonArray(normalized.requiredSolutions) ||
    existing.affected_products !== stringifyJsonArray(normalized.affectedMetaProducts) ||
    existing.competitor_responses !== stringifyJsonArray(normalized.competitorResponses) ||
    existing.raw_source_text !== normalized.rawSourceText ||
    existing.provenance_links !== stringifyJsonArray(normalized.provenanceLinks);

  const previousStage = extractStage(existing.stage);

  if (!hasChanges) {
    db.prepare("UPDATE regulation_events SET last_crawled_at = ?, updated_at = ? WHERE id = ?").run(now, now, existing.id);
    return { id: existing.id, status: "unchanged", wasStatusChange, previousStage };
  }

  const status = wasStatusChange ? "status_changed" : "updated";
  db.prepare(
    `
    UPDATE regulation_events
    SET stage = @stage,
        age_bracket = @ageBracket,
        is_under16_applicable = @isUnder16Applicable,
        impact_score = @impactScore,
        likelihood_score = @likelihoodScore,
        confidence_score = @confidenceScore,
        chili_score = @chiliScore,
        summary = @summary,
        business_impact = @businessImpact,
        required_solutions = @requiredSolutions,
        affected_products = @affectedProducts,
        competitor_responses = @competitorResponses,
        raw_source_text = @rawSourceText,
        provenance_links = @provenanceLinks,
        effective_date = @effectiveDate,
        published_date = @publishedDate,
        updated_at = @updatedAt,
        last_crawled_at = @updatedAt
    WHERE id = @id
  `,
  ).run({
    id: existing.id,
    stage: normalized.stage,
    ageBracket: normalized.ageBracket,
    isUnder16Applicable: normalized.isUnder16Applicable ? 1 : 0,
    impactScore: normalized.impactScore,
    likelihoodScore: normalized.likelihoodScore,
    confidenceScore: normalized.confidenceScore,
    chiliScore: normalized.chiliScore,
    summary: normalized.summary,
    businessImpact: normalized.businessImpact,
    requiredSolutions: stringifyJsonArray(normalized.requiredSolutions),
    affectedProducts: stringifyJsonArray(normalized.affectedMetaProducts),
    competitorResponses: stringifyJsonArray(normalized.competitorResponses),
    rawSourceText: normalized.rawSourceText,
    provenanceLinks: stringifyJsonArray(normalized.provenanceLinks),
    effectiveDate: normalized.effectiveDate,
    publishedDate: normalized.publishedDate,
    updatedAt: now,
  });

  if (wasStatusChange) {
    db.prepare(
      "INSERT INTO regulation_event_status_changes (event_id, previous_stage, new_stage, changed_at) VALUES (?, ?, ?, ?)",
    ).run(existing.id, previousStage, normalized.stage, now);
  }

  return { id: existing.id, status, wasStatusChange, previousStage };
}

export function createCrawlRun(db: DatabaseConstructor.Database): number {
  const now = new Date().toISOString();
  const result = db
    .prepare(`
    INSERT INTO crawl_runs (
      started_at,
      status,
      sources_attempted,
      sources_success,
      sources_failed,
      items_discovered,
      events_created,
      events_updated,
      events_status_changed,
      events_ignored
    ) VALUES (?, 'running', 0, 0, 0, 0, 0, 0, 0, 0)
  `)
    .run(now);

  return Number(result.lastInsertRowid);
}

export function finalizeCrawlRun(
  db: DatabaseConstructor.Database,
  runId: number,
  values: {
    status: "completed" | "partial" | "failed";
    sourcesAttempted: number;
    sourcesSuccess: number;
    sourcesFailed: number;
    itemsDiscovered: number;
    eventsCreated: number;
    eventsUpdated: number;
    eventsStatusChanged: number;
    eventsIgnored: number;
  },
): void {
  const now = new Date().toISOString();
  const run = db.prepare(
    `
    UPDATE crawl_runs
    SET finished_at = ?,
        status = ?,
        sources_attempted = ?,
        sources_success = ?,
        sources_failed = ?,
        items_discovered = ?,
        events_created = ?,
        events_updated = ?,
        events_status_changed = ?,
        events_ignored = ?
    WHERE id = ?
  `,
  ).run(
    now,
    values.status,
    values.sourcesAttempted,
    values.sourcesSuccess,
    values.sourcesFailed,
    values.itemsDiscovered,
    values.eventsCreated,
    values.eventsUpdated,
    values.eventsStatusChanged,
    values.eventsIgnored,
    runId,
  );
}

export function getEventStatusChangeCount(db: DatabaseConstructor.Database, eventId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM regulation_event_status_changes WHERE event_id = ?")
    .get(eventId) as { count: number };

  return row?.count ?? 0;
}

export function listEventHistory(db: DatabaseConstructor.Database, eventId: string): Array<{ previousStage: Stage; newStage: Stage; changedAt: string }> {
  const rows = db
    .prepare(
      `
      SELECT previous_stage, new_stage, changed_at
      FROM regulation_event_status_changes
      WHERE event_id = ?
      ORDER BY changed_at ASC, id ASC
    `,
    )
    .all(eventId) as Array<{ previous_stage: string; new_stage: string; changed_at: string }>;

  return rows.map((row) => ({
    previousStage: extractStage(row.previous_stage),
    newStage: extractStage(row.new_stage),
    changedAt: row.changed_at,
  }));
}
