"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlTwitterRecentSearch = crawlTwitterRecentSearch;
const TWITTER_ENDPOINT = "https://api.twitter.com/2/tweets/search/recent";
function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
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
    requestUrl.searchParams.set("tweet.fields", "created_at,author_id,public_metrics,entities");
    requestUrl.searchParams.set("expansions", "author_id");
    requestUrl.searchParams.set("user.fields", "name,username,verified");
    const response = await fetch(requestUrl.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${bearerToken}`,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`X API ${response.status}: ${body.slice(0, 200)}`);
    }
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