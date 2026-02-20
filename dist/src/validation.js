"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringFieldBounds = void 0;
exports.validateScoringBounds = validateScoringBounds;
exports.scoringFieldBounds = [1, 5];
const scoringFieldNames = [
    "impactScore",
    "likelihoodScore",
    "confidenceScore",
    "chiliScore",
];
function validateScoringBounds(scoring) {
    const errors = [];
    if (!scoring || typeof scoring !== "object") {
        return {
            valid: false,
            errors: ["scoring must be an object"],
        };
    }
    const candidate = scoring;
    const [minScore, maxScore] = exports.scoringFieldBounds;
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
//# sourceMappingURL=validation.js.map