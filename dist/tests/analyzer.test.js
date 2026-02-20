"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const analyzer_1 = require("../src/analyzer");
const crawlerItem = {
    title: "Meta teen safety proposal",
    publishedAt: "2026-02-01T10:00:00Z",
    url: "https://example.gov/rule",
    summary: "Draft update on minor safeguards",
    rawText: "A draft rule discussing youth safety, defaults, and age verification.",
    source: {
        id: "test-source",
        name: "Test Regulator",
        url: "https://example.gov",
        authorityType: "national",
        jurisdiction: "United States",
        region: "US",
        reliabilityTier: 5,
        kind: "webpage",
    },
    provenanceLinks: ["https://example.gov", "https://example.gov/rule"],
};
describe("analyzeCrawledItem", () => {
    afterEach(() => {
        jest.restoreAllMocks();
        delete process.env.MINIMAX_API_KEY;
    });
    it("returns default safe output when API key is missing", async () => {
        const result = await (0, analyzer_1.analyzeCrawledItem)(crawlerItem);
        expect(result.isRelevant).toBe(false);
        expect(result.ageBracket).toBe("both");
        expect(result.requiredSolutions).toEqual(["Monitoring required"]);
    });
    it("parses MiniMax JSON output into structured analysis", async () => {
        process.env.MINIMAX_API_KEY = "test-key";
        const rawAnalysis = {
            isRelevant: true,
            jurisdiction: "California, United States",
            stage: "introduced",
            ageBracket: "13-15",
            affectedMetaProducts: ["Instagram", "Facebook"],
            summary: "California bill affects teen default settings.",
            businessImpact: "Requires updated product controls.",
            requiredSolutions: ["Age assurance", "Parental controls"],
            competitorResponses: ["TikTok: monitoring"],
            impactScore: 4,
            likelihoodScore: 3,
            confidenceScore: 5,
            chiliScore: 4,
        };
        jest.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
                output_text: JSON.stringify(rawAnalysis),
            }),
        });
        const result = await (0, analyzer_1.analyzeCrawledItem)(crawlerItem);
        expect(result).toMatchObject({
            isRelevant: true,
            jurisdiction: "California, United States",
            stage: "introduced",
            ageBracket: "13-15",
            requiredSolutions: ["Age assurance", "Parental controls"],
            competitorResponses: ["TikTok: monitoring"],
            impactScore: 4,
            likelihoodScore: 3,
            confidenceScore: 5,
            chiliScore: 4,
        });
    });
});
//# sourceMappingURL=analyzer.test.js.map