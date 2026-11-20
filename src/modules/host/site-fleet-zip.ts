import { assetName } from './site-asset-validation.ts';

/**
 * One bounded, import-compatible ZIP archive containing owned static assets.
 * STORE avoids external binaries, build-time dependencies and lossy conversions.
 * This is an export, not a durable backup or independent restore proof.
 */
export function packStaticZip(files: ReadonlyArray<{ name: string; bytes: Buffer }>): Buffer {
  if (!files.length || files.length > 100) throw new RangeError('ZIP file count out of bounds');
  const names = new Set<string>();
  let total = 0;
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = assetName(file.name);
    const lower = name.toLowerCase();
    if (names.has(lower)) throw new RangeError('Duplicate ZIP entry');
    names.add(lower);
    if (!Buffer.isBuffer(file.bytes) || file.bytes.length > 2 * 1024 * 1024 ||
        (total += file.bytes.length) > 8 * 1024 * 1024) {
      throw new RangeError('ZIP content budget exceeded');
    }
    const encoded = Buffer.from(name, 'utf8');
    if (encoded.length > 65535) throw new RangeError('ZIP filename too long');
    const crc = checksum(file.bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // ZIP 2.0 minimum
    header.writeUInt16LE(0x0800, 6); // UTF-8
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(file.bytes.length, 18);
    header.writeUInt32LE(file.bytes.length, 22);
    header.writeUInt16LE(encoded.length, 26);
    local.push(header, encoded, file.bytes);

    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50, 0);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x0800, 8);
    index.writeUInt32LE(crc, 16);
    index.writeUInt32LE(file.bytes.length, 20);
    index.writeUInt32LE(file.bytes.length, 24);
    index.writeUInt16LE(encoded.length, 28);
    index.writeUInt32LE(offset, 42);
    central.push(index, encoded);
    offset += header.length + encoded.length + file.bytes.length;
  }
  const centralLength = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralLength, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end], offset + centralLength + end.length);
}

function checksum(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) {
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}
