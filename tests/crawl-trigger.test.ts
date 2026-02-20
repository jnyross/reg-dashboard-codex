import request from "supertest";
import { openDatabase, initializeSchema } from "../src/db";
import { createApp } from "../src/app";
import { CrawlSummary } from "../src/ingest";

function buildTestApp() {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const mockSummary: CrawlSummary = {
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

  const runIngestion = jest.fn().mockResolvedValue(mockSummary) as jest.MockedFunction<
    (db: ReturnType<typeof openDatabase>, options?: { sourceIds?: string[] }) => Promise<CrawlSummary>
  >;

  const app = createApp(db, { runIngestion });
  return { app, runIngestion, db };
}

describe("POST /api/crawl", () => {
  it("invokes ingestion pipeline and returns summary", async () => {
    const { app, runIngestion } = buildTestApp();

    const response = await request(app)
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
