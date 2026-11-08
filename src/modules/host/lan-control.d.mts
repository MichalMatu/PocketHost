export interface LanInterface {
  name: string;
  address: string;
}
export interface LanStatus {
  version: 1;
  mode: 'manual' | 'auto';
  enabled: boolean;
  bind: string | null;
  interfaces: LanInterface[];
  adminUrl: string | null;
  siteUrl: string | null;
}
export function availableLanInterfaces(
  interfaces?: Record<
    string,
    | Array<{
        family: string;
        internal: boolean;
        address: string;
      }>
    | undefined
  >,
): LanInterface[];
export function createLanControl(options?: {
  mode?: 'manual' | 'auto';
  interfaces?: () => LanInterface[];
  start?: (bind: string) => Promise<{ close(): Promise<void> | void }>;
}): {
  status(): LanStatus;
  enable(bind: string): Promise<LanStatus>;
  disable(): Promise<LanStatus>;
};

export interface LanRecoveryHealth {
  state: string;
  checkedAt: string | null;
  recoveredAt: string | null;
  consecutiveFailures: number;
  recoveryCount: number;
  nextRecoveryAt: string | null;
  lastError: string | null;
}
export function createLanRecovery(options: {
  controller: ReturnType<typeof createLanControl>;
  interfaces?: () => LanInterface[];
  check: (bind: string) => Promise<boolean>;
  canRecover?: () => boolean;
  failureThreshold?: number;
  cooldownMs?: number;
  maxCooldownMs?: number;
  now?: () => number;
}): (() => Promise<LanStatus>) & { health(): LanRecoveryHealth };
