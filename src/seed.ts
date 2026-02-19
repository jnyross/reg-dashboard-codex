import DatabaseConstructor from "better-sqlite3";
import { validateScoringBounds } from "./validation";

type SeedSource = {
  name: string;
  url: string;
  authorityType: "national" | "state" | "local" | "supranational";
  jurisdiction: string;
  reliabilityTier: number;
};

type SeedEvent = {
  id: string;
  title: string;
  jurisdictionCountry: string;
  jurisdictionState: string | null;
  ageBracket: "13-15" | "16-18" | "both";
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
  businessImpact: string;
  requiredSolutions: string[];
  affectedMetaProducts: string[];
  competitorResponses: string[];
  rawSourceText: string;
  publishedDate: string;
  effectiveDate: string | null;
  sourceName: string;
  sourceUrl: string;
  updatedAt: string;
  createdAt: string;
};

const sources: SeedSource[] = [
  {
    name: "US Federal Register",
    url: "https://www.federalregister.gov",
    authorityType: "national",
    jurisdiction: "United States",
    reliabilityTier: 5,
  },
  {
    name: "California State Legislature",
    url: "https://www.ca.gov",
    authorityType: "state",
    jurisdiction: "California",
    reliabilityTier: 5,
  },
  {
    name: "European Commission",
    url: "https://digital-strategy.ec.europa.eu",
    authorityType: "supranational",
    jurisdiction: "European Union",
    reliabilityTier: 5,
  },
  {
    name: "UK Office of Communications",
    url: "https://www.ofcom.org.uk",
    authorityType: "national",
    jurisdiction: "United Kingdom",
    reliabilityTier: 5,
  },
  {
    name: "Singapore Government Gazette",
    url: "https://www.egazette.gov.sg",
    authorityType: "national",
    jurisdiction: "Singapore",
    reliabilityTier: 5,
  },
];

const events: SeedEvent[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    title: "US Federal Youth Privacy Modernization Proposal",
    jurisdictionCountry: "United States",
    jurisdictionState: null,
    ageBracket: "both",
    stage: "proposed",
    isUnder16Applicable: true,
    impactScore: 5,
    likelihoodScore: 5,
    confidenceScore: 4,
    chiliScore: 5,
    summary: "Draft proposal expands affirmative age-verification requirements for under-16 user features.",
    businessImpact: "Potentially requires redesign of identity and onboarding flows for youth-targeted products.",
    requiredSolutions: ["Age verification", "Product controls", "Policy updates"],
    affectedMetaProducts: ["Meta Platforms", "Instagram", "Facebook"],
    competitorResponses: ["TikTok: monitoring policy changes", "Snapchat: staged rollout announcement"],
    rawSourceText: "US Federal Register draft rule and hearing notes indicate explicit child privacy updates.",
    publishedDate: "2026-02-10",
    effectiveDate: "2026-04-30",
    sourceName: "US Federal Register",
    sourceUrl: "https://www.federalregister.gov",
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-02-10T10:00:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    title: "California Digital Product Risk Assessment Rule",
    jurisdictionCountry: "United States",
    jurisdictionState: "California",
    ageBracket: "13-15",
    stage: "introduced",
    isUnder16Applicable: true,
    impactScore: 4,
    likelihoodScore: 4,
    confidenceScore: 5,
    chiliScore: 5,
    summary: "State bill requires algorithmic auditing for minors' recommendation systems.",
    businessImpact: "Ranking and recommendation changes may reduce engagement for under-16 cohorts.",
    requiredSolutions: ["Model auditing", "Transparency controls"],
    affectedMetaProducts: ["Meta Family of Products"],
    competitorResponses: ["ByteDance: waiting for final text", "Pinterest: legal monitoring"],
    rawSourceText: "California legislative consultation highlights feed ranking safeguards for minors.",
    publishedDate: "2026-02-02",
    effectiveDate: "2026-06-01",
    sourceName: "California State Legislature",
    sourceUrl: "https://www.ca.gov",
    createdAt: "2026-01-12T08:00:00.000Z",
    updatedAt: "2026-02-11T09:30:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    title: "EU Child-Centric Digital Service Safeguards",
    jurisdictionCountry: "European Union",
    jurisdictionState: null,
    ageBracket: "both",
    stage: "committee_review",
    isUnder16Applicable: true,
    impactScore: 4,
    likelihoodScore: 4,
    confidenceScore: 4,
    chiliScore: 5,
    summary: "Committee review discusses additional default safety controls for youth-targeted feeds.",
    businessImpact: "Default settings and age assurance requirements may need platform policy updates.",
    requiredSolutions: ["Age assurance", "Default safe settings", "Audit evidence"] ,
    affectedMetaProducts: ["Instagram", "Messenger", "WhatsApp"],
    competitorResponses: ["YouTube: public comment participation", "Snap: policy gap response"],
    rawSourceText: "Committee paper focuses on design features for minors in digital services.",
    publishedDate: "2026-01-30",
    effectiveDate: "2026-07-15",
    sourceName: "European Commission",
    sourceUrl: "https://digital-strategy.ec.europa.eu",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-02-09T12:00:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    title: "UK Online Safety Enforcement Action",
    jurisdictionCountry: "United Kingdom",
    jurisdictionState: null,
    ageBracket: "16-18",
    stage: "enacted",
    isUnder16Applicable: true,
    impactScore: 3,
    likelihoodScore: 3,
    confidenceScore: 4,
    chiliScore: 4,
    summary: "Enforcement penalties clarified for noncompliant age verification flows.",
    businessImpact: "Identity verification process may affect onboarding conversion metrics.",
    requiredSolutions: ["Age checks", "Safety audit"] ,
    affectedMetaProducts: ["Instagram", "Facebook"],
    competitorResponses: ["TikTok: updated legal filing"],
    rawSourceText: "UK enforcement guidance clarifies verification and content filtering obligations.",
    publishedDate: "2025-12-12",
    effectiveDate: "2026-01-20",
    sourceName: "UK Office of Communications",
    sourceUrl: "https://www.ofcom.org.uk",
    createdAt: "2025-12-01T11:00:00.000Z",
    updatedAt: "2026-02-03T10:00:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
    title: "Singapore PDPA Clarification for Minors",
    jurisdictionCountry: "Singapore",
    jurisdictionState: null,
    ageBracket: "both",
    stage: "effective",
    isUnder16Applicable: false,
    impactScore: 3,
    likelihoodScore: 2,
    confidenceScore: 4,
    chiliScore: 4,
    summary: "Data-controller obligations updated with clearer consent documentation requirements.",
    businessImpact: "Consent workflows may need stronger parental transparency records.",
    requiredSolutions: ["Consent capture", "Retention policy tuning"],
    affectedMetaProducts: ["Meta Apps", "Meta Messaging"],
    competitorResponses: ["Telegram: policy update review"],
    rawSourceText: "Regulator guidance focuses on consent and documentation obligations for minors.",
    publishedDate: "2025-08-15",
    effectiveDate: "2025-09-01",
    sourceName: "Singapore Government Gazette",
    sourceUrl: "https://www.egazette.gov.sg",
    createdAt: "2025-08-16T09:15:00.000Z",
    updatedAt: "2026-01-28T08:30:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111106",
    title: "Brazil LGPD Under-16 Update Monitoring Note",
    jurisdictionCountry: "Brazil",
    jurisdictionState: null,
    ageBracket: "both",
    stage: "passed",
    isUnder16Applicable: false,
    impactScore: 2,
    likelihoodScore: 3,
    confidenceScore: 3,
    chiliScore: 3,
    summary: "General compliance update with no direct under-16 platform feature changes required yet.",
    businessImpact: "Potential reporting obligations for minors data may expand with pending rules.",
    requiredSolutions: ["Legal watch", "Gap assessment"],
    affectedMetaProducts: ["Meta Family of Products"],
    competitorResponses: ["X: broad legal watch note"],
    rawSourceText: "Monitoring note on LGPD operational expectations for youth product segments.",
    publishedDate: "2026-01-18",
    effectiveDate: "2026-03-12",
    sourceName: "European Commission",
    sourceUrl: "https://digital-strategy.ec.europa.eu",
    createdAt: "2026-01-18T08:45:00.000Z",
    updatedAt: "2026-01-25T13:30:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111107",
    title: "Australia Minor Services Consultation",
    jurisdictionCountry: "Australia",
    jurisdictionState: null,
    ageBracket: "13-15",
    stage: "introduced",
    isUnder16Applicable: true,
    impactScore: 2,
    likelihoodScore: 2,
    confidenceScore: 3,
    chiliScore: 2,
    summary: "New public consultation on default feed-limits and parental control notices.",
    businessImpact: "May require UI and defaults for youth audiences to be tightened.",
    requiredSolutions: ["Parental controls", "Default limits"] ,
    affectedMetaProducts: ["Instagram Reels", "Meta Quest"],
    competitorResponses: ["YouTube: commenting on parental controls"],
    rawSourceText: "Public consultation explores default limits and mandatory notices for minor users.",
    publishedDate: "2026-01-22",
    effectiveDate: null,
    sourceName: "US Federal Register",
    sourceUrl: "https://www.federalregister.gov",
    createdAt: "2026-01-22T14:20:00.000Z",
    updatedAt: "2026-01-29T11:11:00.000Z",
  },
  {
    id: "11111111-1111-1111-1111-111111111108",
    title: "India Emerging Digital Advertising Rules",
    jurisdictionCountry: "India",
    jurisdictionState: null,
    ageBracket: "16-18",
    stage: "amended",
    isUnder16Applicable: true,
    impactScore: 1,
    likelihoodScore: 2,
    confidenceScore: 3,
    chiliScore: 2,
    summary: "Ad disclosure additions for minor audiences in beta product categories.",
    businessImpact: "Advertising labeling requirements may force changes in ads pipeline.",
    requiredSolutions: ["Ad labeling", "Audience controls"],
    affectedMetaProducts: ["Meta Ads", "Audience Manager"],
    competitorResponses: ["Kakao: internal policy update", "Pinterest: watchlist entry"],
    rawSourceText: "Regulatory draft adds transparency disclosures for child-targeted ad segments.",
    publishedDate: "2025-11-10",
    effectiveDate: "2026-05-01",
    sourceName: "UK Office of Communications",
    sourceUrl: "https://www.ofcom.org.uk",
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
    INSERT OR IGNORE INTO sources (name, url, authority_type, jurisdiction, reliability_tier, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
  );

  const sourceLookup = db.prepare("SELECT id, name FROM sources");

  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO regulation_events (
      id, title, jurisdiction_country, jurisdiction_state, age_bracket, stage,
      is_under16_applicable, impact_score, likelihood_score, confidence_score,
      chili_score, summary, business_impact, required_solutions, affected_products,
      competitor_responses, raw_source_text, provenance_links, effective_date,
      published_date, source_id, source_url, created_at, updated_at, last_crawled_at
    ) VALUES (
      @id, @title, @jurisdictionCountry, @jurisdictionState, @ageBracket, @stage,
      @isUnder16Applicable, @impactScore, @likelihoodScore, @confidenceScore,
      @chiliScore, @summary, @businessImpact, @requiredSolutions, @affectedMetaProducts,
      @competitorResponses, @rawSourceText, @provenanceLinks, @effectiveDate, @publishedDate, @sourceId,
      @sourceUrl, @createdAt, @updatedAt, @updatedAt
    )
  `);

  const txn = db.transaction(() => {
    for (const source of sources) {
      sourceUpsert.run(
        source.name,
        source.url,
        source.authorityType,
        source.jurisdiction,
        source.reliabilityTier,
        new Date().toISOString(),
      );
    }

    const sourceMap = new Map<string, number>(
      (sourceLookup.all() as Array<{ id: number; name: string }>).map((row) => [row.name, row.id]),
    );

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
        jurisdictionState: event.jurisdictionState ?? "",
        requiredSolutions: JSON.stringify(event.requiredSolutions),
        affectedMetaProducts: JSON.stringify(event.affectedMetaProducts),
        competitorResponses: JSON.stringify(event.competitorResponses),
        rawSourceText: event.rawSourceText,
        provenanceLinks: JSON.stringify([event.sourceUrl]),
      });
    }
  });

  txn();
}
