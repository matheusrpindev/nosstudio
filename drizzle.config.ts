import { defineConfig } from "drizzle-kit";

// Usado apenas para gerar migrations (`npm run db:generate`). A aplicação é feita por scripts/migrate.ts.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
