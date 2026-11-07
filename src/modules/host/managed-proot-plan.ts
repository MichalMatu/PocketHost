import path from 'node:path';

export interface ManagedProotBind {
  source: string;
  target: string;
}

/**
 * Generic argv builder; it does not approve a runtime or execute anything.
 * The calling app adapter must establish canonical directories and ownership.
 */
export function buildManagedProotArgs(spec: {
  rootfs: string;
  binds: ReadonlyArray<ManagedProotBind>;
  workdir: string;
  command: ReadonlyArray<string>;
}): string[] {
  const hostPath = (value: string): boolean =>
    path.isAbsolute(value) &&
    value.length < 4096 &&
    !/[:\n\r\0]/.test(value) &&
    path.normalize(value) === value;
  if (
    !hostPath(spec.rootfs) ||
    !/^\/mnt\/[a-z][a-z0-9-]*$/.test(spec.workdir) ||
    spec.binds.length < 1 ||
    spec.binds.length > 16 ||
    spec.command.length < 1 ||
    spec.command.length > 64 ||
    !spec.command[0]?.startsWith('/') ||
    spec.command.some((arg) => typeof arg !== 'string' || /[\n\r\0]/.test(arg))
  ) {
    throw new Error('Unsafe managed PRoot launch plan');
  }
  const targets = new Set<string>();
  const args = ['-R', spec.rootfs];
  for (const bind of spec.binds) {
    if (
      !hostPath(bind.source) ||
      !/^\/mnt\/[a-z][a-z0-9-]*$/.test(bind.target) ||
      targets.has(bind.target)
    ) {
      throw new Error('Unsafe managed PRoot bind');
    }
    targets.add(bind.target);
    args.push('-b', bind.source + ':' + bind.target);
  }
  if (!targets.has(spec.workdir)) {
    throw new Error('PRoot workdir must use an owned workset bind');
  }
  return [...args, '-w', spec.workdir, ...spec.command];
}
