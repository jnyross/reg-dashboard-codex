import DatabaseConstructor from "better-sqlite3";
import {
  getEventStatusChangeCount,
  initializeSchema,
  openDatabase,
  upsertRegulationEvent,
  type RegulationEventInput,
} from "../src/db";

describe("upsertRegulationEvent", () => {
  function buildDb(): DatabaseConstructor.Database {
    const db = openDatabase(":memory:");
    initializeSchema(db);
    return db;
  }

  function baseEvent(overrides: Partial<RegulationEventInput> = {}): RegulationEventInput {
    return {
      title: "Teen Safety Transparency Bill",
      jurisdictionCountry: "United States",
      jurisdictionState: "California",
      stage: "introduced",
      ageBracket: "13-15",
      isUnder16Applicable: true,
      impactScore: 4,
      likelihoodScore: 4,
      confidenceScore: 4,
      chiliScore: 3,
      summary: "Draft rule for age assurance and content safety.",
      businessImpact: "Moderate product updates needed.",
      requiredSolutions: ["Age assurance", "Content controls"],
      affectedMetaProducts: ["Instagram", "Facebook"],
      competitorResponses: ["TikTok: monitoring"] ,
      rawSourceText: "Calif. draft text includes age-verification requirements.",
      provenanceLinks: ["https://example.gov/some-rule"],
      effectiveDate: null,
      publishedDate: "2026-01-30",
      sourceName: "California Regulator",
      sourceUrl: "https://leginfo.legislature.ca.gov",
      sourceJurisdiction: "California",
      sourceAuthorityType: "state",
      sourceReliabilityTier: 5,
      ...overrides,
    };
  }

  it("deduplicates by source URL and jurisdiction and tracks unchanged inserts", () => {
    const db = buildDb();

    const first = upsertRegulationEvent(db, baseEvent());
    const second = upsertRegulationEvent(db, baseEvent());

    expect(first.status).toBe("created");
    expect(second.status).toBe("unchanged");
    expect(second.id).toBe(first.id);

    const count = db.prepare("SELECT COUNT(*) AS count FROM regulation_events").get() as { count: number };
    expect(count.count).toBe(1);
  });

  it("records status changes when stage moves", () => {
    const db = buildDb();
    const first = upsertRegulationEvent(db, baseEvent());
    const changed = upsertRegulationEvent(db, baseEvent({ stage: "passed" }));

    expect(first.status).toBe("created");
    expect(changed.status).toBe("status_changed");
    expect(changed.previousStage).toBe("introduced");
    expect(getEventStatusChangeCount(db, first.id)).toBe(1);
  });
});
