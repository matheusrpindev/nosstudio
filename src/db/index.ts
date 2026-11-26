/**
 * Conexão com o banco (libSQL). Por padrão um arquivo SQLite local em ./data/nos.db;
 * em produção pode apontar para um banco remoto (Turso) via DATABASE_URL + DATABASE_AUTH_TOKEN.
 *
 * Só pode ser importado no servidor (Server Components, Server Actions, Route Handlers, scripts).
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { withBusyRetry } from "./busy";
import * as schema from "./schema";

export const DATABASE_URL = process.env.DATABASE_URL || "file:./data/nos.db";

type Instance = { client: Client; db: LibSQLDatabase<typeof schema> };

function create(): Instance {
  if (DATABASE_URL.startsWith("file:")) {
    const file = DATABASE_URL.slice("file:".length);
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  // Duas gravações simultâneas não podem derrubar uma delas com "database is locked": ver ./busy.ts.
  const client = withBusyRetry(
    createClient({
      url: DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    }),
  );
  return { client, db: drizzle(client, { schema }) };
}

// Em desenvolvimento o HMR recarrega módulos: guardamos a conexão no escopo global para não vazar conexões.
const globalForDb = globalThis as unknown as { __nosDb?: Instance };
const instance = globalForDb.__nosDb ?? (globalForDb.__nosDb = create());

export const db = instance.db;
export const dbClient = instance.client;
export { schema };
export type Db = typeof db;
/** Tipo aceito por funções que rodam dentro ou fora de uma transação. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
