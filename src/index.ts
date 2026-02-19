import { openDatabase, initializeSchema } from "./db";
import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_PATH = process.env.DATABASE_PATH;
const databasePath = DATABASE_PATH ?? undefined;
const db = openDatabase(databasePath);
initializeSchema(db);

const app = createApp(db);
app.listen(PORT, () => {
  console.log(`Global Under-16 Regulation API running on http://localhost:${PORT}`);
});
