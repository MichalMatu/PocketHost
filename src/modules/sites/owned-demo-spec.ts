import { OWNED_DEMO_ID, type DemoVersion } from '../../shared/owned-site.ts';

/** Never adopt or alias an externally discovered service as this owned demo. */
export function assertOwnedDemoId(value: unknown): typeof OWNED_DEMO_ID {
  if (value !== OWNED_DEMO_ID) throw new RangeError('Unknown PocketHost-owned site');
  return OWNED_DEMO_ID;
}

/** No user-supplied HTML, command, document root or port in the first P3 slice. */
export function demoDocument(version: DemoVersion): string {
  if (version !== 1 && version !== 2) throw new RangeError('Unknown demo version');
  const label = version === 1 ? 'First local site' : 'Updated local site';
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>PocketHost test site</title>',
    '<style>body{font-family:system-ui,sans-serif;max-width:55ch;margin:15vh auto;padding:1rem;color:#1d2837}h1{line-height:1.2}</style>',
    '</head><body>',
    '<main><p>PocketHost / managed local test</p>',
    `<h1>${label}</h1><p>Version ${version} · localhost only</p></main>`,
    '</body></html>',
  ].join('\n');
}
