"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../src/db");
describe("upsertRegulationEvent", () => {
    function buildDb() {
        const db = (0, db_1.openDatabase)(":memory:");
        (0, db_1.initializeSchema)(db);
        return db;
    }
    function baseEvent(overrides = {}) {
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
            competitorResponses: ["TikTok: monitoring"],
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
        const first = (0, db_1.upsertRegulationEvent)(db, baseEvent());
        const second = (0, db_1.upsertRegulationEvent)(db, baseEvent());
        expect(first.status).toBe("created");
        expect(second.status).toBe("unchanged");
        expect(second.id).toBe(first.id);
        const count = db.prepare("SELECT COUNT(*) AS count FROM regulation_events").get();
        expect(count.count).toBe(1);
    });
    it("records status changes when stage moves", () => {
        const db = buildDb();
        const first = (0, db_1.upsertRegulationEvent)(db, baseEvent());
        const changed = (0, db_1.upsertRegulationEvent)(db, baseEvent({ stage: "passed" }));
        expect(first.status).toBe("created");
        expect(changed.status).toBe("status_changed");
        expect(changed.previousStage).toBe("introduced");
        expect((0, db_1.getEventStatusChangeCount)(db, first.id)).toBe(1);
    });
});
//# sourceMappingURL=dedup.test.js.map