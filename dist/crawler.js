"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlSources = crawlSources;
const sources_1 = require("./sources");
const twitter_crawler_1 = require("./twitter-crawler");
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS = 30_000;
const TWITTER_DELAY_MS = 1_500;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        return response.text();
    }
    finally {
        clearTimeout(timer);
    }
}
function stripHtml(text) {
    return text
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeUrl(rawUrl, fallbackBase) {
    if (!rawUrl)
        return "";
    const trimmed = rawUrl.trim();
    if (!trimmed)
        return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }
    try {
        return new URL(trimmed, fallbackBase).toString();
    }
    catch {
        return trimmed;
    }
}
function parseTag(xml, tag) {
    const direct = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i").exec(xml);
    if (direct?.[1]) {
        return stripHtml(decodeEntities(direct[1]).trim());
    }
    const atomLink = /<link[^>]*href=["']([^"']+)["'][^>]*>/.exec(xml);
    if (atomLink?.[1]) {
        return atomLink[1].trim();
    }
    return null;
}
function decodeEntities(raw) {
    return raw
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}
function extractItemLink(entry) {
    const xmlLink = parseTag(entry, "link");
    if (xmlLink) {
        return xmlLink;
    }
    const linkHref = /href=["']([^"']+)["']/i.exec(entry);
    if (linkHref?.[1]) {
        return linkHref[1];
    }
    return "";
}
function parseFeedText(feedText, sourceUrl) {
    const entries = [];
    const itemMatches = feedText.match(/<item[\s\S]*?<\/item>/gi);
    if (itemMatches?.length) {
        entries.push(...itemMatches);
    }
    const atomMatches = feedText.match(/<entry[\s\S]*?<\/entry>/gi);
    if (atomMatches?.length) {
        entries.push(...atomMatches);
    }
    const seen = new Set();
    const MAX_ITEMS_PER_FEED = 5;
    const items = [];
    for (const entry of entries) {
        if (items.length >= MAX_ITEMS_PER_FEED)
            break;
        const rawTitle = parseTag(entry, "title");
        const rawDescription = parseTag(entry, "description") || parseTag(entry, "summary") || parseTag(entry, "content") || "";
        const rawLink = extractItemLink(entry);
        const title = rawTitle?.trim() || "Untitled feed item";
        const url = normalizeUrl(rawLink, sourceUrl);
        const dedupeKey = `${url.toLowerCase()}::${title.toLowerCase()}`;
        if (!title || !url || seen.has(dedupeKey)) {
            continue;
        }
        seen.add(dedupeKey);
        items.push({
            title,
            publishedAt: parseTag(entry, "pubDate") || parseTag(entry, "published") || null,
            url,
            summary: rawDescription || title,
            rawText: `${title}. ${rawDescription}`.trim(),
        });
    }
    return items;
}
function parseWebPage(sourceText, source) {
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(sourceText);
    const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).trim() : source.name;
    const body = stripHtml(decodeEntities(sourceText))
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    if (!title && !body) {
        return [];
    }
    const enrichedBody = body.length < 200
        ? `Source: ${source.name}\nNotes: ${source.notes || ""}\n\n${body}`
        : body;
    return [
        {
            title,
            publishedAt: null,
            url: source.url,
            summary: enrichedBody.slice(0, 500),
            rawText: enrichedBody,
        },
    ];
}
function isAllowedKind(kind) {
    return kind === "webpage" || kind === "rss" || kind === "news_search" || kind === "twitter_search";
}
async function crawlSource(source) {
    if (!isAllowedKind(source.kind)) {
        return {
            sourceId: source.id,
            itemCount: 0,
            error: `Unsupported source kind: ${source.kind}`,
            items: [],
        };
    }
    try {
        if (source.kind === "twitter_search") {
            const bearerToken = process.env.X_BEARER_TOKEN;
            if (!bearerToken) {
                return {
                    sourceId: source.id,
                    itemCount: 0,
                    error: "X_BEARER_TOKEN not set",
                    items: [],
                };
            }
            const twitterItems = await (0, twitter_crawler_1.crawlTwitterRecentSearch)(source, bearerToken);
            return {
                sourceId: source.id,
                itemCount: twitterItems.length,
                error: null,
                items: twitterItems,
            };
        }
        const payload = await fetchWithTimeout(source.url);
        const items = source.kind === "webpage" ? parseWebPage(payload, source) : parseFeedText(payload, source.url);
        return {
            sourceId: source.id,
            itemCount: items.length,
            error: null,
            items,
        };
    }
    catch (error) {
        return {
            sourceId: source.id,
            itemCount: 0,
            error: error instanceof Error ? error.message : "Unknown crawl error",
            items: [],
        };
    }
}
function dedupeCrawledItems(items) {
    const deduped = new Map();
    for (const item of items) {
        const key = `${item.url.toLowerCase()}::${item.title.toLowerCase()}`;
        if (!deduped.has(key)) {
            deduped.set(key, item);
        }
    }
    return [...deduped.values()];
}
async function crawlSources(sources = [...sources_1.sourceRegistry, ...sources_1.twitterSearchSources]) {
    const allItems = [];
    const sourceResults = [];
    const nonTwitterSources = sources.filter((source) => source.kind !== "twitter_search");
    const twitterSources = sources.filter((source) => source.kind === "twitter_search");
    const sourceRuns = await Promise.all(nonTwitterSources.map(crawlSource));
    for (const run of sourceRuns) {
        const source = sources.find((entry) => entry.id === run.sourceId);
        if (!source) {
            continue;
        }
        sourceResults.push({
            sourceId: run.sourceId,
            itemCount: run.itemCount,
            error: run.error,
        });
        for (const item of run.items) {
            const normalizedUrl = normalizeUrl(item.url, source.url);
            if (!normalizedUrl) {
                continue;
            }
            allItems.push({
                ...item,
                title: item.title.trim(),
                url: normalizedUrl,
                source,
                provenanceLinks: [source.url, normalizedUrl].filter((value) => Boolean(value)),
            });
        }
    }
    for (let i = 0; i < twitterSources.length; i++) {
        const source = twitterSources[i];
        const run = await crawlSource(source);
        sourceResults.push({
            sourceId: run.sourceId,
            itemCount: run.itemCount,
            error: run.error,
        });
        for (const item of run.items) {
            const normalizedUrl = normalizeUrl(item.url, source.url);
            if (!normalizedUrl) {
                continue;
            }
            allItems.push({
                ...item,
                title: item.title.trim(),
                url: normalizedUrl,
                source,
                provenanceLinks: [source.url, normalizedUrl].filter((value) => Boolean(value)),
            });
        }
        if (i < twitterSources.length - 1) {
            await sleep(TWITTER_DELAY_MS);
        }
    }
    return { items: dedupeCrawledItems(allItems), sourceResults };
}
//# sourceMappingURL=crawler.js.map