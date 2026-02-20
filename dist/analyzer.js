"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisPromptTemplate = void 0;
exports.analyzeCrawledItem = analyzeCrawledItem;
exports.normalizeAgeBracket = normalizeAgeBracket;
exports.normalizeStage = normalizeStage;
exports.normalizeScore = normalizeScore;
const allowedStages = [
    "proposed",
    "introduced",
    "committee_review",
    "passed",
    "enacted",
    "effective",
    "amended",
    "withdrawn",
    "rejected",
];
const allowedBrackets = ["13-15", "16-18", "both"];
const stageFallback = [
    [/proposed/i, "proposed"],
    [/introduced|draft|bill/i, "introduced"],
    [/committee|hear|comment/i, "committee_review"],
    [/passed|adopted|approved/i, "passed"],
    [/enacted|in force|effective/i, "enacted"],
    [/amend/i, "amended"],
    [/withdrawn|withdraw/i, "withdrawn"],
    [/rejected|failed|veto/i, "rejected"],
];
let minimaxAuthFailed = false;
const analysisPromptTemplate = `You are an AI legal analyst for global tech regulation.

You are given one crawled source item that may describe online safety regulation.
Classify as relevant if it relates to ANY regulation, law, bill, enforcement, or guidance affecting minors/children/teens online. Be INCLUSIVE — it is far better to include a borderline-relevant item than to miss a real regulation.

Mark as relevant if ANY of these apply:
- Laws/bills/regulations about children or teens online (COPPA, DSA, Online Safety Acts, etc.)
- Data protection with children's provisions (GDPR Art.8, LGPD, DPDP, etc.)
- Age verification, parental consent, or children's data protection
- Platform safety duties for users under 18
- AI regulation affecting minors
- Social media restrictions for minors
- Advertising/profiling restrictions for children
- Even if the text is partial or noisy — if the source and title suggest child/teen regulation, mark relevant

Return compact strict JSON with these exact keys:
{
  "isRelevant": boolean,
  "jurisdiction": string,
  "stage": "proposed|introduced|committee_review|passed|enacted|effective|amended|withdrawn|rejected",
  "ageBracket": "13-15|16-18|both",
  "affectedMetaProducts": [string],
  "summary": string,
  "businessImpact": string,
  "requiredSolutions": [string],
  "competitorResponses": [string],
  "impactScore": number,
  "likelihoodScore": number,
  "confidenceScore": number,
  "chiliScore": number
}

Do not add extra text around JSON.

Rules:
- If not relevant to teen online regulation, set isRelevant false and keep other fields as sensible defaults.
- Jurisdiction must mention country or jurisdiction.
- Stage must be one of the allowed enum.
- Scores must be integers 1-5.
- ageBracket should be 13-15, 16-18, or both.
- businessImpact should be short and action-oriented.
- competitorResponses should mention named competitors when possible and specific response.

Input item:
TITLE: {{title}}
SOURCE: {{source}}
SUMMARY_TEXT:
{{snippet}}
`;
exports.analysisPromptTemplate = analysisPromptTemplate;
function normalizeScore(value) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) {
        return 1;
    }
    const rounded = Math.round(number);
    if (rounded < 1 || rounded > 5) {
        return rounded < 1 ? 1 : 5;
    }
    return rounded;
}
function normalizeStage(rawStage) {
    const candidate = (rawStage || "").toLowerCase().replace(/\s+/g, "_");
    if (allowedStages.includes(candidate)) {
        return candidate;
    }
    for (const [pattern, fallback] of stageFallback) {
        if (pattern.test(rawStage ?? "")) {
            return fallback;
        }
    }
    return "proposed";
}
function normalizeAgeBracket(raw) {
    if (!raw) {
        return "both";
    }
    const normalized = raw.toLowerCase();
    if (normalized.includes("13-15") || normalized.includes("13") && normalized.includes("15")) {
        return "13-15";
    }
    if (normalized.includes("16-18") || normalized.includes("16") && normalized.includes("18")) {
        return "16-18";
    }
    return "both";
}
function parseResponseJson(content) {
    const direct = content.match(/\{[\s\S]*\}$/);
    if (!direct) {
        return null;
    }
    try {
        return JSON.parse(direct[0]);
    }
    catch {
        const first = content.indexOf("{");
        const last = content.lastIndexOf("}");
        if (first === -1 || last === -1 || last <= first) {
            return null;
        }
        try {
            return JSON.parse(content.slice(first, last + 1));
        }
        catch {
            return null;
        }
    }
}
function extractTextFromModelResponse(body) {
    if (!body || typeof body !== "object") {
        return "";
    }
    const candidate = body;
    if (typeof candidate.output_text === "string") {
        return candidate.output_text;
    }
    const content = candidate.content;
    if (Array.isArray(content)) {
        const firstText = content
            .map((piece) => {
            if (piece && typeof piece === "object" && typeof piece.text === "string") {
                return piece.text;
            }
            return "";
        })
            .join(" ");
        if (firstText.trim()) {
            return firstText;
        }
    }
    if (typeof candidate.content === "string") {
        return candidate.content;
    }
    const message = candidate.message;
    if (message && typeof message === "object" && typeof message.content === "string") {
        return String(message.content);
    }
    const messages = candidate.messages;
    if (Array.isArray(messages)) {
        for (const item of messages) {
            if (item && typeof item === "object") {
                const text = item.content;
                if (typeof text === "string" && text.trim()) {
                    return text;
                }
                if (Array.isArray(text)) {
                    for (const nested of text) {
                        if (nested && typeof nested === "object" && typeof nested.text === "string") {
                            return nested.text;
                        }
                    }
                }
            }
        }
    }
    return "";
}
function sanitizeStringList(input) {
    if (!Array.isArray(input)) {
        return [];
    }
    return input
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 20);
}
function analyzePayloadDefaults(title) {
    return {
        isRelevant: false,
        jurisdiction: "Unknown",
        stage: "proposed",
        ageBracket: "both",
        affectedMetaProducts: ["Meta Family of Products"],
        summary: `Not enough evidence to confirm teen-specific relevance for: ${title}`,
        businessImpact: "Unknown",
        requiredSolutions: ["Monitoring required"],
        competitorResponses: [],
        impactScore: 1,
        likelihoodScore: 1,
        confidenceScore: 1,
        chiliScore: 1,
    };
}
function heuristicFallback(item) {
    const text = `${item.title}\n${item.summary}\n${item.rawText}`.toLowerCase();
    const hasChildSignal = /(child|children|teen|minor|under\s*1[368]|youth|coppa)/.test(text);
    const hasRegulatorySignal = /(regulation|law|bill|legislation|act|guideline|compliance|dsa|kosa|online safety|age verification|parental consent|enforcement|commission|parliament|senate|congress)/.test(text);
    const relevant = hasChildSignal && hasRegulatorySignal;
    if (!relevant) {
        return analyzePayloadDefaults(item.title);
    }
    return {
        isRelevant: true,
        jurisdiction: item.source.jurisdiction,
        stage: normalizeStage(text),
        ageBracket: /(under\s*1[356]|13-15|under\s*16)/.test(text) ? "13-15" : "both",
        affectedMetaProducts: ["Facebook", "Instagram", "WhatsApp"],
        summary: `${item.title}. ${item.summary}`.slice(0, 1200),
        businessImpact: "Potential child-safety compliance impact requiring legal and policy review.",
        requiredSolutions: ["Policy review", "Age-assurance controls", "Regulatory monitoring"],
        competitorResponses: [],
        impactScore: 3,
        likelihoodScore: 3,
        confidenceScore: 2,
        chiliScore: 3,
    };
}
async function analyzeCrawledItem(item, apiKey = process.env.MINIMAX_API_KEY) {
    if (!apiKey) {
        return analyzePayloadDefaults(item.title);
    }
    if (minimaxAuthFailed) {
        return analyzePayloadDefaults(item.title);
    }
    const snippet = [item.summary, item.rawText].filter(Boolean).join("\n\n").slice(0, 5000);
    const prompt = analysisPromptTemplate
        .replace("{{title}}", item.title)
        .replace("{{source}}", item.source.name)
        .replace("{{snippet}}", snippet);
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60_000);
        let response;
        let payload;
        try {
            response = await fetch("https://api.minimax.io/anthropic/v1/messages", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "x-api-key": apiKey,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: "MiniMax-M2.5",
                    messages: [
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    max_tokens: 2048,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                const errBody = await response.text().catch(() => "");
                throw new Error(`MiniMax API request failed with ${response.status} ${response.statusText}: ${errBody.slice(0, 200)}`);
            }
            payload = await response.json();
        }
        finally {
            clearTimeout(timer);
        }
        const rawText = extractTextFromModelResponse(payload);
        if (!rawText) {
            throw new Error("MiniMax API returned no analyzable text content");
        }
        const parsed = parseResponseJson(rawText);
        if (!parsed) {
            throw new Error("MiniMax API response could not be parsed as JSON");
        }
        const isRelevant = Boolean(parsed.isRelevant);
        const jurisdiction = typeof parsed.jurisdiction === "string" && parsed.jurisdiction.trim()
            ? parsed.jurisdiction.trim()
            : item.source.jurisdiction;
        return {
            isRelevant,
            jurisdiction,
            stage: normalizeStage(typeof parsed.stage === "string" ? parsed.stage : ""),
            ageBracket: normalizeAgeBracket(typeof parsed.ageBracket === "string" ? parsed.ageBracket : undefined),
            affectedMetaProducts: sanitizeStringList(parsed.affectedMetaProducts).length
                ? sanitizeStringList(parsed.affectedMetaProducts)
                : ["Meta Family of Products"],
            summary: typeof parsed.summary === "string" && parsed.summary.trim()
                ? parsed.summary.trim()
                : `Teen-related relevance note for ${item.title}`,
            businessImpact: typeof parsed.businessImpact === "string" && parsed.businessImpact.trim()
                ? parsed.businessImpact.trim()
                : "Medium",
            requiredSolutions: sanitizeStringList(parsed.requiredSolutions),
            competitorResponses: sanitizeStringList(parsed.competitorResponses),
            impactScore: normalizeScore(parsed.impactScore),
            likelihoodScore: normalizeScore(parsed.likelihoodScore),
            confidenceScore: normalizeScore(parsed.confidenceScore),
            chiliScore: normalizeScore(parsed.chiliScore),
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/\b401\b|authentication_error|login fail/i.test(message)) {
            minimaxAuthFailed = true;
        }
        console.warn(`[analyzer] Falling back to heuristic analysis for \"${item.title}\": ${message}`);
        return heuristicFallback(item);
    }
}
//# sourceMappingURL=analyzer.js.map