import path from 'node:path';
import type { ManagedProcessIdentity } from './managed-process-guards.ts';
import { attestsManagedProcess } from './managed-process-guards.ts';
import { createHostingRegistries } from '../../shared/hosting-registry.ts';

type RecordValue = Record<string, unknown>;

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalTarget(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 1 &&
    value.length <= 512 &&
    path.isAbsolute(value) &&
    path.normalize(value) === value &&
    !value.includes('\0') &&
    !value.startsWith('//')
  );
}

function processIdentity(value: unknown): value is ManagedProcessIdentity {
  if (!record(value)) return false;
  return (
    typeof value.pid === 'number' &&
    Number.isSafeInteger(value.pid) &&
    value.pid > 1 &&
    typeof value.startTicks === 'string' &&
    /^\d+$/.test(value.startTicks) &&
    typeof value.executable === 'string' &&
    value.executable.length > 0 &&
    typeof value.cwd === 'string' &&
    value.cwd.length > 0 &&
    typeof value.argvSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(value.argvSha256)
  );
}

/**
 * M1 source-only, read-only consistency diagnostic. Inputs must originate from
 * independent, trusted host probes; JSON supplied by a client is not evidence.
 *
 * "consistent" is NOT an ownership grant or a lifecycle authorization. Before
 * any runit operation, the host adapter must independently re-attest the live
 * canonical target, registration and exact process identity at the moment of use.
 */
export function inspectHostingServiceOwnership(
  declarations: unknown,
  serviceId: string,
  expectedRevision: number,
  evidence: unknown,
): 'consistent' | 'unverified' {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof serviceId !== 'string' ||
    !record(evidence)
  ) {
    return 'unverified';
  }

  const registry = createHostingRegistries(declarations);
  const service = registry.services().find((item) => item.id === serviceId);
  if (!service) return 'unverified';
  const project = registry.project(service.projectId);
  if (
    !project?.components.some(
      (component) => component.serviceId === service.id && component.moduleId === service.moduleId,
    ) ||
    evidence.registryRevision !== expectedRevision
  ) {
    return 'unverified';
  }

  const registration = evidence.registration;
  const observation = evidence.observation;
  const marker = evidence.marker;
  if (!record(registration) || !record(observation) || !record(marker)) {
    return 'unverified';
  }
  const target = registration.canonicalTarget;
  if (
    registration.owner !== 'pockethost' ||
    registration.name !== service.name ||
    !canonicalTarget(target) ||
    observation.name !== service.name ||
    observation.canonicalTarget !== target ||
    observation.protected !== false ||
    observation.state !== 'running' ||
    marker.owner !== 'pockethost' ||
    marker.serviceId !== service.id ||
    marker.projectId !== service.projectId ||
    marker.moduleId !== service.moduleId ||
    marker.name !== service.name ||
    marker.canonicalTarget !== target ||
    typeof marker.instanceId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      marker.instanceId,
    ) ||
    !processIdentity(marker.expectedProcess) ||
    !processIdentity(evidence.observedProcess)
  ) {
    return 'unverified';
  }

  return attestsManagedProcess(marker.expectedProcess, evidence.observedProcess)
    ? 'consistent'
    : 'unverified';
}
