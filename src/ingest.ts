import crypto from "node:crypto";
import {
  analyzeCrawledItem,
  AnalyzedItem,
  AnalysisAgeBracket,
} from "./analyzer";
import { sourceRegistry, twitterSearchSources } from "./sources";
import { crawlSources, CrawledItem } from "./crawler";
import {
  createCrawlRun,
  finalizeCrawlRun,
  upsertRegulationEvent,
} from "./db";
import DatabaseConstructor from "better-sqlite3";

export type CrawlTaskOptions = {
  sourceIds?: string[];
};

export type CrawlSummary = {
  runId: number;
  status: "completed" | "partial" | "failed";
  startedAt: string;
  finishedAt: string;
  sourcesAttempted: number;
  sourcesSuccess: number;
  sourcesFailed: number;
  itemsDiscovered: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsStatusChanged: number;
  eventsIgnored: number;
  sourceErrors: Array<{ sourceId: string; message: string }>;
};

const knownCountries = new Set([
  "united states",
  "usa",
  "united kingdom",
  "uk",
  "australia",
  "canada",
  "india",
  "japan",
  "south korea",
  "singapore",
  "brazil",
  "mexico",
  "european union",
  "eu",
  "european union and european economic area",
]);

function normalizeJurisdictionText(value: string): string {
  return value.trim().toLowerCase();
}

function isLikelyCountry(value: string): boolean {
  return knownCountries.has(normalizeJurisdictionText(value));
}

function splitJurisdiction(rawJurisdiction: string): { country: string; state: string | null } {
  const text = rawJurisdiction.trim();
  if (!text) {
    return { country: "Unknown", state: null };
  }

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    const first = parts[0] || "Unknown";
    const last = parts[parts.length - 1] || "Unknown";

    if (isLikelyCountry(last)) {
      return {
        country: last,
        state: parts.slice(0, parts.length - 1).join(", ") || null,
      };
    }

    if (isLikelyCountry(first)) {
      return {
        country: first,
        state: parts.slice(1).join(", ") || null,
      };
    }

    return {
      country: first,
      state: parts.slice(1).join(", "),
    };
  }

  return { country: text, state: null };
}

function mapStage(item: AnalyzedItem): AnalyzedItem["stage"] {
  return item.stage;
}

function mapAgeBracket(ageBracket: AnalysisAgeBracket): "13-15" | "16-18" | "both" {
  return ageBracket;
}

function mapUnder16Applicability(ageBracket: AnalysisAgeBracket): boolean {
  return ageBracket === "13-15" || ageBracket === "16-18" || ageBracket === "both";
}

function normalizeRequiredSolutions(item: AnalyzedItem): string[] {
  return item.requiredSolutions.length > 0 ? item.requiredSolutions : ["Legal review", "Monitoring"];
}

function normalizeCompetitorResponses(item: AnalyzedItem): string[] {
  return item.competitorResponses.length > 0 ? item.competitorResponses : [];
}

function normalizeAffectedProducts(item: AnalyzedItem): string[] {
  if (item.affectedMetaProducts.length > 0) {
    return item.affectedMetaProducts;
  }

  return ["Meta Platforms", "Meta Ads Products"];
}

function sanitizeText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowQualityAnalysis(item: CrawledItem, analysis: AnalyzedItem): boolean {
  const summary = sanitizeText(analysis.summary || "");
  const title = sanitizeText(item.title || "");
  const raw = sanitizeText(item.rawText || "").toLowerCase();

  if (!summary || summary.length < 60) {
    return true;
  }

  if (/no specific regulatory details|source indicates|no details available/i.test(summary)) {
    return true;
  }

  const hasRegulatoryKeyword = /(regulation|law|bill|act|guideline|compliance|enforcement|privacy|online safety|coppa|dsa|osa|kosa)/i.test(
    `${title} ${summary} ${raw}`,
  );

  if (!hasRegulatoryKeyword) {
    return true;
  }

  return false;
}

function estimatePublishedDate(item: CrawledItem): string | null {
  if (!item.publishedAt) {
    return null;
  }

  const parsed = new Date(item.publishedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().split("T")[0];
}

function normalizeForHash(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function hashText(value: string): string {
  return crypto.createHash("sha1").update(normalizeForHash(value)).digest("hex");
}

function buildRegulationKey(item: CrawledItem, analysis: AnalyzedItem): string {
  const jurisdiction = splitJurisdiction(analysis.jurisdiction || item.source.jurisdiction);
  const country = normalizeForHash(jurisdiction.country || "unknown");
  const state = normalizeForHash(jurisdiction.state || "");
  const title = normalizeForHash(item.title || "untitled");
  return `${country}|${state}|${title}`;
}

function buildDeduplicationKey(item: CrawledItem, analysis: AnalyzedItem): string {
  const regulationKey = buildRegulationKey(item, analysis);
  const normalizedUrl = item.url.trim().toLowerCase();
  const textHash = hashText(item.rawText || `${item.title} ${item.summary}`);
  const contentKey = normalizedUrl || `text:${textHash}`;
  return `${regulationKey}::${contentKey}`;
}

async function upsertAnalysedItem(db: DatabaseConstructor.Database, item: CrawledItem, analysis: AnalyzedItem): Promise<
  | "created"
  | "updated"
  | "status_changed"
  | "unchanged"
  | "ignored"
> {
  if (!analysis.isRelevant) {
    return "ignored";
  }

  if (isLowQualityAnalysis(item, analysis)) {
    return "ignored";
  }

  const jurisdiction = splitJurisdiction(analysis.jurisdiction || item.source.jurisdiction);
  const result = upsertRegulationEvent(db, {
    title: sanitizeText(item.title),
    jurisdictionCountry: jurisdiction.country,
    jurisdictionState: jurisdiction.state,
    stage: mapStage(analysis),
    ageBracket: mapAgeBracket(analysis.ageBracket),
    isUnder16Applicable: mapUnder16Applicability(analysis.ageBracket),
    impactScore: analysis.impactScore,
    likelihoodScore: analysis.likelihoodScore,
    confidenceScore: analysis.confidenceScore,
    chiliScore: analysis.chiliScore,
    summary: sanitizeText(analysis.summary),
    businessImpact: sanitizeText(analysis.businessImpact),
    requiredSolutions: normalizeRequiredSolutions(analysis),
    affectedMetaProducts: normalizeAffectedProducts(analysis),
    competitorResponses: normalizeCompetitorResponses(analysis),
    rawSourceText: item.rawText,
    provenanceLinks: item.provenanceLinks,
    effectiveDate: null,
    publishedDate: estimatePublishedDate(item),
    sourceName: item.source.name,
    sourceUrl: item.source.url,
    sourceJurisdiction: item.source.jurisdiction,
    sourceAuthorityType: item.source.authorityType,
    sourceReliabilityTier: item.source.reliabilityTier,
  });

  return result.status;
}

export async function runIngestionPipeline(
  db: DatabaseConstructor.Database,
  options: CrawlTaskOptions = {},
): Promise<CrawlSummary> {
  const allSources = [...sourceRegistry, ...twitterSearchSources];
  const selectedSources = options.sourceIds?.length
    ? allSources.filter((source) => options.sourceIds?.includes(source.id))
    : allSources;

  const runId = createCrawlRun(db);
  const startedAt = new Date().toISOString();
  const sourceErrors: Array<{ sourceId: string; message: string }> = [];
  let sourcesSuccess = 0;
  let sourcesFailed = 0;
  let itemsDiscovered = 0;
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let eventsStatusChanged = 0;
  let eventsIgnored = 0;
  const seenDeduplicationKeys = new Set<string>();

  try {
    const crawlResult = await crawlSources(selectedSources);
    for (const result of crawlResult.sourceResults) {
      const source = selectedSources.find((entry) => entry.id === result.sourceId);
      if (!source) {
        continue;
      }

      if (result.error) {
        sourcesFailed += 1;
        sourceErrors.push({ sourceId: source.id, message: result.error });
        continue;
      }

      sourcesSuccess += 1;
    }

    // Analyze in concurrent batches (10+), then write sequentially to SQLite
    const BATCH_SIZE = Math.max(10, Number(process.env.ANALYSIS_CONCURRENCY || 12));
    for (let i = 0; i < crawlResult.items.length; i += BATCH_SIZE) {
      const batch = crawlResult.items.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (item, idx) => {
          const itemNum = i + idx + 1;
          console.log(`  Analyzing [${itemNum}/${crawlResult.items.length}]: ${item.title.slice(0, 80)}...`);
          const analysis = await analyzeCrawledItem(item);
          return { item, analysis };
        })
      );

      // Write to DB sequentially (SQLite doesn't handle concurrent writes)
      for (let j = 0; j < results.length; j++) {
        itemsDiscovered += 1;
        const result = results[j];
        if (result.status === "rejected") {
          eventsIgnored += 1;
          console.log(`    → Error: ${String(result.reason).slice(0, 100)}`);
          continue;
        }
        const { item, analysis } = result.value;
        const deduplicationKey = buildDeduplicationKey(item, analysis);
        if (seenDeduplicationKeys.has(deduplicationKey)) {
          eventsIgnored += 1;
          continue;
        }
        seenDeduplicationKeys.add(deduplicationKey);

        try {
          const upsertStatus = await upsertAnalysedItem(db, item, analysis);
          if (upsertStatus === "created") { eventsCreated += 1; console.log(`    → Created: ${item.title.slice(0, 60)}`); }
          else if (upsertStatus === "updated") { eventsUpdated += 1; }
          else if (upsertStatus === "status_changed") { eventsStatusChanged += 1; }
          else if (upsertStatus === "ignored") { eventsIgnored += 1; }
        } catch (err) {
          eventsIgnored += 1;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`    → DB Error: ${errMsg.slice(0, 100)}`);
        }
      }
    }

    const status: CrawlSummary["status"] = sourcesFailed > 0 ? "partial" : "completed";
    const finishedAt = new Date().toISOString();
    finalizeCrawlRun(db, runId, {
      status,
      sourcesAttempted: crawlResult.sourceResults.length,
      sourcesSuccess,
      sourcesFailed,
      itemsDiscovered,
      eventsCreated,
      eventsUpdated,
      eventsStatusChanged,
      eventsIgnored,
    });

    return {
      runId,
      status,
      startedAt,
      finishedAt,
      sourcesAttempted: crawlResult.sourceResults.length,
      sourcesSuccess,
      sourcesFailed,
      itemsDiscovered,
      eventsCreated,
      eventsUpdated,
      eventsStatusChanged,
      eventsIgnored,
      sourceErrors,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const status: CrawlSummary["status"] = "failed";
    finalizeCrawlRun(db, runId, {
      status,
      sourcesAttempted: 0,
      sourcesSuccess,
      sourcesFailed,
      itemsDiscovered,
      eventsCreated,
      eventsUpdated,
      eventsStatusChanged,
      eventsIgnored,
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unknown ingestion failure");
  }
}
