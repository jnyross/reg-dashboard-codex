import request from "supertest";
import DatabaseConstructor from "better-sqlite3";
import { createApp } from "../src/app";
import { initializeSchema, openDatabase } from "../src/db";
import { seedSampleData } from "../src/seed";
import { validateScoringBounds } from "../src/validation";

function buildTestApp() {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  seedSampleData(db);
  const app = createApp(db);
  return { app, db };
}

describe("scoring validation", () => {
  it("accepts scores from 1 through 5", () => {
    const result = validateScoringBounds({
      impactScore: 1,
      likelihoodScore: 5,
      confidenceScore: 3,
      chiliScore: 2,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects scores outside 1 through 5", () => {
    const result = validateScoringBounds({
      impactScore: 0,
      likelihoodScore: 6,
      confidenceScore: 3.2,
      chiliScore: -1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });
});

describe("GET /api/brief", () => {
  it("orders by risk and urgency deterministically", async () => {
    const { app, db } = buildTestApp();

    const response = await request(app).get("/api/brief?limit=3");
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);

    expect(response.body.items[0].id).toBe("11111111-1111-1111-1111-111111111101");
    expect(response.body.items[1].id).toBe("11111111-1111-1111-1111-111111111102");
    expect(response.body.items[2].id).toBe("11111111-1111-1111-1111-111111111103");

    db.close();
  });
});

describe("feedback persistence", () => {
  it("stores and returns submitted feedback for an event", async () => {
    const { app, db } = buildTestApp();
    const eventId = "11111111-1111-1111-1111-111111111101";

    const create = await request(app)
      .post(`/api/events/${eventId}/feedback`)
      .send({ rating: "good", note: "High confidence sample event." })
      .set("Content-Type", "application/json");

    expect(create.status).toBe(201);
    expect(create.body.eventId).toBe(eventId);
    expect(create.body.rating).toBe("good");

    const feedbackCount = db
      .prepare("SELECT COUNT(*) AS count FROM feedback WHERE event_id = ?")
      .get(eventId) as { count: number };
    expect(feedbackCount.count).toBe(1);

    const detail = await request(app).get(`/api/events/${eventId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.feedback).toHaveLength(1);
    expect(detail.body.feedback[0]).toMatchObject({
      eventId,
      rating: "good",
      note: "High confidence sample event.",
    });

    db.close();
  });
});
