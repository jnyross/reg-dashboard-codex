"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeHtmlEntities = decodeHtmlEntities;
exports.stripHtml = stripHtml;
exports.cleanText = cleanText;
exports.cleanSummary = cleanSummary;
exports.normalizeJurisdictionState = normalizeJurisdictionState;
exports.isLowQualityEvent = isLowQualityEvent;
const namedHtmlEntities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "-",
    mdash: "—",
    rsquo: "'",
    lsquo: "'",
    ldquo: '"',
    rdquo: '"',
    hellip: "…",
};
const lowSignalPhrases = [
    /skip to main content/gi,
    /official website of the united states government/gi,
    /here'?s how you know/gi,
    /internet explorer version\s*\d+/gi,
    /select your language/gi,
    /cookie(s| manager)?/gi,
    /toggle navigation/gi,
    /all rights reserved/gi,
    /privacy policy/gi,
    /terms of service/gi,
    /accept (all )?cookies/gi,
    /subscribe to our newsletter/gi,
    /follow us on (x|twitter|facebook|instagram|linkedin)/gi,
    /menu close menu/gi,
];
function decodeNumericEntity(entity) {
    const isHex = entity.toLowerCase().startsWith("x");
    const source = isHex ? entity.slice(1) : entity;
    const parsed = Number.parseInt(source, isHex ? 16 : 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return "";
    }
    try {
        return String.fromCodePoint(parsed);
    }
    catch {
        return "";
    }
}
function decodeHtmlEntities(input) {
    return input
        .replace(/&#(x?[0-9a-fA-F]+);/g, (_, entity) => decodeNumericEntity(entity))
        .replace(/&([a-zA-Z]+);/g, (_, entity) => namedHtmlEntities[entity.toLowerCase()] ?? `&${entity};`);
}
function stripHtml(input) {
    return input
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]*>/g, " ");
}
function cleanText(input) {
    const decoded = decodeHtmlEntities(input ?? "");
    const stripped = stripHtml(decoded);
    return stripped
        .replace(/\s+/g, " ")
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .trim();
}
function cleanSummary(input) {
    const source = input ?? "";
    if (!source.trim()) {
        return null;
    }
    let cleaned = cleanText(source);
    for (const pattern of lowSignalPhrases) {
        cleaned = cleaned.replace(pattern, " ");
    }
    cleaned = cleaned
        .replace(/\s+/g, " ")
        .replace(/(\b[A-Z][a-z]+){12,}/g, " ")
        .trim();
    if (!cleaned) {
        return null;
    }
    return cleaned.slice(0, 1600);
}
function normalizeJurisdictionState(value) {
    const trimmed = (value ?? "").trim();
    return trimmed ? trimmed : null;
}
function isLowQualityEvent(input) {
    const summary = (input.summary ?? "").trim();
    if (!summary) {
        return true;
    }
    const summaryLower = summary.toLowerCase();
    const titleLower = input.title.trim().toLowerCase();
    if (summary.length < 40) {
        return true;
    }
    if (summaryLower === titleLower) {
        return true;
    }
    const matchedBoilerplate = lowSignalPhrases.reduce((count, pattern) => {
        const isMatch = pattern.test(summaryLower);
        pattern.lastIndex = 0;
        return count + (isMatch ? 1 : 0);
    }, 0);
    if (matchedBoilerplate >= 2) {
        return true;
    }
    if (/\bkennedys law\b/i.test(`${input.sourceName} ${input.sourceUrl}`)) {
        return true;
    }
    if (/\b(law llp|insights|blog post)\b/i.test(`${input.sourceName} ${input.sourceUrl}`) && summary.length < 120) {
        return true;
    }
    const combined = `${input.title} ${summary} ${input.sourceName} ${input.sourceUrl}`.toLowerCase();
    const hasRegulatorySignal = /(regulation|law|bill|legislation|act|guideline|compliance|enforcement|privacy|online safety|coppa|kosa|dsa|osa|age verification|parental consent|children'?s code|commission|parliament|senate|congress|data protection)/i.test(combined);
    if (!hasRegulatorySignal) {
        return true;
    }
    if (/\bx search\b/i.test(input.sourceName)) {
        const hasPolicySignal = /(regulation|law|bill|act|enforcement|guideline|policy|compliance|age verification|privacy)/i.test(combined);
        if (!hasPolicySignal) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=quality.js.map