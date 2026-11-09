/**
 * Compatibility aliases for the historical six-card host status API.
 *
 * The IDs below preserve existing read-only client contracts, not project
 * ownership or registration. Labels describe the generic service role.
 * The real system inventory lives in TermuxServiceAdmin.list().
 */
export type ServiceScope = 'system' | 'local-agent';

export const SERVICE_CATALOG = [
  { id: 'ilestoi', label: 'Web application service', runit: 'wreckscanner', scope: 'system' },
  { id: 'tunnel', label: 'Tunnel service', runit: 'cloudflared', scope: 'system' },
  { id: 'ssh', label: 'SSH service', runit: 'sshd', scope: 'system' },
  { id: 'mqtt', label: 'MQTT service', runit: 'mosquitto', scope: 'system' },
  {
    id: 'healthwatch',
    label: 'Website health monitor',
    runit: 'ilestoi-healthwatch',
    scope: 'system',
  },
  { id: 'local-agent', label: 'Local task agent', runit: 'termux-agent', scope: 'local-agent' },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  runit: string;
  scope: ServiceScope;
}>;
