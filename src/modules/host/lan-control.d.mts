export interface LanInterface { name: string; address: string }
export interface LanStatus {
  version: 1;
  mode: "manual";
  enabled: boolean;
  bind: string | null;
  interfaces: LanInterface[];
  adminUrl: string | null;
  siteUrl: string | null;
}
export function availableLanInterfaces(interfaces?: Record<string, Array<{
  family: string;
  internal: boolean;
  address: string;
}> | undefined>): LanInterface[];
export function createLanControl(): {
  status(): LanStatus;
  enable(bind: string): Promise<LanStatus>;
  disable(): Promise<LanStatus>;
};
