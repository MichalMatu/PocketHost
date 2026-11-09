/** Declarative persistence only. No runtime or service-control authority. */
export interface HostingRegistryStorage {
  read(): string | null;
  compareAndSwap(expected: string | null, next: string): void;
}
