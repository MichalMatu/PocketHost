/** M2 pure dependency preview. Never reads arbitrary directories or executes npm. */
export interface NodeDependencyPlan {
  readonly status: 'review-required';
  readonly packageName: string;
  readonly packageVersion: string;
  readonly lockfileVersion: 2 | 3;
  readonly dependencyCount: number;
  readonly commands: {
    readonly install: readonly ['npm', 'ci'];
    readonly build: readonly ['npm', 'run', 'build'] | null;
    readonly start: readonly ['npm', 'start'];
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid package or lockfile object');
  }
  return value as Record<string, unknown>;
}

function named(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function dependencyMap(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  const source = record(value);
  if (Object.keys(source).length > 500) throw new Error('Dependency budget exceeded');
  const target: Record<string, string> = {};
  for (const [name, range] of Object.entries(source)) {
    if (
      !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name) ||
      typeof range !== 'string' ||
      range.length > 256 ||
      !range.trim()
    ) {
      throw new Error('Invalid dependency declaration');
    }
    target[name] = range;
  }
  return target;
}

function matchingDependencies(
  packageManifest: Record<string, unknown>,
  lockRoot: Record<string, unknown>,
): number {
  let count = 0;
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const expected = dependencyMap(packageManifest[key]);
    const locked = dependencyMap(lockRoot[key]);
    if (
      Object.keys(expected).length !== Object.keys(locked).length ||
      Object.entries(expected).some(([name, value]) => locked[name] !== value)
    ) {
      throw new Error('package-lock root disagrees with package.json');
    }
    count += Object.keys(expected).length;
  }
  return count;
}

export function planNodeDependencies(
  packageInput: unknown,
  lockInput: unknown,
): NodeDependencyPlan {
  const pkg = record(packageInput);
  const lock = record(lockInput);
  const name = named(pkg.name, 'package name');
  const version = named(pkg.version, 'package version');
  if (typeof lock.lockfileVersion !== 'number' || ![2, 3].includes(lock.lockfileVersion)) {
    throw new Error('npm lockfile v2 or v3 is required');
  }
  const packages = record(lock.packages);
  const root = record(packages['']);
  if (
    lock.name !== name ||
    lock.version !== version ||
    root.name !== name ||
    root.version !== version
  ) {
    throw new Error('Package identity differs from lockfile');
  }
  if (
    pkg.packageManager !== undefined &&
    (typeof pkg.packageManager !== 'string' ||
      !/^npm@[0-9]+(?:\.[0-9]+){0,2}$/.test(pkg.packageManager))
  ) {
    throw new Error('Only an explicit npm package manager is supported');
  }
  const scripts = record(pkg.scripts);
  named(scripts.start, 'start script');
  if (scripts.build !== undefined) named(scripts.build, 'build script');
  const dependencyCount = matchingDependencies(pkg, root);
  return {
    status: 'review-required',
    packageName: name,
    packageVersion: version,
    lockfileVersion: lock.lockfileVersion as 2 | 3,
    dependencyCount,
    commands: {
      install: ['npm', 'ci'],
      build: scripts.build === undefined ? null : ['npm', 'run', 'build'],
      start: ['npm', 'start'],
    },
  };
}

/** Installed versions are probe results, not permission to install or execute. */
export interface NodeToolchainProbe {
  node: string | null;
  npm: string | null;
}
export function reviewNodeToolchain(
  plan: NodeDependencyPlan,
  tools: NodeToolchainProbe,
): {
  status: 'blocked' | 'review-required';
  missingTools: string[];
  conflicts: string[];
  approved: false;
} {
  const missingTools: string[] = [];
  const conflicts: string[] = [];
  for (const name of ['node', 'npm'] as const) {
    const found = tools[name];
    if (found === null) {
      missingTools.push(name);
    } else if (!/^v?\d+\.\d+\.\d+$/.test(found)) {
      throw new Error('Invalid installed tool version');
    }
  }
  const nodeVersion = tools.node ? Number(tools.node.replace(/^v/, '').split('.')[0]) : null;
  if (nodeVersion !== null && nodeVersion < 22) conflicts.push('node-requires-22-or-newer');
  if (
    plan.lockfileVersion === 3 &&
    tools.npm &&
    Number(tools.npm.replace(/^v/, '').split('.')[0]) < 7
  ) {
    conflicts.push('lockfile-requires-npm-7-or-newer');
  }
  return {
    status: missingTools.length || conflicts.length ? 'blocked' : 'review-required',
    missingTools,
    conflicts,
    approved: false,
  };
}
