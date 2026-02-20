"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./db");
const app_1 = require("./app");
const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_PATH = process.env.DATABASE_PATH;
const databasePath = DATABASE_PATH ?? undefined;
const db = (0, db_1.openDatabase)(databasePath);
(0, db_1.initializeSchema)(db);
const app = (0, app_1.createApp)(db);
app.listen(PORT, () => {
    console.log(`Global Under-16 Regulation API running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map