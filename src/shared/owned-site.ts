/** P3: one narrowly scoped, explicitly created PocketHost instance. */
export const OWNED_DEMO_ID = 'pockethost-demo' as const;
export type OwnedDemoId = typeof OWNED_DEMO_ID;
export type DemoVersion = 1 | 2;
export type DemoState = 'absent' | 'stopped' | 'running' | 'unknown';

/** Durable bounded history for one explicitly owned demonstration site. */
export interface OwnedDemoDeployment {
  at: string;
  action: 'create' | 'publish' | 'rollback';
  from: DemoVersion | null;
  to: DemoVersion;
}

export interface OwnedDemoProject {
  id: OwnedDemoId;
  name: 'PocketHost Demo';
  description: string;
  type: 'static-html';
  dataDirectory: 'PocketHost-OwnedSites/pockethost-demo';
  state: DemoState;
  port: number;
  url: string;
  contentVersion: DemoVersion | null;
  previousVersion: DemoVersion | null;
  pid: number | null;
  startTicks: string | null;
  history: ReadonlyArray<OwnedDemoDeployment>;
}

export interface OwnedSiteSnapshot {
  version: 1;
  id: OwnedDemoId;
  ownership: 'none' | 'pockethost';
  state: DemoState;
  port: number;
  url: string;
  contentVersion: DemoVersion | null;
  previousVersion: DemoVersion | null;
  canRollback: boolean;
}

/**
 * Lifecycle side effects MUST be implemented by the sole host adapter.
 * The runtime and UI cannot execute commands or touch host files.
 */
export interface OwnedSitePort {
  inspect(): OwnedSiteSnapshot;
  create(): OwnedSiteSnapshot;
  start(): Promise<OwnedSiteSnapshot>;
  stop(): Promise<OwnedSiteSnapshot>;
  publish(version: DemoVersion): OwnedSiteSnapshot;
  rollback(): OwnedSiteSnapshot;
  readLogs(): ReadonlyArray<string>;
}

/** Built-in legacy demo release; preserve the host's existing HTML bytes. */
export function demoDocument(version: DemoVersion): string {
  if (version !== 1 && version !== 2) throw new RangeError('Unknown demo version');
  const label = version === 1 ? 'First local site' : 'Updated local site';
  return [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>PocketHost test site</title></head><body>',
    '<main style="font-family:system-ui;max-width:55ch;margin:15vh auto;padding:1rem">',
    `<h1>${label}</h1><p>PocketHost managed demo · v${version} · loopback only.</p></main>`,
    '</body></html>',
  ].join('\n');
}
