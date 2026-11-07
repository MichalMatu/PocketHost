/** Narrow /proc tree collector. Read callbacks are provided only by the host adapter. */
export interface ManagedDescendant {
  pid: number;
  startTicks: string;
}

export function captureManagedDescendants(
  leaderPid: number,
  readChildren: (pid: number) => string | null,
  readStartTicks: (pid: number) => string | null,
  maxNodes = 64,
): ManagedDescendant[] | null {
  if (
    !Number.isSafeInteger(leaderPid) ||
    leaderPid < 2 ||
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 1 ||
    maxNodes > 256
  ) {
    return null;
  }
  const visited = new Set<number>([leaderPid]);
  const pending = [leaderPid];
  const observed: ManagedDescendant[] = [];
  while (pending.length) {
    const parent = pending.shift();
    if (parent === undefined) return null;
    const raw = readChildren(parent);
    if (raw === null) return null; // Permissions, vanished parent or unreadable /proc.
    if (raw.trim() === '') continue;
    const parts = raw.trim().split(/\s+/);
    for (const value of parts) {
      if (!/^[1-9]\d*$/.test(value)) return null;
      const pid = Number(value);
      if (!Number.isSafeInteger(pid) || pid < 2 || visited.has(pid)) return null;
      visited.add(pid);
      if (observed.length >= maxNodes) return null;
      const ticks = readStartTicks(pid);
      if (!ticks || !/^\d+$/.test(ticks)) return null;
      observed.push({ pid, startTicks: ticks });
      pending.push(pid);
    }
  }
  return observed;
}

/** PID reuse is not proof the old child remains alive; exact ticks are mandatory. */
export function observedDescendantsExited(
  descendants: ReadonlyArray<ManagedDescendant>,
  readStartTicks: (pid: number) => string | null,
): boolean {
  return descendants.every(({ pid, startTicks }) => readStartTicks(pid) !== startTicks);
}
