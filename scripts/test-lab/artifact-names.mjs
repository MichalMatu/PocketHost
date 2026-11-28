/** Fixed local Test Lab screenshot names shared by capture and optional preview. */
/** Fixed Test Lab screen aliases: only real, explicitly enumerated read-only routes. */
export const routePaths = Object.freeze({
  dashboard: '/dashboard',
  monitoring: '/observability',
  host: '/host',
  hosting: '/hosting',
  sites: '/sites',
  projects: '/projects',
  deployments: '/deployments',
  logs: '/runtime-logs',
  services: '/services',
  runit: '/services/runit',
  autostart: '/services/autostart',
  workloads: '/services/hosting',
  health: '/services/health',
  cloudflare: '/services/cloudflare',
  ssh: '/services/ssh',
  mqtt: '/services/mqtt',
  agent: '/local-agent',
  shizuku: '/shizuku',
  phone: '/phone-settings',
  packages: '/packages',
  files: '/files',
  terminal: '/terminal',
  backups: '/backups',
  agents: '/agents',
  platform: '/settings/platform',
  network: '/settings/network',
  appearance: '/settings/appearance',
});
const isAllowedRoute = (route) => Object.hasOwn(routePaths, route);

const VIEWPORT = /^(?:mobile|tablet|desktop)$/;

export function screenshotName(route, viewport, position = 'top') {
  if (
    typeof route !== 'string' ||
    !isAllowedRoute(route) ||
    typeof viewport !== 'string' ||
    !VIEWPORT.test(viewport) ||
    !['top', 'middle', 'bottom', 'create-panel', 'menu', 'command-search'].includes(position) ||
    (position === 'create-panel' && route !== 'projects') ||
    (position === 'menu' && viewport !== 'mobile') ||
    (position === 'command-search' && route !== 'dashboard')
  ) {
    throw Error('Screenshot selection not allowlisted');
  }
  return route + '-' + viewport + (position === 'top' ? '' : '-' + position) + '.png';
}

export function isAllowedScreenshotName(name) {
  if (typeof name !== 'string') return false;
  const pattern =
    /^([a-z]+)-(mobile|tablet|desktop)(-(?:middle|bottom|create-panel|menu|command-search))?\.png$/;
  const match = pattern.exec(name);
  return Boolean(
    match &&
    isAllowedRoute(match[1]) &&
    (match[3] !== '-create-panel' || match[1] === 'projects') &&
    (match[3] !== '-menu' || match[2] === 'mobile') &&
    (match[3] !== '-command-search' || match[1] === 'dashboard'),
  );
}
