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
