import { openDatabase, initializeSchema } from "./db";
import { runIngestionPipeline } from "./ingest";

async function parseSourceIds(args: string[]): Promise<string[] | undefined> {
  const sourceIdsArgIndex = args.indexOf("--source-ids");
  if (sourceIdsArgIndex === -1) {
    return undefined;
  }

  const raw = args[sourceIdsArgIndex + 1];
  if (!raw) {
    return undefined;
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function runCrawl(databasePath = process.env.DATABASE_PATH): Promise<void> {
  const db = openDatabase(databasePath);
  initializeSchema(db);

  const sourceIds = await parseSourceIds(process.argv);
  const summary = await runIngestionPipeline(db, sourceIds ? { sourceIds } : undefined);
  console.log(JSON.stringify(summary, null, 2));
  db.close();
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== "crawl") {
    console.log("Usage: npm run crawl");
    process.exitCode = 1;
    return;
  }

  await runCrawl(process.env.DATABASE_PATH);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
