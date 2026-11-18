import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MediaError, processImage, sanitizeFileName, sniffFile, sniffImage } from "./process";
import { isValidStorageKey, mainKeyOf } from "./storage";

describe("chaves de armazenamento", () => {
  it("aceita só o formato gerado pelo sistema", () => {
    expect(isValidStorageKey("pub/2026/11/0123456789abcdef01234567.webp")).toBe(true);
    expect(isValidStorageKey("pub/2026/11/0123456789abcdef01234567-960.webp")).toBe(true);
    expect(isValidStorageKey("priv/2026/01/0123456789abcdef01234567.pdf")).toBe(true);
  });
  it("recusa path traversal e formatos estranhos", () => {
    for (const key of [
      "../../etc/passwd",
      "pub/../../etc/passwd",
      "pub/2026/11/../../../x.webp",
      "pub/2026/13/0123456789abcdef01234567.webp",
      "pub/2026/11/0123456789ABCDEF01234567.webp",
      "pub/2026/11/0123456789abcdef01234567.webp/../x",
      "/pub/2026/11/0123456789abcdef01234567.webp",
      "pub\\2026\\11\\0123456789abcdef01234567.webp",
      "pub/2026/11/0123456789abcdef01234567.webp\0.png",
      "outro/2026/11/0123456789abcdef01234567.webp",
      "",
    ]) {
      expect(isValidStorageKey(key), key).toBe(false);
    }
  });
  it("acha a chave principal de uma versão", () => {
    expect(mainKeyOf("pub/2026/11/0123456789abcdef01234567-960.webp")).toBe("pub/2026/11/0123456789abcdef01234567.webp");
    expect(mainKeyOf("pub/2026/11/0123456789abcdef01234567.webp")).toBe("pub/2026/11/0123456789abcdef01234567.webp");
  });
});

describe("detecção de tipo pelo conteúdo", () => {
  const pdf = Buffer.from("%PDF-1.7\n...");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  it("não trata SVG/HTML como imagem", () => {
    expect(sniffImage(svg)).toBeNull();
    expect(sniffImage(Buffer.from("<html><body>oi</body></html>"))).toBeNull();
  });
  it("exige que conteúdo e extensão combinem", () => {
    expect(sniffFile(pdf, "contrato.pdf")).toEqual({ ext: "pdf", mime: "application/pdf" });
    expect(() => sniffFile(Buffer.from("isto é texto"), "foto.jpg")).toThrow(MediaError);
    expect(() => sniffFile(pdf, "planilha.xlsx")).toThrow(MediaError);
    expect(() => sniffFile(svg, "logo.svg")).toThrow(MediaError);
    expect(() => sniffFile(Buffer.from("MZ\x90\x00"), "programa.exe")).toThrow(MediaError);
    expect(() => sniffFile(Buffer.from("<script>alert(1)</script>"), "pagina.html")).toThrow(MediaError);
  });
  it("aceita texto simples só quando é texto de verdade", () => {
    expect(sniffFile(Buffer.from("nome;valor\nAna;10"), "lista.csv").mime).toContain("text/csv");
    expect(() => sniffFile(Buffer.from([0x00, 0x01, 0x02, 0xff]), "notas.txt")).toThrow(MediaError);
  });
});

describe("nome original", () => {
  it("remove caminho, caracteres de controle e truques de direção de texto", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\ana\\contrato final.pdf")).toBe("contrato final.pdf");
    expect(sanitizeFileName("fatura\u202Efdp.exe")).toBe("faturafdp.exe");
    expect(sanitizeFileName("a\r\nb.pdf")).toBe("ab.pdf");
    expect(sanitizeFileName("")).toBe("arquivo");
  });
});

describe("processamento de imagem", () => {
  it("converte para WebP sem metadados, limita o tamanho e gera versões", async () => {
    const input = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#3B1F8E" } })
      .withExif({ IFD0: { Copyright: "segredo" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 33/1 0/1" } })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await processImage(input);
    const meta = await sharp(result.main.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(result.main.width).toBe(2560);
    expect(result.variants.map((variant) => variant.width)).toEqual([480, 960, 1600]);
    expect(result.placeholderColor).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("não amplia imagens pequenas", async () => {
    const input = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#C6F432" } }).png().toBuffer();
    const result = await processImage(input);
    expect(result.main.width).toBe(600);
    expect(result.variants.map((variant) => variant.width)).toEqual([480]);
  });
  it("recusa o que não é imagem e arquivos corrompidos", async () => {
    await expect(processImage(Buffer.from("<svg></svg>"))).rejects.toThrow(MediaError);
    await expect(processImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(200)]))).rejects.toThrow(MediaError);
  });
});
