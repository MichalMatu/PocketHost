/** M2 pure dependency preview. Never reads arbitrary directories or executes npm. */
export interface NodeDependencyPlan {
  readonly status: 'review-required';
  readonly packageName: string;
  readonly packageVersion: string;
  readonly lockfileVersion: 2 | 3;
  readonly dependencyCount: number;
  readonly requiredNodeMajor: number;
  readonly requiredNodeVersion: string;
  readonly requiredNpmVersion: string | null;
  readonly lockReview: {
    readonly lockedPackages: number;
    readonly missingDirectEntries: readonly string[];
    readonly unreviewedSources: readonly string[];
    readonly installScripts: readonly string[];
  };
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

function lockEntryPath(name: string): boolean {
  if (
    name.length > 240 ||
    name.startsWith('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.includes('..')
  )
    return false;
  const parts = name.split('/');
  let index = 0;
  while (index < parts.length) {
    if (parts[index++] !== 'node_modules') return false;
    const packageName = parts[index++];
    if (!packageName) return false;
    if (packageName.startsWith('@')) {
      if (!/^@[a-z0-9._-]+$/.test(packageName) || !/^[a-z0-9._-]+$/.test(parts[index++] ?? ''))
        return false;
    } else if (!/^[a-z0-9._-]+$/.test(packageName)) {
      return false;
    }
  }
  return true;
}
function reviewLockfile(
  packages: Record<string, unknown>,
  root: Record<string, unknown>,
): NodeDependencyPlan['lockReview'] {
  const names = Object.keys(packages);
  if (names.length > 501) throw new Error('Lockfile package budget exceeded');
  const direct = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(dependencyMap(root[field]))) direct.add(name);
  }
  const missingDirectEntries = [...direct]
    .filter((name) => !Object.hasOwn(packages, 'node_modules/' + name))
    .sort();
  const unreviewedSources: string[] = [];
  const installScripts: string[] = [];
  for (const [name, input] of Object.entries(packages)) {
    if (name === '') continue;
    if (!lockEntryPath(name)) {
      unreviewedSources.push(name.slice(0, 160));
      continue;
    }
    const entry = record(input);
    if (entry.hasInstallScript === true) installScripts.push(name);
    const resolved = entry.resolved;
    const integrity = entry.integrity;
    if (
      entry.link === true ||
      typeof resolved !== 'string' ||
      !resolved.startsWith('https://registry.npmjs.org/') ||
      typeof integrity !== 'string' ||
      !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity)
    ) {
      unreviewedSources.push(name);
    }
  }
  return {
    lockedPackages: names.length - 1,
    missingDirectEntries,
    unreviewedSources,
    installScripts,
  };
}
function normalizedVersion(value: string): string {
  const match = /^(0|[1-9][0-9]{0,2})(?:\.(0|[1-9][0-9]{0,2}))?(?:\.(0|[1-9][0-9]{0,2}))?$/.exec(
    value,
  );
  if (!match) throw new Error('Invalid explicit tool version');
  const parts = [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
  if (parts.some((part) => part > 1000)) throw new Error('Unsupported tool version');
  return parts.join('.');
}
function compareVersions(a: string, b: string): number {
  const left = a.replace(/^v/, '').split('.').map(Number);
  const right = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}
function nodeEngineRequirement(value: unknown): string {
  if (value === undefined) return '22.0.0';
  const engines = record(value);
  const range = engines.node;
  if (range === undefined) return '22.0.0';
  if (typeof range !== 'string' || !range.startsWith('>='))
    throw new Error('Node engine range requires explicit >=major');
  const version = normalizedVersion(range.slice(2));
  return compareVersions(version, '22.0.0') < 0 ? '22.0.0' : version;
}
function npmVersionRequirement(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !value.startsWith('npm@'))
    throw new Error('Only an explicit npm package manager is supported');
  return normalizedVersion(value.slice(4));
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
  const requiredNpmVersion = npmVersionRequirement(pkg.packageManager);
  const scripts = record(pkg.scripts);
  named(scripts.start, 'start script');
  if (scripts.build !== undefined) named(scripts.build, 'build script');
  const dependencyCount = matchingDependencies(pkg, root);
  const lockReview = reviewLockfile(packages, root);
  const requiredNodeVersion = nodeEngineRequirement(pkg.engines);
  const requiredNodeMajor = Number(requiredNodeVersion.split('.')[0]);
  return {
    status: 'review-required',
    packageName: name,
    packageVersion: version,
    lockfileVersion: lock.lockfileVersion as 2 | 3,
    dependencyCount,
    lockReview,
    requiredNodeMajor,
    requiredNodeVersion,
    requiredNpmVersion,
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
  if (tools.node && compareVersions(tools.node, plan.requiredNodeVersion) < 0) {
    const required = plan.requiredNodeVersion.replace(/(?:\.0){1,2}$/, '');
    conflicts.push('node-requires-' + required + '-or-newer');
  }
  if (
    tools.npm &&
    plan.requiredNpmVersion &&
    compareVersions(tools.npm, plan.requiredNpmVersion) < 0
  ) {
    conflicts.push('npm-requires-' + plan.requiredNpmVersion + '-or-newer');
  }
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
