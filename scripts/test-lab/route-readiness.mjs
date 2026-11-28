/** Exact headings for routes whose identity must be verified after SPA navigation. */
export const routeTitles = Object.freeze({
  dashboard: 'Dashboard',
  hosting: 'Hosting',
  projects: 'Node.js applications',
  addapplication: 'Add Node.js application',
});

/** Browser-evaluable route readiness check; never reads input values or response bodies. */
export function isRouteReady(expected, context = {}) {
  const doc = context.doc ?? globalThis.document;
  const win = context.win ?? globalThis.window;
  if (!expected || typeof expected.path !== 'string' || !expected.path.startsWith('/'))
    return false;

  // Vite can be served under a basename: accept a complete path-segment suffix.
  const pathname = win.location?.pathname;
  if (
    typeof pathname !== 'string' ||
    (pathname !== expected.path && !pathname.endsWith(expected.path))
  )
    return false;

  // React Router keeps the previous page visible during lazy loading.
  if (doc.querySelector('[role="progressbar"][aria-label="Loading page"]')) return false;
  if (!doc.querySelector('[data-slot="sidebar-wrapper"]')) return false;
  if ((doc.querySelector('#root')?.textContent?.trim().length ?? 0) <= 20) return false;
  if (expected.title && doc.querySelector('h1')?.textContent?.trim() !== expected.title)
    return false;
  return true;
}
