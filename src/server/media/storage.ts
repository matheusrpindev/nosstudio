/**
 * Armazenamento físico dos uploads. Hoje: disco local em UPLOAD_DIR (precisa ser um volume persistente em
 * produção). Para usar S3/R2 no futuro, basta outra implementação de `MediaStorage` exportada como `storage`.
 */
import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

/**
 * Formato único das chaves: `<pub|priv>/<ano>/<mês>/<24 hex aleatórios>[-<largura>].<ext>`.
 * Tudo que não casar com isto é recusado antes de tocar o disco (bloqueia path traversal por construção).
 */
export const STORAGE_KEY_RE = /^(pub|priv)\/\d{4}\/(0[1-9]|1[0-2])\/[a-f0-9]{24}(-\d{2,4})?\.[a-z0-9]{2,5}$/;

export function isValidStorageKey(key: string): boolean {
  return typeof key === "string" && key.length <= 80 && STORAGE_KEY_RE.test(key);
}

/** Chave da versão principal a partir de uma chave de variante (`…-960.webp` → `….webp`). */
export function mainKeyOf(key: string): string {
  return key.replace(/-\d{2,4}(\.[a-z0-9]{2,5})$/, "$1");
}

export interface MediaStorage {
  put(key: string, data: Buffer): Promise<void>;
  stat(key: string): Promise<{ size: number; mtimeMs: number } | null>;
  /** `range`: só o trecho pedido, com `end` inclusivo (respostas 206 de /media). */
  stream(key: string, range?: { start: number; end: number }): ReadableStream<Uint8Array>;
  delete(key: string): Promise<void>;
}

class LocalDiskStorage implements MediaStorage {
  private root = path.resolve(env.uploadDir);

  private resolve(key: string): string {
    if (!isValidStorageKey(key)) throw new Error("Chave de armazenamento inválida.");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Chave de armazenamento inválida.");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    // "wx": nunca sobrescreve — chaves são aleatórias e únicas.
    await writeFile(full, data, { flag: "wx", mode: 0o640 });
  }

  async stat(key: string) {
    try {
      const info = await stat(this.resolve(key));
      return info.isFile() ? { size: info.size, mtimeMs: info.mtimeMs } : null;
    } catch {
      return null;
    }
  }

  stream(key: string, range?: { start: number; end: number }) {
    return Readable.toWeb(createReadStream(this.resolve(key), range)) as ReadableStream<Uint8Array>;
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

export const storage: MediaStorage = new LocalDiskStorage();
