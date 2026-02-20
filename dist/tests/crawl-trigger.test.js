"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const db_1 = require("../src/db");
const app_1 = require("../src/app");
function buildTestApp() {
    const db = (0, db_1.openDatabase)(":memory:");
    (0, db_1.initializeSchema)(db);
    const mockSummary = {
        runId: 1,
        status: "completed",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:01:00.000Z",
        sourcesAttempted: 1,
        sourcesSuccess: 1,
        sourcesFailed: 0,
        itemsDiscovered: 2,
        eventsCreated: 1,
        eventsUpdated: 0,
        eventsStatusChanged: 0,
        eventsIgnored: 1,
        sourceErrors: [],
    };
    const runIngestion = jest.fn()
        .mockResolvedValue(mockSummary);
    const app = (0, app_1.createApp)(db, { runIngestion });
    return { app, runIngestion, db };
}
describe("POST /api/crawl", () => {
    it("invokes ingestion pipeline and returns summary", async () => {
        const { app, runIngestion } = buildTestApp();
        const response = await (0, supertest_1.default)(app)
            .post("/api/crawl")
            .send({ sourceIds: ["us-federal-register-rss"] })
            .set("Content-Type", "application/json");
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            status: "completed",
            sourcesAttempted: 1,
            eventsCreated: 1,
        });
        expect(runIngestion).toHaveBeenCalledTimes(1);
        expect(runIngestion).toHaveBeenCalledWith(expect.anything(), {
            sourceIds: ["us-federal-register-rss"],
        });
    });
});
//# sourceMappingURL=crawl-trigger.test.js.map