export type Scoring = {
  impactScore: number;
  likelihoodScore: number;
  confidenceScore: number;
  chiliScore: number;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export const scoringFieldBounds = [1, 5] as const;

const scoringFieldNames = [
  "impactScore",
  "likelihoodScore",
  "confidenceScore",
  "chiliScore",
] as const;

export function validateScoringBounds(scoring: unknown): ValidationResult {
  const errors: string[] = [];

  if (!scoring || typeof scoring !== "object") {
    return {
      valid: false,
      errors: ["scoring must be an object"],
    };
  }

  const candidate = scoring as Record<string, unknown>;
  const [minScore, maxScore] = scoringFieldBounds;

  for (const fieldName of scoringFieldNames) {
    const rawValue = candidate[fieldName];
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);

    if (!Number.isInteger(value) || value < minScore || value > maxScore) {
      errors.push(`${fieldName} must be an integer between ${minScore} and ${maxScore}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

