import { statSync } from 'node:fs';
import path from 'node:path';

const TERMUX_BIN = '/data/data/com.termux/files/usr/bin';

/** Only fixed, reviewed executables; no shell, arbitrary path or subprocess. */
export const H3_TOOLS = [
  { id: 'restic', executable: 'restic', purpose: 'backup' },
  { id: 'ttyd', executable: 'ttyd', purpose: 'terminal' },
  { id: 'cloudcmd', executable: 'cloudcmd', purpose: 'files' },
  { id: 'termux-api', executable: 'termux-battery-status', purpose: 'android' },
] as const;

export type ToolState = 'detected' | 'not-detected' | 'unavailable';

function fixedProbe(executable: string): ToolState {
  try {
    return statSync(path.join(TERMUX_BIN, executable)).isFile() ? 'detected' : 'not-detected';
  } catch (cause) {
    const code = (cause as { code?: unknown } | null)?.code;
    return code === 'ENOENT' ? 'not-detected' : 'unavailable';
  }
}

export function readTermuxToolInventory(
  probe: (fixedExecutable: string) => ToolState = fixedProbe,
): {
  version: 1;
  mode: 'read-only';
  tools: Array<{ id: string; purpose: string; state: ToolState }>;
} {
  return {
    version: 1,
    mode: 'read-only',
    tools: H3_TOOLS.map(({ id, executable, purpose }) => ({
      id, purpose, state: probe(executable),
    })),
  };
}
