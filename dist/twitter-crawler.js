"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlTwitterRecentSearch = crawlTwitterRecentSearch;
const TWITTER_ENDPOINT = "https://api.twitter.com/2/tweets/search/recent";
const TWITTER_TIMEOUT_MS = Number(process.env.X_API_TIMEOUT_MS || 30_000);
const TWITTER_MAX_RETRIES = Number(process.env.X_API_MAX_RETRIES || 4);
const TWITTER_BASE_BACKOFF_MS = Number(process.env.X_API_BASE_BACKOFF_MS || 1_500);
const TWITTER_MAX_BACKOFF_MS = Number(process.env.X_API_MAX_BACKOFF_MS || 30_000);
function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRetriableStatus(status) {
    return status === 429 || status === 408 || (status >= 500 && status <= 599);
}
function getRateLimitDelayMs(headers) {
    const resetHeader = headers.get("x-rate-limit-reset");
    if (!resetHeader) {
        return null;
    }
    const resetEpochSeconds = Number(resetHeader);
    if (!Number.isFinite(resetEpochSeconds)) {
        return null;
    }
    const resetMs = resetEpochSeconds * 1000;
    const delay = resetMs - Date.now();
    return delay > 0 ? delay : 0;
}
async function fetchRecentTweetsWithRetry(requestUrl, bearerToken) {
    let lastError = null;
    for (let attempt = 1; attempt <= TWITTER_MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TWITTER_TIMEOUT_MS);
        try {
            const response = await fetch(requestUrl.toString(), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${bearerToken}`,
                    Accept: "application/json",
                },
                signal: controller.signal,
            });
            if (response.ok) {
                return response;
            }
            const responseBody = await response.text().catch(() => "");
            const retriable = isRetriableStatus(response.status);
            const message = `X API ${response.status}: ${responseBody.slice(0, 200)}`;
            if (!retriable || attempt === TWITTER_MAX_RETRIES) {
                throw new Error(message);
            }
            const retryAfterSeconds = Number(response.headers.get("retry-after") || "0");
            const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                ? retryAfterSeconds * 1000
                : 0;
            const rateLimitDelayMs = getRateLimitDelayMs(response.headers) ?? 0;
            const exponentialBackoffMs = Math.min(TWITTER_BASE_BACKOFF_MS * 2 ** (attempt - 1), TWITTER_MAX_BACKOFF_MS);
            const waitMs = Math.max(exponentialBackoffMs, retryAfterMs, rateLimitDelayMs);
            await sleep(waitMs);
            continue;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            lastError = err;
            if (attempt === TWITTER_MAX_RETRIES) {
                break;
            }
            const waitMs = Math.min(TWITTER_BASE_BACKOFF_MS * 2 ** (attempt - 1), TWITTER_MAX_BACKOFF_MS);
            await sleep(waitMs);
        }
        finally {
            clearTimeout(timer);
        }
    }
    throw lastError ?? new Error("X API request failed");
}
function buildTweetUrl(tweetId, username) {
    const safeUser = username || "i";
    return `https://x.com/${safeUser}/status/${tweetId}`;
}
async function crawlTwitterRecentSearch(source, bearerToken) {
    const query = source.searchQuery?.trim();
    if (!query) {
        return [];
    }
    const requestUrl = new URL(TWITTER_ENDPOINT);
    requestUrl.searchParams.set("query", query);
    requestUrl.searchParams.set("max_results", "100");
    requestUrl.searchParams.set("tweet.fields", "created_at,author_id,public_metrics");
    requestUrl.searchParams.set("expansions", "author_id");
    requestUrl.searchParams.set("user.fields", "name,username");
    const response = await fetchRecentTweetsWithRetry(requestUrl, bearerToken);
    const payload = (await response.json());
    const users = new Map((payload.includes?.users ?? []).map((u) => [u.id, u]));
    const items = [];
    const seen = new Set();
    for (const tweet of payload.data ?? []) {
        if (!tweet.id || !tweet.text || seen.has(tweet.id)) {
            continue;
        }
        seen.add(tweet.id);
        const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
        const username = user?.username || "unknown";
        const author = user?.name ? `${user.name} (@${username})${user.verified ? " ✓" : ""}` : `@${username}`;
        const cleanText = normalizeText(tweet.text);
        const url = buildTweetUrl(tweet.id, username);
        const metrics = tweet.public_metrics;
        items.push({
            title: cleanText.slice(0, 180) || `Tweet by ${author}`,
            publishedAt: tweet.created_at || null,
            url,
            summary: cleanText.slice(0, 500),
            rawText: [
                `Tweet Author: ${author}`,
                `Tweet URL: ${url}`,
                `Published: ${tweet.created_at || "unknown"}`,
                `Search Query: ${query}`,
                metrics
                    ? `Metrics: ${metrics.like_count ?? 0} likes, ${metrics.retweet_count ?? 0} reposts, ${metrics.reply_count ?? 0} replies, ${metrics.quote_count ?? 0} quotes`
                    : "",
                "",
                cleanText,
            ]
                .filter(Boolean)
                .join("\n"),
        });
    }
    return items;
}
//# sourceMappingURL=twitter-crawler.js.map