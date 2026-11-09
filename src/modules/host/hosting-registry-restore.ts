import {
  fingerprintHostingRegistrySnapshot,
  planHostingRegistryRollback,
} from './hosting-registry-recovery.ts';
import { createHostingRegistryStore } from './hosting-registry-store.ts';

/**
 * Explicit M1 v1 restore for a verified, PocketHost-private backup.
 *
 * The host caller must independently establish backup provenance and bind
 * verifiedBackupSha256 to that trusted source. A digest supplied by a client
 * is NOT evidence of backup ownership. This function does not discover
 * services, migrate a schema, grant lifecycle rights or touch any runtime.
 *
 * The store reads a canonical, private root and commits under its exclusive
 * lock with expected-revision compare-and-swap; an intervening writer aborts.
 * The current revision advances on restore rather than rewinding history.
 * No production or active registry is connected to this source-only adapter.
 */
export function restoreHostingRegistryFromVerifiedBackup(
  privateRoot: string,
  backup: unknown,
  expectedRevision: number,
  verifiedBackupSha256: string,
) {
  const store = createHostingRegistryStore(privateRoot);
  const current = store.read();
  if (current === null) throw new Error('Registry restore requires a current owned snapshot');
  const plan = planHostingRegistryRollback(
    current,
    backup,
    expectedRevision,
    fingerprintHostingRegistrySnapshot(current),
    verifiedBackupSha256,
  );
  return store.save(plan.declarations, plan.expectedRevision);
}
