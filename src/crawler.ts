import { sourceRegistry, SourceRecord, SourceKind } from "./sources";

export type CrawlInput = {
  title: string;
  publishedAt: string | null;
  url: string;
  summary: string;
  rawText: string;
};

export type CrawledItem = CrawlInput & {
  source: SourceRecord;
  provenanceLinks: string[];
};

export type CrawlSourceResult = {
  sourceId: string;
  itemCount: number;
  error: string | null;
};

export type CrawlResult = {
  items: CrawledItem[];
  sourceResults: CrawlSourceResult[];
};

const USER_AGENT = "global-under16-dashboard/1.0";
const DEFAULT_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string): Promise<string> {
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
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(rawUrl: string, fallbackBase: string): string {
  if (!rawUrl) return "";

  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  try {
    return new URL(trimmed, fallbackBase).toString();
  } catch {
    return trimmed;
  }
}

function parseTag(xml: string, tag: string): string | null {
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

function decodeEntities(raw: string): string {
  return raw
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractItemLink(entry: string): string {
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

function parseFeedText(feedText: string, sourceUrl: string): CrawlInput[] {
  const entries: string[] = [];
  const itemMatches = feedText.match(/<item[\s\S]*?<\/item>/gi);
  if (itemMatches?.length) {
    entries.push(...itemMatches);
  }

  const atomMatches = feedText.match(/<entry[\s\S]*?<\/entry>/gi);
  if (atomMatches?.length) {
    entries.push(...atomMatches);
  }

  const seen = new Set<string>();

  const items: CrawlInput[] = [];
  for (const entry of entries) {
    const rawTitle = parseTag(entry, "title");
    const rawDescription =
      parseTag(entry, "description") || parseTag(entry, "summary") || parseTag(entry, "content") || "";
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

function parseWebPage(sourceText: string, source: SourceRecord): CrawlInput[] {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(sourceText);
  const title = titleMatch ? stripHtml(decodeEntities(titleMatch[1])).trim() : source.name;
  const body = stripHtml(decodeEntities(sourceText))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  if (!title && !body) {
    return [];
  }

  return [
    {
      title,
      publishedAt: null,
      url: source.url,
      summary: body.slice(0, 500),
      rawText: body,
    },
  ];
}

function isAllowedKind(kind: string): kind is SourceKind {
  return kind === "webpage" || kind === "rss" || kind === "news_search";
}

async function crawlSource(source: SourceRecord): Promise<CrawlSourceResult & { items: CrawlInput[] }> {
  if (!isAllowedKind(source.kind)) {
    return {
      sourceId: source.id,
      itemCount: 0,
      error: `Unsupported source kind: ${source.kind}`,
      items: [],
    };
  }

  try {
    const payload = await fetchWithTimeout(source.url);
    const items = source.kind === "webpage" ? parseWebPage(payload, source) : parseFeedText(payload, source.url);
    return {
      sourceId: source.id,
      itemCount: items.length,
      error: null,
      items,
    };
  } catch (error) {
    return {
      sourceId: source.id,
      itemCount: 0,
      error: error instanceof Error ? error.message : "Unknown crawl error",
      items: [],
    };
  }
}

export async function crawlSources(sources: SourceRecord[] = sourceRegistry): Promise<CrawlResult> {
  const allItems: CrawledItem[] = [];
  const sourceResults: CrawlSourceResult[] = [];

  const sourceRuns = await Promise.all(sources.map(crawlSource));
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

  return { items: allItems, sourceResults };
}
