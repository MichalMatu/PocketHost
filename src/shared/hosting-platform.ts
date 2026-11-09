/** M1 declarations only. None of these records attests a running process or grants lifecycle control. */
export type HostingCapability = 'static' | 'node' | 'python' | 'ssh' | 'cloudflare';

export interface ModuleDescriptor {
  schemaVersion: 1;
  id: string;
  version: number;
  capabilities: ReadonlyArray<HostingCapability>;
}

export interface SecretRef {
  kind: 'secret-ref';
  id: string;
}

export interface HostedComponent {
  id: string;
  moduleId: string;
  moduleVersion: number;
  role: 'frontend' | 'backend' | 'worker';
  port: number | null;
  serviceId: string | null;
  secrets: ReadonlyArray<SecretRef>;
}

export interface HostedProject {
  schemaVersion: 1;
  id: string;
  origin: 'created-in-pockethost';
  components: ReadonlyArray<HostedComponent>;
}

export interface PlannedService {
  schemaVersion: 1;
  id: string;
  name: string;
  projectId: string;
  moduleId: string;
  state: 'planned';
}

export interface HostingDeclarations {
  schemaVersion: 1;
  modules: ReadonlyArray<ModuleDescriptor>;
  services: ReadonlyArray<PlannedService>;
  projects: ReadonlyArray<HostedProject>;
}
