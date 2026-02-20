"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIngestionPipeline = runIngestionPipeline;
const analyzer_1 = require("./analyzer");
const sources_1 = require("./sources");
const crawler_1 = require("./crawler");
const db_1 = require("./db");
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
function normalizeJurisdictionText(value) {
    return value.trim().toLowerCase();
}
function isLikelyCountry(value) {
    return knownCountries.has(normalizeJurisdictionText(value));
}
function splitJurisdiction(rawJurisdiction) {
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
function mapStage(item) {
    return item.stage;
}
function mapAgeBracket(ageBracket) {
    return ageBracket;
}
function mapUnder16Applicability(ageBracket) {
    return ageBracket === "13-15" || ageBracket === "16-18" || ageBracket === "both";
}
function normalizeRequiredSolutions(item) {
    return item.requiredSolutions.length > 0 ? item.requiredSolutions : ["Legal review", "Monitoring"];
}
function normalizeCompetitorResponses(item) {
    return item.competitorResponses.length > 0 ? item.competitorResponses : [];
}
function normalizeAffectedProducts(item) {
    if (item.affectedMetaProducts.length > 0) {
        return item.affectedMetaProducts;
    }
    return ["Meta Platforms", "Meta Ads Products"];
}
function estimatePublishedDate(item) {
    if (!item.publishedAt) {
        return null;
    }
    const parsed = new Date(item.publishedAt);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString().split("T")[0];
}
async function upsertAnalysedItem(db, item, analysis) {
    if (!analysis.isRelevant) {
        return "ignored";
    }
    const jurisdiction = splitJurisdiction(analysis.jurisdiction || item.source.jurisdiction);
    const result = (0, db_1.upsertRegulationEvent)(db, {
        title: item.title,
        jurisdictionCountry: jurisdiction.country,
        jurisdictionState: jurisdiction.state,
        stage: mapStage(analysis),
        ageBracket: mapAgeBracket(analysis.ageBracket),
        isUnder16Applicable: mapUnder16Applicability(analysis.ageBracket),
        impactScore: analysis.impactScore,
        likelihoodScore: analysis.likelihoodScore,
        confidenceScore: analysis.confidenceScore,
        chiliScore: analysis.chiliScore,
        summary: analysis.summary,
        businessImpact: analysis.businessImpact,
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
async function runIngestionPipeline(db, options = {}) {
    const selectedSources = options.sourceIds?.length
        ? sources_1.sourceRegistry.filter((source) => options.sourceIds?.includes(source.id))
        : sources_1.sourceRegistry;
    const runId = (0, db_1.createCrawlRun)(db);
    const startedAt = new Date().toISOString();
    const sourceErrors = [];
    let sourcesSuccess = 0;
    let sourcesFailed = 0;
    let itemsDiscovered = 0;
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let eventsStatusChanged = 0;
    let eventsIgnored = 0;
    try {
        const crawlResult = await (0, crawler_1.crawlSources)(selectedSources);
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
        // Analyze in concurrent batches of 5, then write sequentially to SQLite
        const BATCH_SIZE = 5;
        for (let i = 0; i < crawlResult.items.length; i += BATCH_SIZE) {
            const batch = crawlResult.items.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(batch.map(async (item, idx) => {
                const itemNum = i + idx + 1;
                console.log(`  Analyzing [${itemNum}/${crawlResult.items.length}]: ${item.title.slice(0, 80)}...`);
                const analysis = await (0, analyzer_1.analyzeCrawledItem)(item);
                return { item, analysis };
            }));
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
                try {
                    const upsertStatus = await upsertAnalysedItem(db, item, analysis);
                    if (upsertStatus === "created") {
                        eventsCreated += 1;
                        console.log(`    → Created: ${item.title.slice(0, 60)}`);
                    }
                    else if (upsertStatus === "updated") {
                        eventsUpdated += 1;
                    }
                    else if (upsertStatus === "status_changed") {
                        eventsStatusChanged += 1;
                    }
                    else if (upsertStatus === "ignored") {
                        eventsIgnored += 1;
                    }
                }
                catch (err) {
                    eventsIgnored += 1;
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.log(`    → DB Error: ${errMsg.slice(0, 100)}`);
                }
            }
        }
        const status = sourcesFailed > 0 ? "partial" : "completed";
        const finishedAt = new Date().toISOString();
        (0, db_1.finalizeCrawlRun)(db, runId, {
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
    }
    catch (error) {
        const finishedAt = new Date().toISOString();
        const status = "failed";
        (0, db_1.finalizeCrawlRun)(db, runId, {
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
//# sourceMappingURL=ingest.js.map