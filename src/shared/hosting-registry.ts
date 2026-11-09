import type {
  HostedProject,
  ModuleDescriptor,
  PlannedService,
  HostingCapability,
} from './hosting-platform.ts';

const ID = /^[a-z][a-z0-9-]{1,63}$/;
const SECRET = /^sec-[a-z0-9][a-z0-9-]{3,63}$/;
const CAPABILITIES = new Set<HostingCapability>(['static', 'node', 'python', 'ssh', 'cloudflare']);
const ROLES = new Set(['frontend', 'backend', 'worker']);

function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a bounded registry object');
  }
  return value as Record<string, unknown>;
}

function fields(value: Record<string, unknown>, names: ReadonlyArray<string>): void {
  if (Object.keys(value).some((key) => !names.includes(key))) {
    throw new Error('Unknown registry field');
  }
  if (names.some((key) => !Object.hasOwn(value, key))) {
    throw new Error('Missing registry field');
  }
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error('Invalid registry ID');
  return value;
}

function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 100) {
    throw new Error('Unsupported registry version');
  }
  return value as number;
}

function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid registry collection');
  return value;
}

function ownedPort(value: unknown, occupied: Set<number>): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 1024 || (value as number) > 65535) {
    throw new Error('Invalid project port');
  }
  const port = value as number;
  if (occupied.has(port)) throw new Error('Project port collision');
  occupied.add(port);
  return port;
}

/**
 * Positive, declarative M1 registry: no port scan, filesystem access, process
 * adoption, service control, secret resolution or implicit autostart.
 * The host adapter must separately attest service ownership before any effect.
 */
export function createHostingRegistries(value: unknown, reservedPorts: ReadonlyArray<number> = []) {
  const top = obj(value);
  fields(top, ['schemaVersion', 'modules', 'services', 'projects']);
  if (top.schemaVersion !== 1) throw new Error('Unsupported platform schema');
  const modules = new Map<string, ModuleDescriptor>();
  for (const entry of array(top.modules, 32)) {
    const item = obj(entry);
    fields(item, ['schemaVersion', 'id', 'version', 'capabilities']);
    if (item.schemaVersion !== 1) throw new Error('Unsupported module schema');
    const name = id(item.id);
    if (modules.has(name)) throw new Error('Duplicate module ID');
    const capabilities = array(item.capabilities, 12);
    if (!capabilities.length || new Set(capabilities).size !== capabilities.length ||
        capabilities.some((cap) => !CAPABILITIES.has(cap as HostingCapability))) {
      throw new Error('Invalid module capability');
    }
    modules.set(name, {
      schemaVersion: 1,
      id: name,
      version: version(item.version),
      capabilities: capabilities as HostingCapability[],
    });
  }

  const services = new Map<string, PlannedService>();
  const unitNames = new Set<string>();
  for (const entry of array(top.services, 64)) {
    const item = obj(entry);
    fields(item, ['schemaVersion', 'id', 'name', 'projectId', 'moduleId', 'state']);
    if (item.schemaVersion !== 1 || item.state !== 'planned') {
      throw new Error('Only planned service declarations are allowed');
    }
    const serviceId = id(item.id);
    const projectId = id(item.projectId);
    const moduleId = id(item.moduleId);
    const unitName = item.name;
    if (typeof unitName !== 'string' ||
        unitName !== `pockethost-${projectId}-${serviceId}` ||
        unitName.length > 128 ||
        services.has(serviceId) || unitNames.has(unitName)) {
      throw new Error('Unsafe or duplicate service declaration');
    }
    services.set(serviceId, {
      schemaVersion: 1, id: serviceId, name: unitName, projectId, moduleId, state: 'planned',
    });
    unitNames.add(unitName);
  }

  const taken = new Set<number>();
  for (const port of reservedPorts) {
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
      throw new Error('Invalid reserved port');
    }
    taken.add(port);
  }
  const projects = new Map<string, HostedProject>();
  const attachedServices = new Set<string>();
  for (const entry of array(top.projects, 64)) {
    const item = obj(entry);
    fields(item, ['schemaVersion', 'id', 'origin', 'components']);
    if (item.schemaVersion !== 1 || item.origin !== 'created-in-pockethost') {
      throw new Error('External observations cannot be adopted as projects');
    }
    const projectId = id(item.id);
    if (projects.has(projectId)) throw new Error('Duplicate project ID');
    const seenComponents = new Set<string>();
    const components = array(item.components, 8);
    if (!components.length) throw new Error('Project requires a component');
    const validated = components.map((entry) => {
      const c = obj(entry);
      fields(c, ['id', 'moduleId', 'moduleVersion', 'role', 'port', 'serviceId', 'secrets']);
      const componentId = id(c.id);
      const moduleId = id(c.moduleId);
      if (seenComponents.has(componentId)) throw new Error('Duplicate component ID');
      seenComponents.add(componentId);
      const module = modules.get(moduleId);
      if (!module || module.version !== version(c.moduleVersion)) {
        throw new Error('Unknown or stale component module');
      }
      if (!ROLES.has(c.role as string)) throw new Error('Invalid component role');
      if (c.serviceId !== null) {
        const serviceId = id(c.serviceId);
        const service = services.get(serviceId);
        if (!service || service.projectId !== projectId || service.moduleId !== moduleId ||
            attachedServices.has(serviceId)) {
          throw new Error('Unowned or reused service binding');
        }
        attachedServices.add(serviceId);
      }
      const secrets = array(c.secrets, 16).map((ref) => {
        const s = obj(ref);
        fields(s, ['kind', 'id']);
        if (s.kind !== 'secret-ref' || typeof s.id !== 'string' || !SECRET.test(s.id)) {
          throw new Error('Only opaque SecretRef values are allowed');
        }
        return { kind: 'secret-ref' as const, id: s.id };
      });
      return {
        id: componentId, moduleId, moduleVersion: module.version,
        role: c.role as 'frontend' | 'backend' | 'worker',
        port: ownedPort(c.port, taken),
        serviceId: c.serviceId as string | null,
        secrets,
      };
    });
    projects.set(projectId, {
      schemaVersion: 1, id: projectId, origin: 'created-in-pockethost', components: validated,
    });
  }
  if ([...services.keys()].some((serviceId) => !attachedServices.has(serviceId))) {
    throw new Error('Unattached service registration');
  }

  // All outputs are copies. Registry metadata never conveys process authority.
  return {
    modules: () => structuredClone([...modules.values()]),
    services: () => structuredClone([...services.values()]),
    projects: () => structuredClone([...projects.values()]),
    project: (projectId: string) => structuredClone(projects.get(projectId) ?? null),
  };
}
