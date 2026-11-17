/** Strict allowlist for relative assets of PocketHost-owned static releases. */
const ALLOWED_ASSETS = new Set([
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'json',
  'txt',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'wasm',
]);
export function assetName(name: unknown): string {
  if (
    typeof name !== 'string' ||
    name.length > 180 ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.startsWith('/') ||
    /[?#:]/.test(name)
  )
    throw new RangeError('Unsafe asset path');
  const parts = name.split('/');
  const ext = parts.at(-1)?.split('.').at(-1)?.toLowerCase();
  if (
    parts.length > 6 ||
    parts.some((x) => !x || x === '..' || x === '.' || x.startsWith('.')) ||
    !parts.every((x) => /^[\p{L}\p{N}_ ()@+-][\p{L}\p{N}_. ()@+-]*$/u.test(x)) ||
    !ext ||
    !ALLOWED_ASSETS.has(ext)
  )
    throw new RangeError('Asset path denied');
  return name;
}
