import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Import the schema
import regulationEventSchema from './regulation-event.json';

describe('RegulationEvent JSON Schema', () => {
  let validate: ValidateFunction;
  const ajv = new Ajv({ allErrors: true, strict: false });
  
  // Add format validation for dates
  addFormats(ajv);

  beforeAll(() => {
    validate = ajv.compile(regulationEventSchema);
  });

  const validRegulationEvent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'UK Online Safety Act 2023',
    jurisdiction: {
      country: 'United Kingdom',
      state: null,
      locality: null
    },
    source: {
      name: 'UK Government Legislation',
      url: 'https://www.legislation.gov.uk/ukpga/2023/50/contents',
      authorityType: 'national',
      publishedDate: '2023-10-26'
    },
    instrumentType: 'law',
    lifecycleState: 'enacted',
    effectiveDate: '2024-03-15',
    under16Relevance: {
      isPrimaryTarget: true,
      specificProvisions: ['Section 10 - Protection of Children', 'Section 12 - Age Assurance'],
      ageThresholds: [13, 16]
    },
    metaRelevance: {
      affectedProducts: ['Facebook', 'Instagram', 'WhatsApp'],
      businessImpact: 'high',
      solutionRequirements: ['product', 'policy', 'legal']
    },
    scoring: {
      impactScore: 4,
      likelihoodScore: 5,
      confidenceScore: 4,
      chilliScore: 3
    },
    competitorIntelligence: [
      {
        competitor: 'TikTok',
        response: 'Implemented enhanced parental controls',
        evidence: 'https://news.tiktok.com/parental-controls',
        timestamp: '2024-01-15T10:00:00Z'
      }
    ],
    changeHistory: [
      {
        changedAt: '2024-01-10T09:00:00Z',
        changedBy: 'system',
        changeType: 'created',
        previousValue: null,
        newValue: 'enacted'
      }
    ],
    feedback: {
      rating: 'good',
      timestamp: '2024-01-20T14:30:00Z',
      user: 'analyst@example.com'
    },
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  };

  describe('Required Fields', () => {
    it('should reject object missing id', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).id;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'id' } })
      );
    });

    it('should reject object missing title', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).title;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'title' } })
      );
    });

    it('should reject object missing jurisdiction', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).jurisdiction;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'jurisdiction' } })
      );
    });

    it('should reject object missing source', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).source;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'source' } })
      );
    });

    it('should reject object missing instrumentType', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).instrumentType;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'instrumentType' } })
      );
    });

    it('should reject object missing lifecycleState', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).lifecycleState;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'lifecycleState' } })
      );
    });

    it('should reject object missing under16Relevance', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).under16Relevance;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'under16Relevance' } })
      );
    });

    it('should reject object missing metaRelevance', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).metaRelevance;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'metaRelevance' } })
      );
    });

    it('should reject object missing scoring', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).scoring;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'scoring' } })
      );
    });

    it('should reject object missing createdAt', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).createdAt;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'createdAt' } })
      );
    });

    it('should reject object missing updatedAt', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).updatedAt;
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ keyword: 'required', params: { missingProperty: 'updatedAt' } })
      );
    });
  });

  describe('id field', () => {
    it('should reject invalid UUID format', () => {
      const data = { ...validRegulationEvent, id: 'not-a-uuid' };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/id', keyword: 'format' })
      );
    });

    it('should accept valid UUID', () => {
      const data = { ...validRegulationEvent, id: '550e8400-e29b-41d4-a716-446655440000' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });

  describe('jurisdiction field', () => {
    it('should reject jurisdiction missing country', () => {
      const data = {
        ...validRegulationEvent,
        jurisdiction: { state: 'California', locality: 'San Francisco' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/jurisdiction', keyword: 'required' })
      );
    });

    it('should accept jurisdiction with only country', () => {
      const data = {
        ...validRegulationEvent,
        jurisdiction: { country: 'Germany', state: null, locality: null }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept jurisdiction with country and state', () => {
      const data = {
        ...validRegulationEvent,
        jurisdiction: { country: 'United States', state: 'California', locality: null }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept jurisdiction with full location', () => {
      const data = {
        ...validRegulationEvent,
        jurisdiction: { country: 'United States', state: 'California', locality: 'San Francisco' }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });

  describe('source field', () => {
    it('should reject source missing name', () => {
      const data = {
        ...validRegulationEvent,
        source: { url: 'https://example.com', authorityType: 'national', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/source', keyword: 'required' })
      );
    });

    it('should reject source missing url', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', authorityType: 'national', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject invalid url format', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'not-a-url', authorityType: 'national', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/source/url', keyword: 'format' })
      );
    });

    it('should reject source missing authorityType', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'https://example.com', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject invalid authorityType', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'https://example.com', authorityType: 'invalid', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should accept valid authorityType: national', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'https://example.com', authorityType: 'national', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept valid authorityType: state', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'https://example.com', authorityType: 'state', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept valid authorityType: local', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'https://example.com', authorityType: 'local', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept valid authorityType: supranational', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'https://example.com', authorityType: 'supranational', publishedDate: '2024-01-01' }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid publishedDate format', () => {
      const data = {
        ...validRegulationEvent,
        source: { name: 'Test', url: 'https://example.com', authorityType: 'national', publishedDate: 'not-a-date' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/source/publishedDate', keyword: 'format' })
      );
    });
  });

  describe('instrumentType enum', () => {
    it('should accept law', () => {
      const data = { ...validRegulationEvent, instrumentType: 'law' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept regulation', () => {
      const data = { ...validRegulationEvent, instrumentType: 'regulation' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept guidance', () => {
      const data = { ...validRegulationEvent, instrumentType: 'guidance' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept enforcement_action', () => {
      const data = { ...validRegulationEvent, instrumentType: 'enforcement_action' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept consultation', () => {
      const data = { ...validRegulationEvent, instrumentType: 'consultation' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept amendment', () => {
      const data = { ...validRegulationEvent, instrumentType: 'amendment' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid instrumentType', () => {
      const data = { ...validRegulationEvent, instrumentType: 'invalid_type' };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/instrumentType', keyword: 'enum' })
      );
    });
  });

  describe('lifecycleState enum', () => {
    const validStates = ['proposed', 'introduced', 'committee_review', 'passed', 'enacted', 'effective', 'amended', 'withdrawn', 'rejected'];
    
    it.each(validStates)('should accept lifecycleState: %s', (state) => {
      const data = { ...validRegulationEvent, lifecycleState: state };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid lifecycleState', () => {
      const data = { ...validRegulationEvent, lifecycleState: 'invalid_state' };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/lifecycleState', keyword: 'enum' })
      );
    });
  });

  describe('effectiveDate field', () => {
    it('should accept valid date', () => {
      const data = { ...validRegulationEvent, effectiveDate: '2024-12-31' };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const data = { ...validRegulationEvent, effectiveDate: '31-12-2024' };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should accept null effectiveDate', () => {
      const data = { ...validRegulationEvent, effectiveDate: null };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept missing effectiveDate (optional)', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).effectiveDate;
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });

  describe('under16Relevance field', () => {
    it('should reject missing isPrimaryTarget', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: { specificProvisions: ['Test'], ageThresholds: [13] }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject missing specificProvisions', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: { isPrimaryTarget: true, ageThresholds: [13] }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject missing ageThresholds', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: { isPrimaryTarget: true, specificProvisions: ['Test'] }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should accept valid under16Relevance', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: {
          isPrimaryTarget: true,
          specificProvisions: ['Section 10', 'Article 5'],
          ageThresholds: [13, 14, 15, 16]
        }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept empty arrays in under16Relevance', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: {
          isPrimaryTarget: false,
          specificProvisions: [],
          ageThresholds: []
        }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject non-boolean isPrimaryTarget', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: {
          isPrimaryTarget: 'true',
          specificProvisions: [],
          ageThresholds: []
        }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject non-array specificProvisions', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: {
          isPrimaryTarget: true,
          specificProvisions: 'not-an-array',
          ageThresholds: []
        }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject non-array ageThresholds', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: {
          isPrimaryTarget: true,
          specificProvisions: [],
          ageThresholds: '13'
        }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject non-integer ageThresholds', () => {
      const data = {
        ...validRegulationEvent,
        under16Relevance: {
          isPrimaryTarget: true,
          specificProvisions: [],
          ageThresholds: [13.5]
        }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });
  });

  describe('metaRelevance field', () => {
    it('should reject missing affectedProducts', () => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: { businessImpact: 'high', solutionRequirements: ['product'] }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject missing businessImpact', () => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: { affectedProducts: ['Facebook'], solutionRequirements: ['product'] }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject missing solutionRequirements', () => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: { affectedProducts: ['Facebook'], businessImpact: 'high' }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should accept valid metaRelevance', () => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: {
          affectedProducts: ['Facebook', 'Instagram', 'Quest'],
          businessImpact: 'critical',
          solutionRequirements: ['product', 'policy', 'legal', 'ops']
        }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept empty affectedProducts', () => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: {
          affectedProducts: [],
          businessImpact: 'low',
          solutionRequirements: []
        }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it.each(['critical', 'high', 'medium', 'low'])('should accept businessImpact: %s', (impact) => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: {
          affectedProducts: ['Facebook'],
          businessImpact: impact,
          solutionRequirements: ['product']
        }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid businessImpact', () => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: {
          affectedProducts: ['Facebook'],
          businessImpact: 'extreme',
          solutionRequirements: ['product']
        }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it.each(['product', 'policy', 'legal', 'ops'])('should accept solutionRequirements: %s', (req) => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: {
          affectedProducts: ['Facebook'],
          businessImpact: 'high',
          solutionRequirements: [req]
        }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid solutionRequirements item', () => {
      const data = {
        ...validRegulationEvent,
        metaRelevance: {
          affectedProducts: ['Facebook'],
          businessImpact: 'high',
          solutionRequirements: ['invalid']
        }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });
  });

  describe('scoring field', () => {
    it('should reject missing impactScore', () => {
      const data = {
        ...validRegulationEvent,
        scoring: { likelihoodScore: 3, confidenceScore: 4, chilliScore: 2 }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject missing likelihoodScore', () => {
      const data = {
        ...validRegulationEvent,
        scoring: { impactScore: 3, confidenceScore: 4, chilliScore: 2 }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject missing confidenceScore', () => {
      const data = {
        ...validRegulationEvent,
        scoring: { impactScore: 3, likelihoodScore: 4, chilliScore: 2 }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject missing chilliScore', () => {
      const data = {
        ...validRegulationEvent,
        scoring: { impactScore: 3, likelihoodScore: 4, confidenceScore: 2 }
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it.each([1, 2, 3, 4, 5])('should accept impactScore: %d', (score) => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, impactScore: score } };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject impactScore below 1', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, impactScore: 0 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject impactScore above 5', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, impactScore: 6 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it.each([1, 2, 3, 4, 5])('should accept likelihoodScore: %d', (score) => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, likelihoodScore: score } };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject likelihoodScore below 1', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, likelihoodScore: 0 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject likelihoodScore above 5', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, likelihoodScore: 6 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it.each([1, 2, 3, 4, 5])('should accept confidenceScore: %d', (score) => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, confidenceScore: score } };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject confidenceScore below 1', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, confidenceScore: 0 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject confidenceScore above 5', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, confidenceScore: 6 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it.each([1, 2, 3, 4, 5])('should accept chilliScore: %d', (score) => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, chilliScore: score } };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject chilliScore below 1', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, chilliScore: 0 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject chilliScore above 5', () => {
      const data = { ...validRegulationEvent, scoring: { ...validRegulationEvent.scoring, chilliScore: 6 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject non-integer scores', () => {
      const data = { ...validRegulationEvent, scoring: { impactScore: 3.5, likelihoodScore: 4, confidenceScore: 3, chilliScore: 2 } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });
  });

  describe('competitorIntelligence array', () => {
    it('should accept empty competitorIntelligence array', () => {
      const data = { ...validRegulationEvent, competitorIntelligence: [] };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept valid competitorIntelligence entry', () => {
      const data = {
        ...validRegulationEvent,
        competitorIntelligence: [
          {
            competitor: 'TikTok',
            response: 'Enhanced parental controls',
            evidence: 'https://example.com',
            timestamp: '2024-01-15T10:00:00Z'
          }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject competitorIntelligence entry missing competitor', () => {
      const data = {
        ...validRegulationEvent,
        competitorIntelligence: [
          { response: 'Enhanced parental controls', evidence: 'https://example.com', timestamp: '2024-01-15T10:00:00Z' }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject competitorIntelligence entry missing response', () => {
      const data = {
        ...validRegulationEvent,
        competitorIntelligence: [
          { competitor: 'TikTok', evidence: 'https://example.com', timestamp: '2024-01-15T10:00:00Z' }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should accept competitorIntelligence entry with only required fields', () => {
      const data = {
        ...validRegulationEvent,
        competitorIntelligence: [
          { competitor: 'TikTok', response: 'Test response' }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject non-array competitorIntelligence', () => {
      const data = { ...validRegulationEvent, competitorIntelligence: 'not-an-array' };
      const valid = validate(data);
      expect(valid).toBe(false);
    });
  });

  describe('changeHistory array', () => {
    it('should accept empty changeHistory array', () => {
      const data = { ...validRegulationEvent, changeHistory: [] };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept valid changeHistory entry', () => {
      const data = {
        ...validRegulationEvent,
        changeHistory: [
          {
            changedAt: '2024-01-10T09:00:00Z',
            changedBy: 'analyst@example.com',
            changeType: 'created',
            previousValue: null,
            newValue: 'proposed'
          }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject changeHistory entry missing changedAt', () => {
      const data = {
        ...validRegulationEvent,
        changeHistory: [
          { changedBy: 'analyst', changeType: 'created' }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should reject changeHistory entry missing changeType', () => {
      const data = {
        ...validRegulationEvent,
        changeHistory: [
          { changedAt: '2024-01-10T09:00:00Z', changedBy: 'analyst' }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should accept changeHistory entry with only required fields', () => {
      const data = {
        ...validRegulationEvent,
        changeHistory: [
          { changedAt: '2024-01-10T09:00:00Z', changeType: 'created' }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid changeType', () => {
      const data = {
        ...validRegulationEvent,
        changeHistory: [
          { changedAt: '2024-01-10T09:00:00Z', changeType: 'invalid' }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it.each(['created', 'updated', 'status_changed', 'amended', 'deleted'])('should accept changeType: %s', (type) => {
      const data = {
        ...validRegulationEvent,
        changeHistory: [
          { changedAt: '2024-01-10T09:00:00Z', changeType: type }
        ]
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });

  describe('feedback field', () => {
    it('should accept valid feedback', () => {
      const data = {
        ...validRegulationEvent,
        feedback: { rating: 'good', timestamp: '2024-01-20T14:30:00Z', user: 'analyst@example.com' }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept feedback with only required fields', () => {
      const data = {
        ...validRegulationEvent,
        feedback: { rating: 'bad' }
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept null feedback', () => {
      const data = { ...validRegulationEvent, feedback: null };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept missing feedback (optional)', () => {
      const data = { ...validRegulationEvent };
      delete (data as any).feedback;
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should reject invalid rating', () => {
      const data = { ...validRegulationEvent, feedback: { rating: 'excellent' } };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it.each(['good', 'bad'])('should accept rating: %s', (rating) => {
      const data = { ...validRegulationEvent, feedback: { rating } };
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });

  describe('timestamp fields', () => {
    it('should reject invalid createdAt format', () => {
      const data = { ...validRegulationEvent, createdAt: 'not-a-timestamp' };
      const valid = validate(data);
      expect(valid).toBe(false);
      expect(validate.errors).toContainEqual(
        expect.objectContaining({ instancePath: '/createdAt', keyword: 'format' })
      );
    });

    it('should reject invalid updatedAt format', () => {
      const data = { ...validRegulationEvent, updatedAt: 'not-a-timestamp' };
      const valid = validate(data);
      expect(valid).toBe(false);
    });

    it('should accept valid ISO 8601 timestamps', () => {
      const data = {
        ...validRegulationEvent,
        createdAt: '2024-01-10T09:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z'
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept timestamps with timezone offset', () => {
      const data = {
        ...validRegulationEvent,
        createdAt: '2024-01-10T09:00:00+05:00',
        updatedAt: '2024-01-20T14:30:00-08:00'
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });

  describe('Complete valid objects', () => {
    it('should accept a complete valid RegulationEvent', () => {
      const valid = validate(validRegulationEvent);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should accept RegulationEvent with all optional fields', () => {
      const data = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'EU AI Act',
        jurisdiction: {
          country: 'European Union',
          state: null,
          locality: null
        },
        source: {
          name: 'EUR-Lex',
          url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex:32021R0884',
          authorityType: 'supranational',
          publishedDate: '2024-07-12'
        },
        instrumentType: 'regulation',
        lifecycleState: 'proposed',
        effectiveDate: '2025-08-01',
        under16Relevance: {
          isPrimaryTarget: true,
          specificProvisions: ['Article 5 - Prohibited Practices', 'Article 6 - High-Risk Systems'],
          ageThresholds: [13, 16]
        },
        metaRelevance: {
          affectedProducts: ['Facebook', 'Instagram', 'WhatsApp', 'Quest', 'Meta AI'],
          businessImpact: 'critical',
          solutionRequirements: ['product', 'policy', 'legal', 'ops']
        },
        scoring: {
          impactScore: 5,
          likelihoodScore: 4,
          confidenceScore: 3,
          chilliScore: 4
        },
        competitorIntelligence: [
          {
            competitor: 'Google',
            response: 'Enhanced AI safety measures',
            evidence: 'https://blog.google/technology/ai/safety-announcement',
            timestamp: '2024-02-01T10:00:00Z'
          },
          {
            competitor: 'OpenAI',
            response: 'Age-gating improvements',
            evidence: 'https://openai.com/blog/age-verification'
          }
        ],
        changeHistory: [
          {
            changedAt: '2024-01-15T10:00:00Z',
            changedBy: 'system',
            changeType: 'created',
            previousValue: null,
            newValue: 'proposed'
          },
          {
            changedAt: '2024-02-01T14:00:00Z',
            changedBy: 'legal@example.com',
            changeType: 'updated',
            previousValue: 'proposed',
            newValue: 'committee_review'
          }
        ],
        feedback: {
          rating: 'good',
          timestamp: '2024-02-15T09:30:00Z',
          user: 'senior.analyst@example.com'
        },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-02-15T09:30:00Z'
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });

    it('should accept minimal RegulationEvent with only required fields', () => {
      const data = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        title: 'Minimal Regulation',
        jurisdiction: {
          country: 'Test Country'
        },
        source: {
          name: 'Test Source',
          url: 'https://example.com',
          authorityType: 'national',
          publishedDate: '2024-01-01'
        },
        instrumentType: 'law',
        lifecycleState: 'proposed',
        under16Relevance: {
          isPrimaryTarget: false,
          specificProvisions: [],
          ageThresholds: []
        },
        metaRelevance: {
          affectedProducts: [],
          businessImpact: 'low',
          solutionRequirements: []
        },
        scoring: {
          impactScore: 1,
          likelihoodScore: 1,
          confidenceScore: 1,
          chilliScore: 1
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      const valid = validate(data);
      expect(valid).toBe(true);
    });
  });
});
