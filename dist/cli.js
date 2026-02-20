"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const ingest_1 = require("./ingest");
async function parseSourceIds(args) {
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
async function runCrawl(databasePath = process.env.DATABASE_PATH) {
    const db = (0, db_1.openDatabase)(databasePath);
    (0, db_1.initializeSchema)(db);
    const sourceIds = await parseSourceIds(process.argv);
    const summary = await (0, ingest_1.runIngestionPipeline)(db, sourceIds ? { sourceIds } : undefined);
    console.log(JSON.stringify(summary, null, 2));
    db.close();
}
async function main() {
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
//# sourceMappingURL=cli.js.map