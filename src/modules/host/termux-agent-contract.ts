export interface AgentRequestHeaders {
  origin?: string;
  intent?: string;
  agentIntent?: string;
  fetchSite?: string;
}

/** The same OS user can call the private API through Local Agent host tasks. */
export function admitsAgentCommand(headers: AgentRequestHeaders): boolean {
  if (headers.intent !== 'termux-admin' || headers.fetchSite === 'cross-site') return false;
  if (headers.origin) return false;
  return headers.agentIntent === 'termux-owner-agent';
}
export const OWNER_AGENT_CAPABILITIES = Object.freeze({
  version: 1,
  transport: 'local-http',
  shell: 'manual-ttyd-only',
  loginRequired: false,
  path: '/api/v1/termux-admin',
  headers: {
    'Content-Type': 'application/json',
    'X-PocketHost-Intent': 'termux-admin',
    'X-PocketHost-Agent-Intent': 'termux-owner-agent',
  },
  actions: [
    'package-preview', 'package', 'full-file', 'service', 'restic',
    'restic-system', 'terminal', 'file', 'snapshot',
  ],
  scopes: {
    files: ['home', 'prefix', 'shared'],
    backups: ['home', 'prefix', 'all'],
  },
  notes: [
    'Only existing trusted private LAN and Termux loopback; no public bind',
    'Real operations execute as the existing Termux OS user',
    'This endpoint does not perform GitHub Local Agent enrollment or task publication',
  ],
});
