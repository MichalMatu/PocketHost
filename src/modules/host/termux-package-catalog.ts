import path from 'node:path';
import { executeFixed, type Exec } from './termux-admin.ts';
import { parseInstalledPackages } from './observability-probes.ts';

const BIN = '/data/data/com.termux/files/usr/bin';
const MAX_INSTALLED = 700;
const MAX_AVAILABLE = 60;

export interface InstalledTermuxPackage {
  name: string;
  version: string;
}
export interface AvailableTermuxPackage {
  name: string;
  description: string;
}

export async function listInstalledTermuxPackages(
  run: Exec = executeFixed,
): Promise<{ packages: InstalledTermuxPackage[]; truncated: boolean }> {
  const result = await run(
    path.join(BIN, 'dpkg-query'),
    ['-W', '-f=${binary:Package}\\t${Version}\\n'],
    { timeout: 16000, maxBuffer: 192000, outputLimit: 185000 },
  );
  const packages = parseInstalledPackages(result.output, MAX_INSTALLED + 1).map((item) => ({
    name: item.name,
    version: item.version,
  }));
  return {
    packages: packages.slice(0, MAX_INSTALLED).sort((a, b) => a.name.localeCompare(b.name)),
    truncated: packages.length > MAX_INSTALLED,
  };
}

export async function searchAvailableTermuxPackages(
  query: string,
  run: Exec = executeFixed,
): Promise<{ query: string; packages: AvailableTermuxPackage[]; truncated: boolean }> {
  if (typeof query !== 'string' || !/^[a-z0-9][a-z0-9+.-]{0,39}$/.test(query))
    throw new RangeError('Invalid package search term');
  // apt-cache accepts a regex, but only a literal escaped query is passed.
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = await run(path.join(BIN, 'apt-cache'), ['search', '--names-only', safe], {
    timeout: 15000,
    maxBuffer: 80000,
    outputLimit: 78000,
  });
  const packages: AvailableTermuxPackage[] = [];
  for (const line of result.output.split('\n').slice(0, 1000)) {
    const match = /^([a-z0-9][a-z0-9+.-]{0,79}) - ([^\r\n]{0,160})$/.exec(line.trim());
    if (!match) continue;
    packages.push({ name: match[1]!, description: match[2]! });
    if (packages.length > MAX_AVAILABLE) break;
  }
  return {
    query,
    packages: packages.slice(0, MAX_AVAILABLE),
    truncated: packages.length > MAX_AVAILABLE,
  };
}
