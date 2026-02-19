import { crawlSources, CrawledItem } from "../src/crawler";
import { SourceRecord } from "../src/sources";

const defaultFetch = global.fetch;

function createResponse(body: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => body,
  } as unknown as Response;
}

describe("crawlSources", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = defaultFetch;
  });

  it("parses RSS feed items and includes provenance links", async () => {
    const source: SourceRecord = {
      id: "test-rss",
      name: "Test RSS Source",
      url: "https://example.gov/feed",
      authorityType: "national",
      jurisdiction: "United States",
      region: "US",
      reliabilityTier: 5,
      kind: "rss",
    };

    const rssBody = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Test social rule</title>
        <link>https://example.gov/docs/1</link>
        <pubDate>Mon, 1 Jan 2024 10:00:00 GMT</pubDate>
        <description>Rule about minors.</description>
      </item>
    </channel></rss>`;

    jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      expect(url).toBe(source.url);
      return createResponse(rssBody);
    });

    const result = await crawlSources([source]);

    expect(result.sourceResults).toHaveLength(1);
    expect(result.sourceResults[0]).toMatchObject({
      sourceId: source.id,
      itemCount: 1,
      error: null,
    });
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.title).toBe("Test social rule");
    expect(item.url).toBe("https://example.gov/docs/1");
    expect(item.source.id).toBe(source.id);
    expect(item.provenanceLinks).toEqual(["https://example.gov/feed", "https://example.gov/docs/1"]);
  });

  it("deduplicates duplicate feed items from same source", async () => {
    const source: SourceRecord = {
      id: "test-rss-dup",
      name: "Test RSS Source",
      url: "https://example.gov/feed",
      authorityType: "national",
      jurisdiction: "United States",
      region: "US",
      reliabilityTier: 5,
      kind: "rss",
    };

    const duplicateBody = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Duplicate rule</title>
        <link>https://example.gov/docs/dup</link>
        <description>First instance</description>
      </item>
      <item>
        <title>Duplicate rule</title>
        <link>https://example.gov/docs/dup</link>
        <description>Second instance</description>
      </item>
    </channel></rss>`;

    jest.spyOn(global, "fetch").mockImplementation(async () => createResponse(duplicateBody));

    const result = await crawlSources([source]);

    expect(result.sourceResults[0]).toEqual(
      expect.objectContaining({
        sourceId: source.id,
        itemCount: 1,
        error: null,
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it("parses webpage content and recovers from bad sources", async () => {
    const goodSource: SourceRecord = {
      id: "good-page",
      name: "Good Web Source",
      url: "https://example.gov/page",
      authorityType: "national",
      jurisdiction: "United States",
      region: "US",
      reliabilityTier: 4,
      kind: "webpage",
    };

    const badSource: SourceRecord = {
      id: "bad-page",
      name: "Bad Web Source",
      url: "https://example.gov/fail",
      authorityType: "national",
      jurisdiction: "United States",
      region: "US",
      reliabilityTier: 3,
      kind: "webpage",
    };

    jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (url === goodSource.url) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => '<html><head><title>Good Page</title></head><body>Meta safety update</body></html>',
        } as unknown as Response;
      }

      return Promise.reject(new Error("network down"));
    });

    const result = await crawlSources([goodSource, badSource]);

    expect(result.sourceResults).toHaveLength(2);
    const goodResult = result.sourceResults.find((entry) => entry.sourceId === goodSource.id);
    const badResult = result.sourceResults.find((entry) => entry.sourceId === badSource.id);

    expect(goodResult).toMatchObject({
      sourceId: goodSource.id,
      itemCount: 1,
      error: null,
    });

    expect(badResult).toMatchObject({
      sourceId: badSource.id,
      itemCount: 0,
      error: "network down",
    });

    const sourceItems = result.items.filter((item) => item.source.id === goodSource.id);
    expect(sourceItems).toHaveLength(1);

    expect(sourceItems[0]).toMatchObject({
      title: "Good Page",
      url: "https://example.gov/page",
      source: goodSource,
    } as Pick<CrawledItem, "title" | "url" | "source">);
  });
});
