import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

/** Every entry is externally owned. No status probe confers management rights. */
export const SERVICE_CATALOG = [
  { id: "ilestoi", label: "IleStoi.pl", runit: "wreckscanner" },
  { id: "tunnel", label: "Cloudflare tunnel", runit: "cloudflared" },
  { id: "ssh", label: "SSH server", runit: "sshd" },
  { id: "mqtt", label: "MQTT broker", runit: "mosquitto" },
  { id: "healthwatch", label: "IleStoi healthwatch", runit: "ilestoi-healthwatch" },
] as const;

export type ServiceState = "running" | "stopped" | "unknown";

export interface HostSnapshot {
  version: 1;
  mode: "read-only";
  platform: "termux";
  observedAt: string;
  runtime: {
    nodeVersion: string;
    architecture: string;
    systemUptimeSeconds: number;
    totalMemoryMiB: number;
    freeMemoryMiB: number;
  };
  services: Array<{
    id: string;
    label: string;
    ownership: "external";
    state: ServiceState;
  }>;
}

const TERMUX_PREFIX = "/data/data/com.termux/files/usr";
const MAX_STATUS_OUTPUT = 2048;

export function parseRunitStatus(output: string | null | undefined): ServiceState {
  if (typeof output !== "string") return "unknown";
  if (output.startsWith("run: ")) return "running";
  if (output.startsWith("down: ")) return "stopped";
  return "unknown";
}

function runApprovedSvStatus(serviceName: string): string | null {
  const binary = path.join(TERMUX_PREFIX, "bin", "sv");
  const servicePath = path.join(TERMUX_PREFIX, "var", "service", serviceName);
  try {
    const result = spawnSync(binary, ["status", servicePath], {
      encoding: "utf8",
      shell: false,
      timeout: 1200,
      maxBuffer: MAX_STATUS_OUTPUT,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return typeof result.stdout === "string" ? result.stdout.slice(0, MAX_STATUS_OUTPUT) : null;
  } catch {
    return null;
  }
}

/** Reject unknown identifiers *before* any command can be executed. */
export function probeServiceState(
  id: string,
  readStatus: (serviceName: string) => string | null = runApprovedSvStatus,
): ServiceState {
  const service = SERVICE_CATALOG.find((item) => item.id === id);
  if (!service) throw new RangeError("Service is not on the inspection allowlist");
  return parseRunitStatus(readStatus(service.runit));
}

/** No request data, shell fragments, paths, environment or secret values appear in output. */
export function readHostSnapshot(
  readState: (id: string) => ServiceState = probeServiceState,
  observedAt: () => string = () => new Date().toISOString(),
): HostSnapshot {
  return {
    version: 1,
    mode: "read-only",
    platform: "termux",
    observedAt: observedAt(),
    runtime: {
      nodeVersion: process.version,
      architecture: process.arch,
      systemUptimeSeconds: Math.floor(os.uptime()),
      totalMemoryMiB: Math.floor(os.totalmem() / 1048576),
      freeMemoryMiB: Math.floor(os.freemem() / 1048576),
    },
    services: SERVICE_CATALOG.map((service) => ({
      id: service.id,
      label: service.label,
      ownership: "external" as const,
      state: readState(service.id),
    })),
  };
}
