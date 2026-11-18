/**
 * Validação e processamento de uploads. O tipo é decidido pelo CONTEÚDO (assinatura de bytes), nunca pela
 * extensão ou pelo MIME que o navegador informa.
 */
import "server-only";
import sharp from "sharp";
import type { MediaVariant } from "@/db/schema";

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const FILE_MAX_BYTES = 25 * 1024 * 1024;
const IMAGE_MAX_SIDE = 12_000;
const IMAGE_MAX_PIXELS = 80_000_000; // barra "bombas de pixels" antes de decodificar
const MAIN_MAX_SIDE = 2560;
const VARIANT_WIDTHS = [480, 960, 1600];

/** Erro com mensagem pronta para o usuário e status HTTP. */
export class MediaError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((byte, index) => buffer[offset + index] === byte);
const ascii = (buffer: Buffer, start: number, end: number) => buffer.subarray(start, end).toString("latin1");

type ImageKind = "jpeg" | "png" | "webp" | "gif" | "avif";

/** Reconhece imagens raster aceitas pela assinatura. SVG/HTML/XML nunca passam daqui. */
export function sniffImage(buffer: Buffer): ImageKind | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") return "webp";
  if (ascii(buffer, 0, 6) === "GIF87a" || ascii(buffer, 0, 6) === "GIF89a") return "gif";
  if (ascii(buffer, 4, 8) === "ftyp" && /^(avif|avis)$/.test(ascii(buffer, 8, 12))) return "avif";
  return null;
}

/** Tipos aceitos como arquivo privado (contratos, comprovantes, materiais da marca). */
const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  otf: "font/otf",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
};
export const ACCEPTED_FILE_EXTENSIONS = Object.keys(FILE_TYPES);

/**
 * Confere se o conteúdo é coerente com a extensão informada e devolve { ext, mime } confiáveis.
 * Lança MediaError se o tipo não for aceito ou se conteúdo e extensão não combinarem.
 */
export function sniffFile(buffer: Buffer, originalName: string): { ext: string; mime: string } {
  const ext = (originalName.split(".").pop() ?? "").toLowerCase();
  const reject = () =>
    new MediaError(`Tipo de arquivo não aceito. Envie um destes: ${ACCEPTED_FILE_EXTENSIONS.join(", ")}.`, 415);
  if (!FILE_TYPES[ext]) throw reject();

  const image = sniffImage(buffer);
  const isZip = startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  const isOle = startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const matches: Record<string, () => boolean> = {
    pdf: () => ascii(buffer, 0, 5) === "%PDF-",
    png: () => image === "png",
    jpg: () => image === "jpeg",
    jpeg: () => image === "jpeg",
    webp: () => image === "webp",
    gif: () => image === "gif",
    docx: () => isZip,
    xlsx: () => isZip,
    pptx: () => isZip,
    zip: () => isZip,
    doc: () => isOle,
    xls: () => isOle,
    ppt: () => isOle,
    // texto: UTF-8 válido, sem bytes nulos e sem cara de HTML/script
    txt: () => isPlainText(buffer),
    csv: () => isPlainText(buffer),
    otf: () => ascii(buffer, 0, 4) === "OTTO",
    ttf: () => startsWith(buffer, [0x00, 0x01, 0x00, 0x00]) || ascii(buffer, 0, 4) === "true",
    woff: () => ascii(buffer, 0, 4) === "wOFF",
    woff2: () => ascii(buffer, 0, 4) === "wOF2",
  };
  if (!matches[ext]()) {
    throw new MediaError("O conteúdo do arquivo não corresponde à extensão. Envie o arquivo original.", 415);
  }
  return { ext: ext === "jpeg" ? "jpg" : ext, mime: FILE_TYPES[ext] };
}

function isPlainText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

export type ProcessedImage = {
  main: { buffer: Buffer; width: number; height: number };
  variants: { width: number; height: number; buffer: Buffer }[];
  placeholderColor: string;
};

/**
 * Imagem pública do site: valida, corrige a orientação, REMOVE metadados (EXIF/GPS), converte para WebP,
 * limita a 2560px e gera versões menores para `srcset`.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length > IMAGE_MAX_BYTES) throw new MediaError("Imagem grande demais (máximo de 15 MB).", 413);
  if (!sniffImage(input)) {
    throw new MediaError("Formato de imagem não aceito. Envie JPG, PNG, WebP, AVIF ou GIF.", 415);
  }
  try {
    const source = sharp(input, { failOn: "error", limitInputPixels: IMAGE_MAX_PIXELS, animated: false });
    const meta = await source.metadata();
    if (!meta.width || !meta.height || meta.width > IMAGE_MAX_SIDE || meta.height > IMAGE_MAX_SIDE) {
      throw new MediaError("Imagem com dimensões fora do limite (até 12.000 px por lado).", 413);
    }
    // .rotate() sem argumentos aplica a orientação do EXIF; a saída do sharp não carrega metadados.
    const main = await source
      .rotate()
      .resize({ width: MAIN_MAX_SIDE, height: MAIN_MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const variants: ProcessedImage["variants"] = [];
    for (const width of VARIANT_WIDTHS) {
      if (width >= main.info.width) continue;
      const variant = await sharp(main.data).resize({ width }).webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
      variants.push({ width: variant.info.width, height: variant.info.height, buffer: variant.data });
    }

    const { dominant } = await sharp(main.data).stats();
    const hex = (value: number) => value.toString(16).padStart(2, "0");
    return {
      main: { buffer: main.data, width: main.info.width, height: main.info.height },
      variants,
      placeholderColor: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
    };
  } catch (error) {
    if (error instanceof MediaError) throw error;
    throw new MediaError("Não foi possível ler esta imagem. O arquivo pode estar corrompido.", 422);
  }
}

/** Nome original para exibição: sem caminho, sem caracteres de controle/bidi, tamanho limitado. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/["<>|:*?]/g, "")
    .trim()
    .replace(/^\.+/, "");
  return (clean || "arquivo").slice(-120);
}

export type VariantKeys = MediaVariant[];
