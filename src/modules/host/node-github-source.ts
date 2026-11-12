import { Buffer } from 'node:buffer';
import { planNodeDependencies, type NodeDependencyPlan } from '../../shared/node-dependency-plan.ts';

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9._/-]{1,100}$/;
const SHA = /^[a-f0-9]{40}$/;
const FILES = ['package.json', 'package-lock.json', 'server.mjs'] as const;
const MAX_SOURCE = 64 * 1024;
const MAX_TOTAL = 320 * 1024;

/** Only a public GitHub API origin; redirects, caller URLs and credentials are forbidden. */
function repositoryParts(value: unknown): { owner: string; name: string } {
  if (typeof value !== 'string' || value.length > 150 || value.trim() !== value)
    throw new RangeError('Invalid public GitHub repository');
  const parts = value.split('/');
  if (
    parts.length !== 2 ||
    !OWNER.test(parts[0]) ||
    !REPO.test(parts[1]) ||
    parts[1] === '.' ||
    parts[1] === '..' ||
    parts[1].startsWith('.') ||
    parts[1].endsWith('.git')
  ) {
    throw new RangeError('Use a public GitHub repository as owner/repository');
  }
  return { owner: parts[0], name: parts[1] };
}

async function apiJson(url: string, limit: number, get: typeof fetch): Promise<unknown> {
  const response = await get(url, {
    method: 'GET',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(9000),
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'PocketHost-Node-Source-Preview',
    },
  });
  if (response.status === 404) throw new RangeError('Public GitHub repository or file not found');
  if (response.status === 403 || response.status === 429)
    throw new Error('GitHub API unavailable or rate-limited');
  if (!response.ok || !response.body) throw new Error('GitHub source request failed');
  const claimed = response.headers.get('content-length');
  if (claimed !== null && (!/^\d+$/.test(claimed) || Number(claimed) > limit))
    throw new RangeError('GitHub source response exceeds limit');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new RangeError('GitHub source response exceeds limit');
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8')) as unknown;
  } catch {
    throw new RangeError('Invalid GitHub source response');
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new RangeError('Invalid GitHub metadata');
  return value as Record<string, unknown>;
}

function sourceText(value: unknown, name: string): string {
  const data = record(value);
  if (data.type !== 'file' || data.name !== name || data.path !== name ||
      data.encoding !== 'base64' || typeof data.content !== 'string')
    throw new RangeError('GitHub source is not a regular root file');
  const encoded = data.content.replace(/\s+/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    throw new RangeError('Invalid GitHub file encoding');
  const dataBytes = Buffer.from(encoded, 'base64');
  const maximum = name === 'server.mjs' ? MAX_SOURCE : MAX_TOTAL;
  if (dataBytes.length < 1 || dataBytes.length > maximum)
    throw new RangeError('GitHub file exceeds source budget');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(dataBytes);
  } catch {
    throw new RangeError('GitHub source must be UTF-8');
  }
}

export interface GitHubNodeSourcePreview {
  repository: string;
  commit: string;
  source: { packageJson: unknown; packageLock: unknown; serverSource: string };
  plan: NodeDependencyPlan;
}

/** Inspect only three fixed files from the repository's pinned default-branch commit. */
export async function previewPublicGitHubNodeSource(
  repository: unknown,
  get: typeof fetch = fetch,
): Promise<GitHubNodeSourcePreview> {
  const { owner, name } = repositoryParts(repository);
  const base = 'https://api.github.com/repos/' + owner + '/' + name;
  const info = record(await apiJson(base, 32000, get));
  if (info.private !== false || info.full_name !== owner + '/' + name ||
      typeof info.default_branch !== 'string' ||
      !REF.test(info.default_branch) || info.default_branch.includes('..') ||
      info.default_branch.startsWith('/') || info.default_branch.endsWith('/'))
    throw new RangeError('Only public GitHub repositories with a valid default branch are supported');
  const commitInfo = record(await apiJson(
    base + '/commits/' + encodeURIComponent(info.default_branch), 64000, get,
  ));
  if (typeof commitInfo.sha !== 'string' || !SHA.test(commitInfo.sha))
    throw new RangeError('GitHub commit SHA is invalid');
  const commit = commitInfo.sha;
  const texts: string[] = [];
  let total = 0;
  for (const file of FILES) {
    const data = await apiJson(
      base + '/contents/' + file + '?ref=' + commit, 520000, get,
    );
    const contents = sourceText(data, file);
    total += Buffer.byteLength(contents);
    if (total > MAX_TOTAL) throw new RangeError('GitHub Node source exceeds 320 KB');
    texts.push(contents);
  }
  let packageJson: unknown;
  let packageLock: unknown;
  try {
    packageJson = JSON.parse(texts[0]);
    packageLock = JSON.parse(texts[1]);
  } catch {
    throw new RangeError('Invalid GitHub Node manifest or lockfile');
  }
  const plan = planNodeDependencies(packageJson, packageLock);
  if ((packageJson as { scripts?: { start?: unknown } }).scripts?.start !== 'node server.mjs')
    throw new RangeError('GitHub Node entrypoint must be node server.mjs');
  if (!texts[2].trim() || texts[2].includes('\0'))
    throw new RangeError('Invalid GitHub Node source');
  return {
    repository: owner + '/' + name,
    commit,
    source: { packageJson, packageLock, serverSource: texts[2] },
    plan,
  };
}
