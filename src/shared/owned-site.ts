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
