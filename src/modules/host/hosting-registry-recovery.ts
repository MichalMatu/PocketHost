import { createHash } from 'node:crypto';
import type { HostingDeclarations } from '../../shared/hosting-platform.ts';
import { createHostingRegistries } from '../../shared/hosting-registry.ts';

const MAX_BYTES = 256 * 1024;
const DIGEST = /^[a-f0-9]{64}$/;

interface RegistrySnapshot {
  schemaVersion: 1;
  owner: 'pockethost';
  revision: number;
  declarations: HostingDeclarations;
}

function snapshot(value: unknown): RegistrySnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid registry rollback snapshot');
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 4 ||
    !['schemaVersion', 'owner', 'revision', 'declarations'].every((field) =>
      Object.hasOwn(record, field),
    ) ||
    record.schemaVersion !== 1 ||
    record.owner !== 'pockethost' ||
    !Number.isSafeInteger(record.revision) ||
    (record.revision as number) < 1 ||
    (record.revision as number) >= Number.MAX_SAFE_INTEGER - 1
  ) {
    throw new Error('Unsupported registry rollback version or owner');
  }
  const registry = createHostingRegistries(record.declarations);
  const canonical: RegistrySnapshot = {
    schemaVersion: 1,
    owner: 'pockethost',
    revision: record.revision as number,
    declarations: {
      schemaVersion: 1,
      modules: registry.modules(),
      services: registry.services(),
      projects: registry.projects(),
    },
  };
  if (Buffer.byteLength(JSON.stringify(canonical)) > MAX_BYTES) {
    throw new Error('Registry rollback snapshot too large');
  }
  return canonical;
}

function digest(value: RegistrySnapshot): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Digest of a strictly validated v1 snapshot, independent of source object identity. */
export function fingerprintHostingRegistrySnapshot(value: unknown): string {
  return digest(snapshot(value));
}

/**
 * An explicit, in-memory v1 rollback plan. No registry writes, migrations,
 * process signals or service privileges occur. The caller must obtain both
 * SHA-256 digests independently from a trusted PocketHost-private backup
 * and the currently verified private store; untrusted client values do not
 * establish backup provenance.
 *
 * Applying this plan later requires the existing store's revisioned save and
 * a fresh host-side ownership/backup check. A future schema-v2 migration is
 * NOT implemented by this function.
 */
export function planHostingRegistryRollback(
  currentValue: unknown,
  backupValue: unknown,
  expectedRevision: number,
  expectedCurrentDigest: string,
  trustedBackupDigest: string,
): {
  expectedRevision: number;
  nextRevision: number;
  restoreFromRevision: number;
  declarations: HostingDeclarations;
} {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    expectedRevision >= Number.MAX_SAFE_INTEGER - 1 ||
    typeof expectedCurrentDigest !== 'string' ||
    !DIGEST.test(expectedCurrentDigest) ||
    typeof trustedBackupDigest !== 'string' ||
    !DIGEST.test(trustedBackupDigest)
  ) {
    throw new Error('Invalid registry rollback preconditions');
  }
  const current = snapshot(currentValue);
  const backup = snapshot(backupValue);
  if (
    current.revision !== expectedRevision ||
    backup.revision >= current.revision ||
    digest(current) !== expectedCurrentDigest ||
    digest(backup) !== trustedBackupDigest
  ) {
    throw new Error('Stale or unverified registry rollback snapshot');
  }
  return {
    expectedRevision,
    nextRevision: expectedRevision + 1,
    restoreFromRevision: backup.revision,
    declarations: backup.declarations,
  };
}
