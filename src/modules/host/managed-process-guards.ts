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
