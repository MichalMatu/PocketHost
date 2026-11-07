import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import {
  decodeSiteZip, decodeSiteFolder, validateSiteBundle,
  MAX_SITE_BYTES, MAX_SITE_FILES,
} from '../../src/modules/sites/site-bundle.ts';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function archive(entries) {
  const localParts = [];
  const centralParts = [];
  let position = 0;
  for (const entry of entries) {
    const filename = Buffer.from(entry.name);
    const bytes = Buffer.from(entry.bytes ?? '');
    const method = entry.method ?? 8;
    const compressed = method === 0 ? bytes : deflateRawSync(bytes);
    const checksum = entry.badCrc ? 999 : crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(3 << 8, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(position, 42);
    localParts.push(local, filename, compressed);
    centralParts.push(central, filename);
    position += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(position, 16);
  return Buffer.concat([...localParts, directory, end]);
}
const index = '<!doctype html><h1>My own site</h1>';

test('H2 ZIP: deflated and stored files, nested assets and one common root', () => {
  const zip = archive([
    { name: 'MySite/index.html', bytes: index },
    { name: 'MySite/css/site.css', bytes: 'body{color:red}', method: 0 },
  ]);
  const files = decodeSiteZip(zip);
  assert.deepEqual(files.map(file => file.name), ['index.html', 'css/site.css']);
  assert.equal(files[0].bytes.toString(), index);
  assert.equal(files[1].bytes.toString(), 'body{color:red}');
});

test('H2 ZIP: rejects traversal, absolute, hidden, backslash, unsupported formats', () => {
  for (const name of [
    '../outside.html', '/etc/passwd', '.private.html', 'a/../index.html',
    'a\\index.html', 'index.php', 'a//index.html', 'C:/index.html',
  ]) {
    assert.throws(() => decodeSiteZip(archive([
      { name: 'index.html', bytes: index }, { name, bytes: 'foreign' },
    ])), /Unsafe|Unsupported|Invalid/);
  }
});

test('H2 ZIP: rejects Unix symlinks, bad CRC, duplicate case folded assets', () => {
  assert.throws(() => decodeSiteZip(archive([
    { name: 'index.html', bytes: index },
    { name: 'css/link.css', bytes: 'outside', mode: 0o120777 },
  ])), /unsafe/i);
  assert.throws(() => decodeSiteZip(archive([
    { name: 'index.html', bytes: index, badCrc: true },
  ])), /integrity/);
  assert.throws(() => decodeSiteZip(archive([
    { name: 'index.html', bytes: index },
    { name: 'INDEX.HTML', bytes: 'forged' },
  ])), /Duplicate/);
});

test('H2 ZIP: rejects corrupt offsets, oversized file, inflated budget and missing index', () => {
  const broken = archive([{ name: 'index.html', bytes: index }]);
  const directoryOffset = broken.readUInt32LE(broken.length - 6);
  broken.writeUInt32LE(0xffffff00, directoryOffset + 42);
  assert.throws(() => decodeSiteZip(broken), /out of bounds|local header|unsafe ZIP entry/i);
  assert.throws(() => decodeSiteZip(archive([
    { name: 'index.html', bytes: Buffer.alloc(2 * 1024 * 1024 + 1) },
  ])), /unsafe|size|ZIP entry/i);
  assert.throws(() => decodeSiteZip(archive([
    { name: 'site.html', bytes: index },
  ])), /index.html/);
  assert.throws(() => validateSiteBundle(Array.from({ length: MAX_SITE_FILES + 1 },
    (_, i) => ({ name: 'asset' + i + '.css', bytes: Buffer.from('x') }))), /count/);
  assert.ok(MAX_SITE_BYTES > 4 * 1024 * 1024);
});

test('H2 ZIP: never accepts executable or malformed classic-ZIP variants', () => {
  const original = archive([{ name: 'index.html', bytes: index }]);
  assert.throws(() => decodeSiteZip(Buffer.from('not an archive')), /Invalid/);
  const multi = Buffer.from(original);
  multi.writeUInt16LE(1, multi.length - 22 + 4);
  assert.throws(() => decodeSiteZip(multi), /Unsupported/);
  const encrypted = Buffer.from(original);
  const offset = encrypted.readUInt32LE(encrypted.length - 6);
  encrypted.writeUInt16LE(1, offset + 8);
  assert.throws(() => decodeSiteZip(encrypted), /unsafe/);
});

test('H2 folder: accept browser base64 and collapse common folder root', () => {
  const files = decodeSiteFolder({
    files: [
      { name: 'site/index.html', base64: Buffer.from(index).toString('base64') },
      { name: 'site/assets/app.js', base64: Buffer.from('console.log("site")').toString('base64') },
    ],
  });
  assert.deepEqual(files.map(f => f.name), ['index.html', 'assets/app.js']);
});

test('H2 folder: reject arbitrary fields, path injection and malformed base64', () => {
  assert.throws(() => decodeSiteFolder({ files: [], command: 'start' }), /Invalid/);
  assert.throws(() => decodeSiteFolder({ files: [
    { name: '../index.html', base64: Buffer.from(index).toString('base64') },
  ] }), /Unsafe/);
  assert.throws(() => decodeSiteFolder({ files: [
    { name: 'index.html', base64: 'BAD@' },
  ] }), /base64/);
  assert.throws(() => decodeSiteFolder({ files: [
    { name: 'index.html', base64: '', path: '/etc' },
  ] }), /base64/);
});

test('H2 static assets are strict and empty index is never a valid release', () => {
  assert.throws(() => validateSiteBundle([{ name: 'index.html', bytes: Buffer.alloc(0) }]), /index.html/);
  assert.throws(() => validateSiteBundle([
    { name: 'index.html', bytes: Buffer.from(index) },
    { name: 'readme.sh', bytes: Buffer.from('echo owned') },
  ]), /Unsupported/);
  assert.throws(() => validateSiteBundle([
    { name: 'index.html', bytes: Buffer.from(index) },
    { name: 'index.html', bytes: Buffer.from(index) },
  ]), /Duplicate/);
});
