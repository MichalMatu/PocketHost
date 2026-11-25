export interface QuickTunnelStatus {
  siteId: string | null;
  state: 'stopped' | 'starting' | 'url-assigned' | 'stopping' | 'failed' | 'unknown';
  url: string | null;
  reason: string | null;
}

export interface QuickTunnelController {
  status(): QuickTunnelStatus;
  start(siteId: string): Promise<QuickTunnelStatus>;
  stop(siteId: string): Promise<QuickTunnelStatus>;
}

export class QuickTunnelSession implements QuickTunnelController {
  constructor();
  status(): QuickTunnelStatus;
  start(siteId: string): Promise<QuickTunnelStatus>;
  stop(siteId: string): Promise<QuickTunnelStatus>;
}

export function quickTunnelUrl(line: unknown): string | null;
