import type { HostedProject, HostingDeclarations, PlannedService } from './hosting-platform.ts';

const NODE_ID = /^node-[a-f0-9]{32}$/;

/** M1 identity only: never infer ownership or process authority from a name. */
export function nodeHostingServiceId(projectId: string): string {
  if (!NODE_ID.test(projectId)) throw new RangeError('Invalid owned Node project identity');
  return 's-' + projectId.slice(5, 17);
}
export function nodeHostingUnitName(projectId: string): string {
  return 'pockethost-' + projectId + '-' + nodeHostingServiceId(projectId);
}
export interface NodeRegistryEntry {
  id: string;
  kind: 'node';
  port: number | null;
  registered: boolean;
}
/**
 * A read-only projection into M1 Module/Service/Project declarations.
 * The host must independently attest registered service provenance.
 * It never adopts an observed process or authorizes a lifecycle operation.
 */
export function projectNodeHostingDeclarations(
  entries: ReadonlyArray<NodeRegistryEntry>,
): HostingDeclarations {
  if (!Array.isArray(entries) || entries.length > 8) {
    throw new RangeError('Node project registry budget exceeded');
  }
  const services: PlannedService[] = [];
  const projects: HostedProject[] = [];
  const identities = new Set<string>();
  for (const entry of entries) {
    if (
      !entry ||
      entry.kind !== 'node' ||
      !NODE_ID.test(entry.id) ||
      typeof entry.registered !== 'boolean' ||
      identities.has(entry.id) ||
      (entry.registered && entry.port === null) ||
      (!entry.registered && entry.port !== null)
    ) {
      throw new Error('Invalid or duplicate Node registry projection');
    }
    identities.add(entry.id);
    const serviceId = entry.registered ? nodeHostingServiceId(entry.id) : null;
    if (serviceId) {
      services.push({
        schemaVersion: 1,
        id: serviceId,
        projectId: entry.id,
        moduleId: 'nodejs',
        name: nodeHostingUnitName(entry.id),
        state: 'planned',
      });
    }
    projects.push({
      schemaVersion: 1,
      id: entry.id,
      origin: 'created-in-pockethost',
      components: [
        {
          id: 'web',
          moduleId: 'nodejs',
          moduleVersion: 1,
          role: 'backend',
          port: entry.port,
          serviceId,
          secrets: [],
        },
      ],
    });
  }
  return {
    schemaVersion: 1,
    modules: [{ schemaVersion: 1, id: 'nodejs', version: 1, capabilities: ['node'] }],
    services,
    projects,
  };
}
