/** Pure process identity checks shared by app-specific host adapters. */
export interface ManagedProcessIdentity {
  pid: number;
  startTicks: string;
  executable: string;
  cwd: string;
  argvSha256: string;
}

export function attestsManagedProcess(
  expected: ManagedProcessIdentity,
  observed: ManagedProcessIdentity | null,
): boolean {
  return (
    observed !== null &&
    Number.isSafeInteger(expected.pid) &&
    expected.pid > 1 &&
    /^\d+$/.test(expected.startTicks) &&
    /^[a-f0-9]{64}$/.test(expected.argvSha256) &&
    expected.executable.length > 0 &&
    expected.cwd.length > 0 &&
    observed.pid === expected.pid &&
    observed.startTicks === expected.startTicks &&
    observed.executable === expected.executable &&
    observed.cwd === expected.cwd &&
    observed.argvSha256 === expected.argvSha256
  );
}

/** Never clear a process marker when any known descendant may be an orphan. */
export function safeStopEvidence(evidence: {
  leaderExited: boolean;
  portReleased: boolean;
  descendantsExited: boolean;
}): boolean {
  return (
    evidence.leaderExited === true &&
    evidence.portReleased === true &&
    evidence.descendantsExited === true
  );
}

/**
 * A missing leader PID does not prove an empty PRoot process group.
 * Inaccessible/ambiguous group status always fails closed.
 */
export function processGroupAbsent(
  leaderPid: number,
  observe: (groupId: number) => 'absent' | 'present' | 'unknown',
): boolean {
  return Number.isSafeInteger(leaderPid) && leaderPid > 1 && observe(leaderPid) === 'absent';
}

/**
 * A marker is a live ownership/cleanup obligation until whole-instance
 * termination is proven. A missing leader PID is not a stopped runtime.
 */
export function classifyManagedProcessState(
  markerPresent: boolean,
  ownedProcessAttested: boolean,
): 'stopped' | 'running' | 'unknown' {
  if (!markerPresent) return 'stopped';
  return ownedProcessAttested ? 'running' : 'unknown';
}
