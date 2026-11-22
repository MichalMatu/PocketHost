/** Fixed local Test Lab screenshot names shared by capture and optional preview. */
const ROUTE = /^(?:dashboard|hosting|sites|projects|deployments|logs|services|agent|network)$/;
const VIEWPORT = /^(?:mobile|tablet|desktop)$/;

export function screenshotName(route, viewport, position = 'top') {
  if (
    typeof route !== 'string' ||
    !ROUTE.test(route) ||
    typeof viewport !== 'string' ||
    !VIEWPORT.test(viewport) ||
    !['top', 'middle', 'bottom', 'create-panel'].includes(position) ||
    (position === 'create-panel' && route !== 'projects')
  ) {
    throw Error('Screenshot selection not allowlisted');
  }
  return route + '-' + viewport + (position === 'top' ? '' : '-' + position) + '.png';
}

export function isAllowedScreenshotName(name) {
  if (typeof name !== 'string') return false;
  const match = /^([a-z]+)-(mobile|tablet|desktop)(-(?:middle|bottom|create-panel))?\.png$/.exec(name);
  return Boolean(match && ROUTE.test(match[1]) && (match[3] !== '-create-panel' || match[1] === 'projects'));
}
