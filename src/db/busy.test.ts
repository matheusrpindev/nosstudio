import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isBusyError, retryWhenBusy, withBusyRetry } from "./busy";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("banco ocupado (SQLITE_BUSY)", () => {
  let dir: string;
  let raw: Client;

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "nos-busy-"));
    raw = createClient({ url: `file:${path.join(dir, "t.db")}` });
    await raw.execute("PRAGMA journal_mode = WAL");
    await raw.execute("create table contador (id integer primary key, n integer not null)");
    await raw.execute("insert into contador values (1, 0)");
  });

  afterEach(() => {
    raw.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const total = async () => Number((await raw.execute("select n from contador where id = 1")).rows[0].n);

  /** Lê, espera (dando tempo de outra transação tentar entrar) e grava o valor lido + 1. */
  const increment = async (client: Client) => {
    const tx = await client.transaction();
    try {
      const current = Number((await tx.execute("select n from contador where id = 1")).rows[0].n);
      await sleep(20);
      await tx.execute({ sql: "update contador set n = ? where id = 1", args: [current + 1] });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  };

  it("sem tratamento, a segunda transação simultânea falha na hora (o defeito)", async () => {
    const results = await Promise.allSettled([increment(raw), increment(raw), increment(raw)]);
    const failed = results.filter((r) => r.status === "rejected");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((r) => isBusyError((r as PromiseRejectedResult).reason))).toBe(true);
  });

  it("com tratamento, transações simultâneas entram em fila e nenhuma gravação se perde", async () => {
    const client = withBusyRetry(raw);
    await Promise.all(Array.from({ length: 8 }, () => increment(client)));
    expect(await total()).toBe(8);
  });

  it("vale para db.transaction() do Drizzle", async () => {
    const db = drizzle(withBusyRetry(raw));
    await Promise.all(
      Array.from({ length: 6 }, () =>
        db.transaction(async (tx) => {
          const [row] = await tx.all<{ n: number }>(sql`select n from contador where id = 1`);
          await sleep(15);
          await tx.run(sql`update contador set n = ${row.n + 1} where id = 1`);
        }),
      ),
    );
    expect(await total()).toBe(6);
  });

  it("gravação avulsa espera a transação aberta terminar; leitura não espera", async () => {
    const client = withBusyRetry(raw);
    const tx = await client.transaction();
    await tx.execute("update contador set n = n + 10 where id = 1");

    let done = false;
    const write = client.execute("update contador set n = n + 100 where id = 1").then(() => (done = true));
    // A leitura enxerga o último valor confirmado, sem esperar a transação.
    expect(Number((await client.execute("select n from contador where id = 1")).rows[0].n)).toBe(0);
    await sleep(40);
    expect(done).toBe(false);

    await tx.commit();
    await write;
    expect(await total()).toBe(110);
  });

  it("desiste depois do tempo máximo e devolve o erro original", async () => {
    const client = withBusyRetry(raw, { maxWaitMs: 60 });
    const holder = await raw.transaction();
    const started = Date.now();
    await expect(client.execute("update contador set n = 1 where id = 1")).rejects.toSatisfy(isBusyError);
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    await holder.rollback();
    expect(await total()).toBe(0);
  });

  it("outros erros passam direto, sem nova tentativa", async () => {
    let attempts = 0;
    await expect(
      retryWhenBusy(async () => {
        attempts += 1;
        throw new Error("UNIQUE constraint failed");
      }),
    ).rejects.toThrow("UNIQUE constraint failed");
    expect(attempts).toBe(1);

    const client = withBusyRetry(raw);
    await expect(client.execute("insert into contador values (1, 5)")).rejects.toThrow();
    expect(client.closed).toBe(false);
  });

  it("reconhece o erro também quando vem embrulhado", () => {
    expect(isBusyError({ code: "SQLITE_BUSY" })).toBe(true);
    expect(isBusyError({ code: "SQLITE_BUSY_SNAPSHOT" })).toBe(true);
    expect(isBusyError(new Error("Failed query", { cause: { code: "SQLITE_BUSY", rawCode: 5 } }))).toBe(true);
    expect(isBusyError(new Error("database is locked"))).toBe(true);
    expect(isBusyError(new Error("no such table"))).toBe(false);
    expect(isBusyError(null)).toBe(false);
  });
});
