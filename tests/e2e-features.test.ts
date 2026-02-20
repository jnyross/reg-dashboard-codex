import request from "supertest";
import { openDatabase, initializeSchema } from "../src/db";
import { seedSampleData } from "../src/seed";
import { createApp } from "../src/app";

function buildTestApp() {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  seedSampleData(db);
  const app = createApp(db);
  return { app, db };
}

describe("E2E platform features", () => {
  it("serves crawl status as JSON (not HTML)", async () => {
    const { app, db } = buildTestApp();
    const response = await request(app).get("/api/crawl/status");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toHaveProperty("totalEvents");
    expect(response.body).toHaveProperty("lastRun");

    db.close();
  });

  it("supports full-text search and advanced filtering", async () => {
    const { app, db } = buildTestApp();
    const response = await request(app)
      .get("/api/events")
      .query({
        search: "privacy",
        minRisk: 2,
        maxRisk: 5,
        stage: "proposed,introduced,enacted,effective",
      });

    expect(response.status).toBe(200);
    expect(response.headers["x-total-count"]).toBeDefined();
    expect(response.headers["x-total-pages"]).toBeDefined();
    expect(Array.isArray(response.body.items)).toBe(true);

    response.body.items.forEach((item: { scores: { chili: number } }) => {
      expect(item.scores.chili).toBeGreaterThanOrEqual(2);
      expect(item.scores.chili).toBeLessThanOrEqual(5);
    });

    db.close();
  });

  it("provides analytics endpoints for dashboard charts", async () => {
    const { app, db } = buildTestApp();

    const summary = await request(app).get("/api/analytics/summary");
    const trends = await request(app).get("/api/analytics/trends");
    const jurisdictions = await request(app).get("/api/analytics/jurisdictions");
    const stages = await request(app).get("/api/analytics/stages");
    const riskDistribution = await request(app).get("/api/analytics/risk-distribution");

    expect(summary.status).toBe(200);
    expect(summary.body).toHaveProperty("totalEvents");
    expect(summary.body).toHaveProperty("averageRiskScore");

    expect(trends.status).toBe(200);
    expect(Array.isArray(trends.body.trends)).toBe(true);

    expect(jurisdictions.status).toBe(200);
    expect(Array.isArray(jurisdictions.body.jurisdictions)).toBe(true);

    expect(stages.status).toBe(200);
    expect(Array.isArray(stages.body.stages)).toBe(true);

    expect(riskDistribution.status).toBe(200);
    expect(Array.isArray(riskDistribution.body.distribution)).toBe(true);

    db.close();
  });

  it("supports event detail timeline, related events, and patch editing", async () => {
    const { app, db } = buildTestApp();
    const list = await request(app).get("/api/events").query({ limit: 1 });
    const id = list.body.items[0].id as string;

    const before = await request(app).get(`/api/events/${id}`);
    expect(before.status).toBe(200);
    expect(before.body).toHaveProperty("relatedEvents");
    expect(before.body).toHaveProperty("statusHistory");

    const patch = await request(app)
      .patch(`/api/events/${id}`)
      .send({ summary: "Updated test summary", businessImpact: "Updated impact" })
      .set("Content-Type", "application/json");

    expect(patch.status).toBe(200);
    expect(patch.body.summary).toBe("Updated test summary");
    expect(patch.body.businessImpact).toBe("Updated impact");

    db.close();
  });

  it("supports CSV and PDF export", async () => {
    const { app, db } = buildTestApp();

    const csv = await request(app).get("/api/export/csv").query({ minRisk: 1 });
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("id,title,jurisdiction_country");

    const pdf = await request(app).get("/api/export/pdf");
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");

    db.close();
  });

  it("supports saved searches, digest config, webhook config, and alerts", async () => {
    const { app, db } = buildTestApp();

    const savedCreate = await request(app)
      .post("/api/saved-searches")
      .send({ name: "High Risk US", filters: { jurisdiction: "United States", minRisk: 4 } })
      .set("Content-Type", "application/json");
    expect(savedCreate.status).toBe(201);

    const savedList = await request(app).get("/api/saved-searches");
    expect(savedList.status).toBe(200);
    expect(Array.isArray(savedList.body.items)).toBe(true);
    expect(savedList.body.items.length).toBeGreaterThan(0);

    const digestSet = await request(app)
      .post("/api/digest/config")
      .send({ email: "analyst@example.com", frequency: "daily", minRisk: 4, enabled: true })
      .set("Content-Type", "application/json");
    expect(digestSet.status).toBe(200);

    const digestGet = await request(app).get("/api/digest/config").query({ email: "analyst@example.com" });
    expect(digestGet.status).toBe(200);
    expect(digestGet.body.config.email).toBe("analyst@example.com");

    const digestPreview = await request(app).get("/api/digest/preview").query({ email: "analyst@example.com" });
    expect(digestPreview.status).toBe(200);
    expect(digestPreview.body).toHaveProperty("items");

    const webhookCreate = await request(app)
      .post("/api/webhooks")
      .send({ url: "https://example.com/hook", minRisk: 4, enabled: true })
      .set("Content-Type", "application/json");
    expect(webhookCreate.status).toBe(201);

    const webhookList = await request(app).get("/api/webhooks");
    expect(webhookList.status).toBe(200);
    expect(webhookList.body.items.length).toBeGreaterThan(0);

    const alerts = await request(app).get("/api/alerts/high-risk").query({ minRisk: 4 });
    expect(alerts.status).toBe(200);
    expect(Array.isArray(alerts.body.items)).toBe(true);

    db.close();
  });

  it("serves modern frontend shell with Chart.js and pages", async () => {
    const { app, db } = buildTestApp();

    const root = await request(app).get("/");
    expect(root.status).toBe(200);
    expect(root.headers["content-type"]).toContain("text/html");
    expect(root.text).toContain("CODEX — Regulatory Intelligence");
    expect(root.text).toContain("chart.umd.min.js");
    expect(root.text).toContain("data-page=\"dashboard\"");
    expect(root.text).toContain("data-page=\"events\"");
    expect(root.text).toContain("data-page=\"map\"");

    db.close();
  });
});
