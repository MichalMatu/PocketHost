import { inflateRawSync } from 'node:zlib';

export const MAX_SITE_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
export const MAX_SITE_FILES = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const allowedExtensions = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'json', 'txt', 'svg', 'png',
  'jpg', 'jpeg', 'webp', 'gif', 'ico', 'woff', 'woff2', 'ttf', 'otf', 'wasm',
]);

export interface SiteBundleFile {
  name: string;
  bytes: Buffer;
}

function safeName(input: string): string {
  if (
    !input ||
    input.length > 180 ||
    input.includes('\\') ||
    input.includes('\0') ||
    input.startsWith('/') ||
    /[?#:]/.test(input)
  ) throw new RangeError('Invalid uploaded file path');
  const parts = input.split('/');
  if (
    parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.')) ||
    parts.length > 6 ||
    !parts.every((part) => /^[\p{L}\p{N}_ ()@+-][\p{L}\p{N}_. ()@+-]*$/u.test(part))
  ) throw new RangeError('Unsafe uploaded file path');
  const extension = parts.at(-1)?.split('.').at(-1)?.toLowerCase();
  if (!extension || !allowedExtensions.has(extension)) {
    throw new RangeError('Unsupported static asset extension');
  }
  return input;
}

export function validateSiteBundle(files: ReadonlyArray<SiteBundleFile>): SiteBundleFile[] {
  if (!files.length || files.length > MAX_SITE_FILES) throw new RangeError('Site file count exceeded');
  const items = files.map(({ name, bytes }) => ({ name: safeName(name), bytes }));
  if (!items.some((item) => item.name === 'index.html')) {
    const first = items[0].name.split('/')[0];
    if (items.every((item) => item.name.startsWith(first + '/'))) {
      for (const item of items) item.name = safeName(item.name.slice(first.length + 1));
    }
  }
  const seen = new Set<string>();
  let total = 0;
  for (const item of items) {
    if (!Buffer.isBuffer(item.bytes) || item.bytes.length > MAX_FILE_BYTES)
      throw new RangeError('Site asset too large');
    total += item.bytes.length;
    if (total > MAX_SITE_BYTES) throw new RangeError('Total extracted site too large');
    const folded = item.name.toLowerCase();
    if (seen.has(folded)) throw new RangeError('Duplicate uploaded file path');
    seen.add(folded);
  }
  if (!seen.has('index.html') || !items.find((item) => item.name === 'index.html')?.bytes.length)
    throw new RangeError('Site requires a nonempty root index.html');
  return items;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Parse only bounded classic ZIP with central directory; never shell out or extract paths. */
export function decodeSiteZip(zip: Buffer): SiteBundleFile[] {
  if (!Buffer.isBuffer(zip) || zip.length > MAX_UPLOAD_BYTES || zip.length < 22)
    throw new RangeError('Invalid or oversized ZIP');
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0 || zip.readUInt16LE(eocd + 4) !== 0 ||
      zip.readUInt16LE(eocd + 6) !== 0 ||
      zip.readUInt16LE(eocd + 8) !== zip.readUInt16LE(eocd + 10))
    throw new RangeError('Unsupported ZIP archive');
  const count = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const offset = zip.readUInt32LE(eocd + 16);
  if (!count || count > MAX_SITE_FILES + 30 || centralSize === 0xffffffff ||
      offset === 0xffffffff || offset + centralSize > eocd)
    throw new RangeError('ZIP directory out of range');
  const files: SiteBundleFile[] = [];
  let cursor = offset;
  let extracted = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > offset + centralSize || zip.readUInt32LE(cursor) !== 0x02014b50)
      throw new RangeError('Invalid ZIP directory entry');
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const expectedCrc = zip.readUInt32LE(cursor + 16);
    const compressed = zip.readUInt32LE(cursor + 20);
    const expanded = zip.readUInt32LE(cursor + 24);
    const nameLen = zip.readUInt16LE(cursor + 28);
    const extraLen = zip.readUInt16LE(cursor + 30);
    const commentLen = zip.readUInt16LE(cursor + 32);
    const mode = zip.readUInt32LE(cursor + 38) >>> 16;
    const location = zip.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLen + extraLen + commentLen;
    if (next > offset + centralSize || (flags & 1) || (flags & 0x40) ||
        ![0, 8].includes(method) || compressed === 0xffffffff ||
        expanded === 0xffffffff || expanded > MAX_FILE_BYTES ||
        location >= offset || (mode & 0o170000) === 0o120000)
      throw new RangeError('Unsupported or unsafe ZIP entry');
    const filename = zip.toString('utf8', cursor + 46, cursor + 46 + nameLen);
    cursor = next;
    if (filename.endsWith('/')) continue;
    safeName(filename);
    if (location + 30 > offset || zip.readUInt32LE(location) !== 0x04034b50)
      throw new RangeError('Invalid ZIP local header');
    if (zip.readUInt16LE(location + 8) !== method)
      throw new RangeError('ZIP compression header mismatch');
    const localLen = zip.readUInt16LE(location + 26);
    const localExtra = zip.readUInt16LE(location + 28);
    const begin = location + 30 + localLen + localExtra;
    if (begin + compressed > offset ||
        zip.toString('utf8', location + 30, location + 30 + localLen) !== filename)
      throw new RangeError('ZIP local entry out of bounds');
    extracted += expanded;
    if (extracted > MAX_SITE_BYTES || files.length >= MAX_SITE_FILES)
      throw new RangeError('ZIP extraction budget exceeded');
    const bytes = method === 0
      ? Buffer.from(zip.subarray(begin, begin + compressed))
      : inflateRawSync(zip.subarray(begin, begin + compressed), { maxOutputLength: MAX_FILE_BYTES + 1 });
    if (bytes.length !== expanded || crc32(bytes) !== expectedCrc)
      throw new RangeError('ZIP data integrity mismatch');
    files.push({ name: filename, bytes });
  }
  if (cursor !== offset + centralSize) throw new RangeError('Unexpected ZIP directory content');
  return validateSiteBundle(files);
}

/** Browser folder picker sends only bounded base64 assets, never host paths. */
export function decodeSiteFolder(value: unknown): SiteBundleFile[] {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RangeError('Invalid folder payload');
  const root = value as Record<string, unknown>;
  if (Object.keys(root).length !== 1 || !Array.isArray(root.files) ||
      root.files.length > MAX_SITE_FILES)
    throw new RangeError('Invalid folder file list');
  const files = root.files.map((record: unknown) => {
    if (!record || typeof record !== 'object' || Array.isArray(record))
      throw new RangeError('Invalid folder file');
    const item = record as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || typeof item.name !== 'string' ||
        typeof item.base64 !== 'string' || item.base64.length > MAX_FILE_BYTES * 1.4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64))
      throw new RangeError('Invalid base64 asset');
    return { name: safeName(item.name), bytes: Buffer.from(item.base64, 'base64') };
  });
  return validateSiteBundle(files);
}
