/**
 * Vídeos mínimos para os testes do pipeline (não tocam: só têm a ESTRUTURA que a validação confere).
 * Usado só por arquivos *.test.ts.
 */
const box = (type: string, payload: Buffer = Buffer.alloc(0)) => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, payload]);
};

/** MP4 (ISO-BMFF): `ftyp` + `moov` + `mdat`. */
export function mp4Bytes({ brand = "isom" }: { brand?: string } = {}): Buffer {
  const ftyp = box("ftyp", Buffer.concat([Buffer.from(brand, "latin1"), Buffer.from([0, 0, 2, 0]), Buffer.from("isomiso2", "latin1")]));
  return Buffer.concat([ftyp, box("moov", Buffer.alloc(16)), box("mdat", Buffer.alloc(32, 1))]);
}

/** WebM: cabeçalho EBML com DocType + um Segment. */
export function webmBytes({ docType = "webm" }: { docType?: string } = {}): Buffer {
  const doc = Buffer.from(docType, "latin1");
  const ebmlBody = Buffer.concat([
    Buffer.from([0x42, 0x86, 0x81, 0x01]), // EBMLVersion 1
    Buffer.from([0x42, 0x82, 0x80 | doc.length]), // DocType
    doc,
    Buffer.from([0x42, 0x87, 0x81, 0x04]), // DocTypeVersion 4
  ]);
  const ebml = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80 | ebmlBody.length]), ebmlBody]);
  const segment = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67, 0x88]), Buffer.alloc(8, 2)]);
  return Buffer.concat([ebml, segment]);
}
