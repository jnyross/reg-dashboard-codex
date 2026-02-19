import DatabaseConstructor from "better-sqlite3";
import { validateScoringBounds } from "./validation";

type SeedSource = {
  name: string;
  url: string;
  authorityType: "national" | "state" | "local" | "supranational";
  jurisdiction: string;
};

type SeedEvent = {
  id: string;
  title: string;
  jurisdictionCountry: string;
  jurisdictionState: string | null;
  stage:
    | "proposed"
    | "introduced"
    | "committee_review"
    | "passed"
    | "enacted"
    | "effective"
    | "amended"
    | "withdrawn"
    | "rejected";
  isUnder16Applicable: boolean;
  impactScore: number;
  likelihoodScore: number;
  confidenceScore: number;
  chiliScore: number;
  summary: string;
  effectiveDate: string | null;
  publishedDate: string;
  sourceName: string;
  updatedAt: string;
  createdAt: string;
};

const sources: SeedSource[] = [
  {
    name: "US Federal Register",
    url: "https://www.federalregister.gov",
    authorityType: "national",
    jurisdiction: "United States",
  },
  {
    name: "California State Legislature",
    url: "https://www.ca.gov",
    authorityType: "state",
    jurisdiction: "California",
  },
  {
    name: "European Commission",
    url: "https://digital-strategy.ec.europa.eu",
    authorityType: "supranational",
    jurisdiction: "European Union",
  },
  {
    name: "UK Office of Communications",
    url: "https://www.ofcom.org.uk",
    authorityType: "national",
    jurisdiction: "United Kingdom",
  },
  {
    name: "Singapore Government Gazette",
    url: "https://www.egazette.gov.sg",
    authorityType: "national",
    jurisdiction: "Singapore",
  },
];

const events: SeedEvent[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    title: "US Federal Youth Privacy Modernization Proposal",
    jurisdictionCountry: "United States",
    jurisdictionState: null,
    stage: "proposed",
    isUnder16Applicable: true,
    impactScore: 5,
    likelihoodScore: 5,
    confidenceScore: 4,
    chiliScore: 5,
    summary: "Draft proposal expands affirmative age-verification requirements for under-16 user features.",
    effectiveDate: "2026-04-30",
    publishedDate: "2026-02-10",
    sourceName: "US Federal Register",
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-02-10T10:00:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    title: "California Digital Product Risk Assessment Rule",
    jurisdictionCountry: "United States",
    jurisdictionState: "California",
    stage: "introduced",
    isUnder16Applicable: true,
    impactScore: 4,
    likelihoodScore: 4,
    confidenceScore: 5,
    chiliScore: 5,
    summary: "State bill requires algorithmic auditing for minors' recommendation systems.",
    effectiveDate: "2026-06-01",
    publishedDate: "2026-02-02",
    sourceName: "California State Legislature",
    createdAt: "2026-01-12T08:00:00.000Z",
    updatedAt: "2026-02-11T09:30:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    title: "EU Child-Centric Digital Service Safeguards",
    jurisdictionCountry: "European Union",
    jurisdictionState: null,
    stage: "committee_review",
    isUnder16Applicable: true,
    impactScore: 4,
    likelihoodScore: 4,
    confidenceScore: 4,
    chiliScore: 5,
    summary: "Committee review discusses additional default safety controls for youth-targeted feeds.",
    effectiveDate: "2026-07-15",
    publishedDate: "2026-01-30",
    sourceName: "European Commission",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-02-09T12:00:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    title: "UK Online Safety Enforcement Action",
    jurisdictionCountry: "United Kingdom",
    jurisdictionState: null,
    stage: "enacted",
    isUnder16Applicable: true,
    impactScore: 3,
    likelihoodScore: 3,
    confidenceScore: 4,
    chiliScore: 4,
    summary: "Enforcement penalties clarified for noncompliant age verification flows.",
    effectiveDate: "2026-01-20",
    publishedDate: "2025-12-12",
    sourceName: "UK Office of Communications",
    createdAt: "2025-12-01T11:00:00.000Z",
    updatedAt: "2026-02-03T10:00:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
    title: "Singapore PDPA Clarification for Minors",
    jurisdictionCountry: "Singapore",
    jurisdictionState: null,
    stage: "effective",
    isUnder16Applicable: false,
    impactScore: 3,
    likelihoodScore: 2,
    confidenceScore: 4,
    chiliScore: 4,
    summary: "Data-controller obligations updated with clearer consent documentation requirements.",
    effectiveDate: "2025-09-01",
    publishedDate: "2025-08-15",
    sourceName: "Singapore Government Gazette",
    createdAt: "2025-08-16T09:15:00.000Z",
    updatedAt: "2026-01-28T08:30:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111106",
    title: "Brazil LGPD Under-16 Update Monitoring Note",
    jurisdictionCountry: "Brazil",
    jurisdictionState: null,
    stage: "passed",
    isUnder16Applicable: false,
    impactScore: 2,
    likelihoodScore: 3,
    confidenceScore: 3,
    chiliScore: 3,
    summary: "General compliance update with no direct under-16 platform feature changes required yet.",
    effectiveDate: "2026-03-12",
    publishedDate: "2026-01-18",
    sourceName: "European Commission",
    createdAt: "2026-01-18T08:45:00.000Z",
    updatedAt: "2026-01-25T13:30:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111107",
    title: "Australia Minor Services Consultation",
    jurisdictionCountry: "Australia",
    jurisdictionState: null,
    stage: "introduced",
    isUnder16Applicable: true,
    impactScore: 2,
    likelihoodScore: 2,
    confidenceScore: 3,
    chiliScore: 2,
    summary: "New public consultation on default feed-limits and parental control notices.",
    effectiveDate: null,
    publishedDate: "2026-01-22",
    sourceName: "US Federal Register",
    createdAt: "2026-01-22T14:20:00.000Z",
    updatedAt: "2026-01-29T11:11:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111108",
    title: "India Emerging Digital Advertising Rules",
    jurisdictionCountry: "India",
    jurisdictionState: null,
    stage: "amended",
    isUnder16Applicable: true,
    impactScore: 1,
    likelihoodScore: 2,
    confidenceScore: 3,
    chiliScore: 2,
    summary: "Ad disclosure additions for minor audiences in beta product categories.",
    effectiveDate: "2026-05-01",
    publishedDate: "2025-11-10",
    sourceName: "UK Office of Communications",
    createdAt: "2025-11-11T17:55:00.000Z",
    updatedAt: "2026-01-10T07:05:00.000Z",
  },
];

export function seedSampleData(db: DatabaseConstructor.Database): void {
  const seeded = db.prepare("SELECT COUNT(*) AS count FROM regulation_events").get() as { count: number };
  if (seeded.count > 0) {
    return;
  }

  const sourceUpsert = db.prepare(
    `
    INSERT OR IGNORE INTO sources (name, url, authority_type, jurisdiction, created_at)
    VALUES (?, ?, ?, ?, ?)
    `,
  );
  const sourceLookup = db.prepare("SELECT id, name FROM sources");
  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO regulation_events (
      id, title, jurisdiction_country, jurisdiction_state, stage,
      is_under16_applicable, impact_score, likelihood_score, confidence_score,
      chili_score, summary, effective_date, published_date, source_id, created_at, updated_at
    ) VALUES (
      @id, @title, @jurisdictionCountry, @jurisdictionState, @stage,
      @isUnder16Applicable, @impactScore, @likelihoodScore, @confidenceScore,
      @chiliScore, @summary, @effectiveDate, @publishedDate, @sourceId, @createdAt, @updatedAt
    )
  `);

  const txn = db.transaction(() => {
    for (const source of sources) {
      sourceUpsert.run(source.name, source.url, source.authorityType, source.jurisdiction, new Date().toISOString());
    }

    const sourceMap = new Map<string, number>((sourceLookup.all() as Array<{ id: number; name: string }>).map((row) => [row.name, row.id]));

    for (const event of events) {
      const validation = validateScoringBounds({
        impactScore: event.impactScore,
        likelihoodScore: event.likelihoodScore,
        confidenceScore: event.confidenceScore,
        chiliScore: event.chiliScore,
      });

      if (!validation.valid) {
        throw new Error(`Invalid seed score for event ${event.id}: ${validation.errors.join(", ")}`);
      }

      const sourceId = sourceMap.get(event.sourceName);
      if (!sourceId) {
        throw new Error(`Source not found for event ${event.id}: ${event.sourceName}`);
      }

      insertEvent.run({
        ...event,
        sourceId,
        isUnder16Applicable: event.isUnder16Applicable ? 1 : 0,
      });
    }
  });

  txn();
}
